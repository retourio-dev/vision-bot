const { EmbedBuilder } = require('discord.js');
const { readModuleConfig, writeModuleConfig } = require('./configHelper');

function buildDashboardEmbed(cfg, nextUpdateTs) {
  const queue = cfg.counts?.warteliste || 0;
  const inProgress = cfg.counts?.inBearbeitung || 0;
  const fastLane = cfg.counts?.fastLane || 0;
  const total = queue + inProgress + fastLane;

  const statusEmoji = cfg.icons?.legend?.[cfg.statusLevel] || '';
  const etaByStatus = cfg.etaByStatus || {
    "1": "0–24h",
    "2": "1–2 Tage",
    "3": "2–4 Tage",
    "4": "4+ Tage"
  };
  const etaText = cfg.etaText || etaByStatus?.[String(cfg.statusLevel)] || "—";
  const deliveryLabel = cfg.labels?.deliveryTime || "Durchschnittliche Lieferzeit";
  const lastUpdateLabel = cfg.labels?.lastUpdate || "Letzte Aktualisierung";

  const legendLine = cfg.icons?.legend
    ? Object.entries(cfg.icons.legend).map(([level, icon]) => `${icon} ${level}`).join(' • ')
    : '';

  return new EmbedBuilder()
    .setTitle(cfg.labels.title)
    .setColor(cfg.colors.embed || '#c3deff')
    .addFields(
      { name: cfg.labels.currentStatus, value: `${statusEmoji}`, inline: true },
      { name: deliveryLabel, value: `⏱️ ${etaText}`, inline: true },
      { name: lastUpdateLabel, value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
      { name: cfg.labels.queue, value: `${cfg.icons.queue} ${queue}`, inline: true },
      { name: cfg.labels.inProgress, value: `${cfg.icons.inProgress} ${inProgress}`, inline: true },
      { name: cfg.labels.fastLane, value: `${cfg.icons.fastLane} ${fastLane}`, inline: true },
      { name: cfg.labels.total, value: `${cfg.icons.total} ${total}`, inline: true },
      { name: cfg.labels.legend, value: legendLine, inline: false },
      { name: cfg.labels.nextUpdate, value: `<t:${nextUpdateTs}:R>`, inline: true }
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
