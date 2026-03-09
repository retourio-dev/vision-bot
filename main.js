// main.js — Autarke Modul-Loader / Dispatcher für Discord.js v14
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');

const CONFIG_PATH = path.resolve(__dirname, './config.json');

let token = null;
let guildId = null;

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const mainCfg = require(CONFIG_PATH);
    if (mainCfg.token) token = mainCfg.token;
    if (mainCfg.guildId) guildId = mainCfg.guildId;
  } catch (e) {
    console.error('Fehler beim Laden von config.json:', e);
  }
}
if (!token && process.env.BOT_TOKEN) {
  token = process.env.BOT_TOKEN;
}
if (!token) {
  console.error('Kein Bot-Token gefunden. Setze BOT_TOKEN als Env-Var oder config.json { "token": "..." }');
  process.exit(1);
}
if (!guildId) {
  console.error('Keine guildId gefunden. Bitte in config.json angeben.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();
client.modules = new Map();

// --- Module laden ---
function loadModules() {
  const modulesDir = path.resolve(__dirname, './modules');
  if (!fs.existsSync(modulesDir)) {
    console.warn('Kein modules-Ordner gefunden (./modules).');
    return;
  }

  const folders = fs.readdirSync(modulesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const folder of folders) {
    const modPath = path.join(modulesDir, folder, 'index.js');
    try {
      if (!fs.existsSync(modPath)) {
        console.warn(`Modul ${folder} hat keine index.js — wird übersprungen.`);
        continue;
      }

      delete require.cache[require.resolve(modPath)];
      const mod = require(modPath);

      if (typeof mod === 'function') {
        mod(client);
        console.log(`✅ Modul geladen & initialisiert: ${folder}`);
      } else if (Array.isArray(mod)) {
        mod.forEach(cmd => {
          if (cmd?.data && typeof cmd.data.toJSON === 'function') {
            const name = cmd.data.name;
            client.commands.set(name, { module: cmd, folderName: folder });
            console.log(`✅ Command geladen: ${folder} -> /${name}`);
          }
        });
      } else if (mod?.data && typeof mod.data.toJSON === 'function') {
        const name = mod.data.name || folder;
        client.commands.set(name, { module: mod, folderName: folder });
        console.log(`✅ Modul geladen (SlashCommand): ${folder} -> /${name}`);
      } else {
        client.modules.set(folder, mod);
        console.log(`✅ Modul geladen (Utility/Event): ${folder}`);
      }

      const commandsDir = path.join(modulesDir, folder, 'commands');
      if (fs.existsSync(commandsDir)) {
        const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
        for (const file of files) {
          try {
            const cmd = require(path.join(commandsDir, file));
            if (cmd?.data && typeof cmd.data.toJSON === 'function' && typeof cmd.execute === 'function') {
              const name = cmd.data.name;
              client.commands.set(name, { module: cmd, folderName: folder });
              console.log(`✅ Command geladen: ${folder} -> /${name}`);
            }
          } catch (e) {
            console.error(`Fehler beim Laden des Commands aus ${folder}/${file}:`, e);
          }
        }
      }
    } catch (err) {
      console.error(`Fehler beim Laden des Moduls ${folder}:`, err);
    }
  }
  try {
    const names = Array.from(client.commands.keys());
    console.log(`📋 Geladene Commands: ${names.length ? names.join(', ') : '(keine)'}`);
  } catch {}
}

// --- Slash-Commands registrieren ---
async function registerSlashCommands(guildId) {
  try {
    const commands = [];
    const names = [];
    for (const [, entry] of client.commands.entries()) {
      const mod = entry.module;
      if (mod?.data && typeof mod.data.toJSON === 'function') {
        commands.push(mod.data.toJSON());
        names.push(mod.data.name);
      }
    }
    if (commands.length === 0) {
      console.log('Keine Slash-Commands zum Registrieren gefunden.');
      return;
    }
    const rest = new REST({ version: '10' }).setToken(token);
    const appId = client.application?.id || client.user.id;
    try {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
      console.log(`✅ ${commands.length} Slash-Commands registriert für Guild ${guildId}: ${names.join(', ')}`);
    } catch (e) {
      console.warn('⚠️ Guild-Registrierung fehlgeschlagen, versuche globale Registrierung:', e?.message || e);
      await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log(`✅ ${commands.length} globale Slash-Commands registriert: ${names.join(', ')}`);
    }
  } catch (err) {
    console.error('Fehler beim Registrieren der Guild-Slash-Commands:', err);
  }
}

// --- Hilfsfunktion: Modul per Name bekommen ---
function getModuleByName(name) {
  if (client.modules.has(name)) return client.modules.get(name);
  const cmd = client.commands.get(name);
  return cmd ? cmd.module : null;
}

// --- Component Interactions ---
async function dispatchComponentInteraction(interaction) {
  try {
    const customId = interaction.customId || '';
    const [maybeModuleName, rest] = customId.includes(':')
      ? [customId.split(':')[0], customId.split(':').slice(1).join(':')]
      : [null, customId];

    if (maybeModuleName) {
      const mod = getModuleByName(maybeModuleName);
      if (mod?.handleComponent) {
        try {
          if (await mod.handleComponent(interaction, rest) === true) return true;
        } catch (e) {
          console.error(`Fehler in handleComponent von ${maybeModuleName}:`, e);
        }
      }
    }

    for (const [folder, mod] of client.modules.entries()) {
      if (typeof mod.handleComponent === 'function') {
        try {
          if (await mod.handleComponent(interaction) === true) return true;
        } catch (e) {
          console.error(`Fehler in handleComponent von ${folder}:`, e);
        }
      }
    }
    for (const [name, entry] of client.commands.entries()) {
      const mod = entry?.module;
      if (mod && typeof mod.handleComponent === 'function') {
        try {
          if (await mod.handleComponent(interaction) === true) return true;
        } catch (e) {
          console.error(`Fehler in handleComponent (Command ${name}):`, e);
        }
      }
    }
    return false;
  } catch (err) {
    console.error('Fehler im dispatchComponentInteraction:', err);
    return false;
  }
}

// --- Modal Interactions ---
async function dispatchModalInteraction(interaction) {
  try {
    const customId = interaction.customId || '';
    const [maybeModuleName, rest] = customId.includes(':')
      ? [customId.split(':')[0], customId.split(':').slice(1).join(':')]
      : [null, customId];

    if (maybeModuleName) {
      const mod = getModuleByName(maybeModuleName);
      if (mod?.handleModal) {
        try {
          if (await mod.handleModal(interaction, rest) === true) return true;
        } catch (e) {
          console.error(`Fehler in handleModal von ${maybeModuleName}:`, e);
        }
      }
    }

    for (const [folder, mod] of client.modules.entries()) {
      if (typeof mod.handleModal === 'function') {
        try {
          if (await mod.handleModal(interaction) === true) return true;
        } catch (e) {
          console.error(`Fehler in handleModal von ${folder}:`, e);
        }
      }
    }
    for (const [name, entry] of client.commands.entries()) {
      const mod = entry?.module;
      if (mod && typeof mod.handleModal === 'function') {
        try {
          if (await mod.handleModal(interaction) === true) return true;
        } catch (e) {
          console.error(`Fehler in handleModal (Command ${name}):`, e);
        }
      }
    }
    return false;
  } catch (err) {
    console.error('Fehler im dispatchModalInteraction:', err);
    return false;
  }
}

// --- ready Event ---
client.once('ready', async () => {
  console.log(`✅ Bot online: ${client.user.tag} (${client.user.id})`);
  loadModules();
  await registerSlashCommands(guildId);

  for (const [folder, mod] of client.modules.entries()) {
    if (typeof mod.onReady === 'function') {
      try {
        await mod.onReady(client);
        console.log(`♻ onReady ausgeführt für Modul: ${folder}`);
      } catch (e) {
        console.error(`Fehler im onReady von ${folder}:`, e);
      }
    }
  }
});

// --- interactionCreate Event ---
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const commandName = interaction.commandName;
      const entry = client.commands.get(commandName);
      if (!entry) {
        return safeReply(interaction, '⚠ Befehl nicht gefunden (Module geladen?).');
      }
      const mod = entry.module;
      if (!mod || typeof mod.execute !== 'function') {
        return safeReply(interaction, '⚠ Modul hat keine execute-Funktion.');
      }

      try {
        await mod.execute(interaction);
      } catch (e) {
        console.error(`Fehler in execute (${commandName}):`, e);
        safeReply(interaction, '🚫 Ein Fehler ist aufgetreten.');
      }
      return;
    }

    if (interaction.isButton() || (typeof interaction.isStringSelectMenu === 'function' ? interaction.isStringSelectMenu() : interaction.isSelectMenu())) {
      await dispatchComponentInteraction(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await dispatchModalInteraction(interaction);
      return;
    }
  } catch (err) {
    console.error('Fehler in interactionCreate:', err);
  }
});

// --- sichere Reply-Funktion gegen Unknown interaction ---
async function safeReply(interaction, content) {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content, ephemeral: true });
    } else {
      await interaction.followUp({ content, ephemeral: true });
    }
  } catch (e) {
    if (e.code === 10062) {
      console.warn('⚠ Antwortversuch auf abgelaufene Interaktion ignoriert.');
    } else {
      console.error('Fehler bei safeReply:', e);
    }
  }
}

// --- Dev: Module neu laden bei SIGHUP ---
process.on('SIGHUP', () => {
  console.log('SIGHUP empfangen — Module werden neu geladen...');
  loadModules();
});

// --- Global error handling ---
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// --- Initial Load ---
loadModules();
client.login(token).catch(err => {
  console.error('Fehler beim Login:', err);
  process.exit(1);
});
