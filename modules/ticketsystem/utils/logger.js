const { EmbedBuilder } = require('discord.js');

async function logEvent(client, cfg, type, data = {}) {
  try {
    const ch = await client.channels.fetch(cfg.ticketLogsChannel);
    if (!ch) return;
    const embed = new EmbedBuilder()
      .setTitle(`Ticket Event: ${type}`)
      .setTimestamp(new Date())
      .setColor(type === 'created' ? 0x2ecc71 : type === 'closed' ? 0xe74c3c : 0x3498db)
      .addFields(
        { name: 'Channel', value: data.channel ? `${data.channel.name} (${data.channel.id})` : '—', inline: true },
        { name: 'User', value: data.user ? `${data.user.tag} (${data.user.id})` : '—', inline: true },
        { name: 'Info', value: data.info ? `${data.info}` : (data.target ? `${data.target.tag} (${data.target.id})` : '—'), inline: false }
      );
    await ch.send({ embeds: [embed] });
  } catch (e) {
    console.error('[ticketsystem] logEvent error', e);
  }
}

module.exports = { logEvent };
