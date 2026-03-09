const path = require('path');
const {
  SlashCommandBuilder,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

let parseDurationString;
try {
  ({ parseDurationString } = require(path.join(__dirname, 'utils', 'timeHelper.js')));
} catch {
  parseDurationString = function (input) {
    if (!input || typeof input !== 'string') return null;
    const s = input.trim().toLowerCase();
    const m = s.match(/^(\d+)\s*([smhdw])$/);
    if (!m) return null;
    const val = parseInt(m[1], 10);
    const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[m[2]];
    if (!unit) return null;
    return val * unit;
  };
}

let helpersModule = null;
function getHelpers() {
  if (helpersModule) return helpersModule;
  try {
    helpersModule = require(path.join(__dirname, 'utils', 'giveawayHelper.js'));
  } catch {
    const activeGiveaways = new Map();
    function saveGiveaways() {}
    function startGiveawayTimer(id, g) {
      const delay = Math.max(0, g.endTime - Date.now());
      setTimeout(async () => {
        try {
          const unique = Array.from(new Set(g.entries || []));
          const count = Math.max(1, g.winnerCount || 1);
          const winners = unique.slice(0, count);
          const client = g.client;
          if (client) {
            const ch = await client.channels.fetch(g.channelId).catch(() => null);
            if (ch) {
              let msg = null;
              try { msg = await ch.messages.fetch(g.messageId); } catch {}
              if (msg) {
                const base = msg.embeds && msg.embeds[0] ? EmbedBuilder.from(msg.embeds[0]) : new EmbedBuilder().setTitle('Giveaway');
                base.setDescription(`${base.data.description || ''}\n\nGewinner: ${winners.length ? winners.map(x => `<@${x}>`).join(', ') : 'niemand'}`);
                await msg.edit({ embeds: [base], components: [] }).catch(() => {});
              }
              if (winners.length) {
                await ch.send(`🎉 Glückwunsch an ${winners.map(x => `<@${x}>`).join(', ')} für **${g.prize}**!`).catch(() => {});
              }
            }
          }
        } finally {
          activeGiveaways.delete(id);
        }
      }, delay);
    }
    helpersModule = { activeGiveaways, saveGiveaways, startGiveawayTimer };
  }
  return helpersModule;
}
const { saveGiveaways, activeGiveaways, startGiveawayTimer } = getHelpers();
const cfg = (() => {
  try { return require('./config.json'); } catch { return {}; }
})();
const GIVEAWAY_CHANNEL_ID = process.env.GIVEAWAY_CHANNEL_ID || cfg.giveawayChannel || null;
const GIVEAWAY_EMOTE = cfg.giveawayEmote || '🎉';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Giveaway starten, verlängern oder löschen')
    .addSubcommand(sub =>
      sub.setName('start').setDescription('Neues Giveaway starten')
    )
    .addSubcommand(sub =>
      sub.setName('extend')
        .setDescription('Laufendes Giveaway verlängern')
        .addStringOption(opt => opt.setName('messageid').setDescription('ID der Giveaway-Nachricht').setRequired(true))
        .addStringOption(opt => opt.setName('zeit').setDescription('Dauer z.B. 1h, 30m').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Giveaway löschen')
        .addStringOption(opt => opt.setName('messageid').setDescription('ID der Giveaway-Nachricht').setRequired(true))
    ),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();

      if (sub === 'start') {
        const modal = new ModalBuilder()
          .setCustomId('giveawayStartModal')
          .setTitle('Giveaway starten')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('prize').setLabel('Preis').setStyle(TextInputStyle.Short).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('winners').setLabel('Anzahl Gewinner').setStyle(TextInputStyle.Short).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('duration').setLabel('Dauer (z.B. 1m, 1h, 1d)').setStyle(TextInputStyle.Short).setRequired(true)
            )
          );

        return await interaction.showModal(modal);
      }

      if (sub === 'extend') {
        const id = interaction.options.getString('messageid');
        const time = parseDurationString(interaction.options.getString('zeit'));
        const g = activeGiveaways.get(id);

        if (!g || !time) {
          return await interaction.reply({ content: '❌ Ungültige Eingabe oder Giveaway nicht gefunden.', ephemeral: true });
        }

        g.endTime += time;
        saveGiveaways();
        startGiveawayTimer(id, g);

        const channel = await interaction.client.channels.fetch(g.channelId).catch(() => null);
        if (!channel) return await interaction.reply({ content: '❌ Channel nicht gefunden.', ephemeral: true });

        const msg = await channel.messages.fetch(g.messageId).catch(() => null);
        if (!msg) return await interaction.reply({ content: '❌ Giveaway Nachricht nicht gefunden.', ephemeral: true });

        const endDateString = `<t:${Math.floor(g.endTime / 1000)}:R>`;
        const embed = EmbedBuilder.from(msg.embeds[0])
          .setDescription(`\n> Preis: **${g.prize}**\n> Gewinner: **${g.winnerCount}**\n> Endet: ${endDateString}\n\n\n> **Teilnehmer**: ${g.entries.length}\n\nKlicke auf ${GIVEAWAY_EMOTE} um teilzunehmen!\nErstellt von <@${g.creatorId}>`);

        await msg.edit({ embeds: [embed] });
        return await interaction.reply({ content: '✅ Giveaway verlängert und Embed aktualisiert.', ephemeral: true });
      }

      if (sub === 'delete') {
        const id = interaction.options.getString('messageid');
        const g = activeGiveaways.get(id);

        if (!g) return await interaction.reply({ content: '❌ Giveaway nicht gefunden.', ephemeral: true });

        const channel = await interaction.client.channels.fetch(g.channelId).catch(() => null);
        if (channel) {
          const msg = await channel.messages.fetch(g.messageId).catch(() => null);
          if (msg) await msg.delete().catch(() => null);
        }

        activeGiveaways.delete(id);
        saveGiveaways();
        return await interaction.reply({ content: '✅ Giveaway gelöscht und Nachricht entfernt.', ephemeral: true });
      }

    } catch (err) {
      console.error('Fehler bei /giveaway:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Interner Fehler. Bitte Admin informieren.', ephemeral: true });
      }
    }
  },

  async handleModal(interaction) {
    try {
      if (interaction.customId !== 'giveawayStartModal') return false;

      const prize = interaction.fields.getTextInputValue('prize');
      const winners = parseInt(interaction.fields.getTextInputValue('winners'));
      const duration = parseDurationString(interaction.fields.getTextInputValue('duration'));

      if (!prize || isNaN(winners) || !duration) {
        return await interaction.reply({ content: '❌ Ungültige Eingabe.', ephemeral: true });
      }

      if (!GIVEAWAY_CHANNEL_ID) {
        return await interaction.reply({ content: '❌ Giveaway-Channel nicht konfiguriert.', ephemeral: true });
      }

      const endTime = Date.now() + duration;
      const channel = interaction.guild.channels.cache.get(GIVEAWAY_CHANNEL_ID);
      if (!channel) return await interaction.reply({ content: '❌ Channel nicht gefunden.', ephemeral: true });

      const endDateString = `<t:${Math.floor(endTime / 1000)}:R>`;

      const embed = new EmbedBuilder()
        .setTitle('⚡ Neues Giveaway')
        .setDescription(`\n> Preis: **${prize}**\n> Gewinner: **${winners}**\n> Endet: ${endDateString}\n\n\n> **Teilnehmer**: 0\n\nKlicke auf ${GIVEAWAY_EMOTE} um teilzunehmen!\nErstellt von <@${interaction.user.id}>`)
        .setColor(0xC3DEFF);

      const button = new ButtonBuilder()
        .setCustomId('enterGiveaway')
        .setLabel('Teilnehmen')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(GIVEAWAY_EMOTE);

      const msg = await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });

      activeGiveaways.set(msg.id, {
        channelId: channel.id,
        messageId: msg.id,
        prize,
        winnerCount: winners,
        endTime,
        entries: [],
        creatorId: interaction.user.id,
        client: interaction.client
      });

      saveGiveaways();
      startGiveawayTimer(msg.id, activeGiveaways.get(msg.id));

      return await interaction.reply({ content: '✅ Giveaway gestartet!', ephemeral: true });
    } catch (err) {
      console.error('Fehler im ModalHandler:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Interner Fehler beim Modal.', ephemeral: true });
      }
      return true;
    }
  },

  async handleComponent(interaction) {
    try {
      if (interaction.customId !== 'enterGiveaway') return false;

      const g = activeGiveaways.get(interaction.message.id);
      if (!g) return await interaction.reply({ content: '❌ Giveaway nicht gefunden.', ephemeral: true });

      if (!g.entries.includes(interaction.user.id)) {
        g.entries.push(interaction.user.id);
        saveGiveaways();

        const endDateString = `<t:${Math.floor(g.endTime / 1000)}:R>`;
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setDescription(`\n> Preis: **${g.prize}**\n> Gewinner: **${g.winnerCount}**\n> Endet: ${endDateString}\n\n\n> **Teilnehmer**: ${g.entries.length}\n\nKlicke auf ${GIVEAWAY_EMOTE} um teilzunehmen!\nErstellt von <@${g.creatorId}>`);

        await interaction.message.edit({ embeds: [embed] });
        return await interaction.reply({ content: '✅ Teilnahme bestätigt!', ephemeral: true });
      } else {
        return await interaction.reply({ content: 'ℹ️ Du nimmst bereits teil.', ephemeral: true });
      }
    } catch (err) {
      console.error('Fehler im ComponentHandler:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Interner Fehler bei der Button-Interaktion.', ephemeral: true });
      }
      return true;
    }
  }
};
