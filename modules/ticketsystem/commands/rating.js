const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const path = require('path');
const { addRating } = require('../utils/ratingDb');
const { isTicketChannel } = require('../utils/ticketHelper');

function readConfig() {
  try {
    return require(path.join(__dirname, '..', 'config.json'));
  } catch {
    return {};
  }
}

async function countChannelMessages(channel) {
  let count = 0;
  let lastId = null;
  while (true) {
    const fetched = await channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
    if (!fetched || fetched.size === 0) break;
    count += fetched.size;
    lastId = fetched.last().id;
    if (fetched.size < 100) break;
  }
  return count;
}

function parseTicketIdFromTopic(topic) {
  if (!topic || typeof topic !== 'string') return null;
  const parts = topic.split('|').map(s => s.trim());
  for (const p of parts) {
    if (p.startsWith('id:')) return p.slice(3);
  }
  return null;
}

function starsToEmoji(n) {
  const v = Math.max(1, Math.min(5, Number(n) || 0));
  return '⭐'.repeat(v) + '☆'.repeat(5 - v);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rating')
    .setDescription('Bewertung für dieses Ticket sammeln'),

  async execute(interaction) {
    if (!isTicketChannel(interaction.channel)) {
      return interaction.reply({ content: '❌ Dieser Befehl kann nur in einem Ticket-Kanal verwendet werden.', ephemeral: true });
    }
    const button = new ButtonBuilder()
      .setCustomId('ticketsystem:rating:open')
      .setLabel('Bewertung schreiben')
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(button);
    return interaction.reply({ content: 'Bitte klicke auf den Button, um eine Bewertung abzugeben.', components: [row], ephemeral: false });
  },

  async handleComponent(interaction) {
    if (interaction.customId !== 'ticketsystem:rating:open') return false;
    if (!isTicketChannel(interaction.channel)) {
      await interaction.reply({ content: '❌ Dieser Button ist nur in Ticket-Kanälen gültig.', ephemeral: true });
      return true;
    }
    const modal = new ModalBuilder()
      .setCustomId('ticketsystem:rating:modal')
      .setTitle('Bewertung abgeben')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('stars').setLabel('Sterne (1-5)').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('comment').setLabel('Kommentar').setStyle(TextInputStyle.Paragraph).setRequired(true)
        )
      );
    await interaction.showModal(modal);
    return true;
  },

  async handleModal(interaction) {
    if (interaction.customId !== 'ticketsystem:rating:modal') return false;
    if (!isTicketChannel(interaction.channel)) {
      await interaction.reply({ content: '❌ Dieser Vorgang ist nur in Ticket-Kanälen möglich.', ephemeral: true });
      return true;
    }
    const starsRaw = interaction.fields.getTextInputValue('stars');
    const comment = interaction.fields.getTextInputValue('comment') || '';
    const stars = parseInt(starsRaw, 10);
    if (isNaN(stars) || stars < 1 || stars > 5) {
      await interaction.reply({ content: '❌ Bitte gib eine Zahl von 1 bis 5 ein.', ephemeral: true });
      return true;
    }
    const cfg = readConfig();
    const logChannelId = cfg.ratingLogsChannel || cfg.ticketLogsChannel || null;
    if (!logChannelId) {
      await interaction.reply({ content: '⚠️ Kein Bewertungs-Log-Kanal konfiguriert.', ephemeral: true });
      return true;
    }
    const logChannel = interaction.guild.channels.cache.get(logChannelId) || await interaction.guild.channels.fetch(logChannelId).catch(() => null);
    if (!logChannel) {
      await interaction.reply({ content: '⚠️ Bewertungs-Log-Kanal nicht gefunden.', ephemeral: true });
      return true;
    }
    const totalMessages = await countChannelMessages(interaction.channel).catch(() => 0);
    const ticketId = parseTicketIdFromTopic(interaction.channel.topic) || '';
    const now = new Date();
    const dateStr = now.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
    const starsText = `${starsToEmoji(stars)} (${stars}/5)`;
    const embed = new EmbedBuilder()
      .setTitle('➕ Kundenbewertung')
      .setColor(0xc3deff)
      .setImage(cfg.ratingHeaderImage || 'https://via.placeholder.com/1600x400.png?text=Kundenbewertung')
      .addFields(
        { name: 'ℹ️ Kunde', value: `${interaction.user} (${interaction.user.id})`, inline: false },
        { name: '⭐ Sterne', value: starsText, inline: true },
        { name: '💡 Nachrichten im Ticket', value: String(totalMessages), inline: true },
        { name: '📝 Kommentar', value: comment.slice(0, 1000), inline: false },
        { name: '🗓️ Datum', value: dateStr, inline: false }
      );
    await logChannel.send({ embeds: [embed] }).catch(() => {});
    addRating({
      userId: interaction.user.id,
      channelId: interaction.channel.id,
      ticketId,
      stars,
      comment,
      messageCount: totalMessages
    });
    await interaction.reply({ content: '✅ Danke für deine Bewertung!', ephemeral: true });
    return true;
  }
};
