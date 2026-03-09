const { EmbedBuilder } = require('discord.js');
const { readModuleConfig, writeModuleConfig } = require('./configHelper');

function buildDashboardEmbed(cfg, nextUpdateTs) {
  const queue = cfg.counts?.warteliste || 0;
  const inProgress = cfg.counts?.inBearbeitung || 0;
  const fastLane = cfg.counts?.fastLane || 0;
  const total = queue + inProgress + fastLane;

  const statusEmoji = cfg.icons?.legend?.[cfg.statusLevel] || '';

  return new EmbedBuilder()
    .setTitle(cfg.labels.title)
    .setColor(cfg.colors.embed || '#c3deff')
    .addFields(
      { name: cfg.labels.currentStatus, value: `${statusEmoji}`, inline: true },
      { name: cfg.labels.queue, value: `${cfg.icons.queue} ${queue}`, inline: true },
      { name: cfg.labels.inProgress, value: `${cfg.icons.inProgress} ${inProgress}`, inline: true },
      { name: cfg.labels.fastLane, value: `${cfg.icons.fastLane} ${fastLane}`, inline: true },
      { name: cfg.labels.total, value: `${cfg.icons.total} ${total}`, inline: true },
      {
        name: cfg.labels.legend,
        value: Object.entries(cfg.icons.legend)
          .map(([level, icon]) => `${icon} Status ${level}`)
          .join('\n'),
        inline: false
      },
      { name: cfg.labels.nextUpdate, value: `<t:${nextUpdateTs}:R>`, inline: false }
    );
}

async function upsertDashboardMessage(client, cfg, nextUpdateTs) {
  try {
    const channel = await client.channels.fetch(cfg.channelId);
    if (!channel) throw new Error('Channel nicht gefunden');

    const embed = buildDashboardEmbed(cfg, nextUpdateTs);
    let message;

    if (cfg.messageId) {
      try {
        message = await channel.messages.fetch(cfg.messageId);
      } catch {
        message = null;
      }
    }

    if (message) {
      await message.edit({ embeds: [embed] });
    } else {
      const sent = await channel.send({ embeds: [embed] });
      cfg.messageId = sent.id;
      writeModuleConfig(cfg);
    }
  } catch (err) {
    console.error('[dashboard] Fehler beim Updaten des Dashboard-Messages:', err);
  }
}

module.exports = { upsertDashboardMessage };
