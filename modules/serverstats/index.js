const { Events, ChannelType, PermissionFlagsBits } = require("discord.js");
const localConfig = require("./config.json");

let channelIds = {};
let cachedCounts = { members: null, customers: null };
let updateTimeout = null;

module.exports = (client) => {
  const ensureChannels = async () => {
    const guild = await client.guilds.fetch(localConfig.guildId);
    for (const key in localConfig.channelNames) {
      const baseName = localConfig.channelNames[key].split(":")[0];
      let channel = guild.channels.cache.find(c => c.name.startsWith(baseName));
      if (!channel) {
        try {
          channel = await guild.channels.create({
            name: localConfig.channelNames[key].replace("{count}", 0),
            type: ChannelType.GuildVoice,
            permissionOverwrites: [
              { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] }
            ]
          });
        } catch (e) {
          console.error("[serverstats] Konnte Channel nicht erstellen (fehlende Rechte?):", e?.message || e);
          continue;
        }
      }
      channelIds[key] = channel.id;
    }
  };

  const updateChannels = async () => {
    try {
      const guild = await client.guilds.fetch(localConfig.guildId);
      // Mitglieder-Cache aktualisieren, damit Rollen-Zählung konsistent ist
      try { await guild.members.fetch(); } catch {}
      const realMemberCount = guild.memberCount;
      const customerRoleId = localConfig.customerRoleId;
      let customerCount = 0;
      if (customerRoleId) {
        customerCount = guild.members.cache.filter(m => m.roles.cache.has(customerRoleId)).size;
      }
      const updates = {
        members: { name: localConfig.channelNames.members.replace("{count}", realMemberCount), count: realMemberCount },
        customers: { name: localConfig.channelNames.customers.replace("{count}", customerCount), count: customerCount },
        header: { name: localConfig.channelNames.header }
      };
      for (const key in updates) {
        const channel = guild.channels.cache.get(channelIds[key]);
        const newName = updates[key].name;
        if (channel && channel.name !== newName) {
          await channel.setName(newName);
          if (key !== "header") cachedCounts[key] = updates[key].count;
        }
      }
    } catch (e) {
      console.error("[serverstats] Update-Fehler:", e);
    }
  };

  const scheduleUpdate = () => {
    if (updateTimeout) return;
    updateTimeout = setTimeout(() => {
      updateTimeout = null;
      updateChannels();
    }, 5000);
  };

  client.once(Events.ClientReady, async () => {
    try {
      await ensureChannels();
      await updateChannels();
      setInterval(updateChannels, localConfig.updateInterval || 60000);
    } catch (e) {
      console.error("[serverstats] Fehler beim Initialisieren:", e);
    }
  });

  client.on(Events.GuildMemberAdd, m => {
    if (m.guild.id === localConfig.guildId) scheduleUpdate();
  });
  client.on(Events.GuildMemberRemove, m => {
    if (m.guild.id === localConfig.guildId) scheduleUpdate();
  });
  client.on(Events.GuildBanAdd, b => {
    if (b.guild.id === localConfig.guildId) scheduleUpdate();
  });
  client.on(Events.GuildBanRemove, b => {
    if (b.guild.id === localConfig.guildId) scheduleUpdate();
  });
  client.on(Events.GuildMemberUpdate, (oldM, newM) => {
    try {
      if (newM.guild?.id !== localConfig.guildId) return;
      const roleId = localConfig.customerRoleId;
      if (!roleId) return;
      const had = oldM?.roles?.cache?.has?.(roleId) || false;
      const has = newM?.roles?.cache?.has?.(roleId) || false;
      if (had !== has) scheduleUpdate();
    } catch {}
  });
};
