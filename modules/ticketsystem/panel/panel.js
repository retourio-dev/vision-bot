const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const MODULE_CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  try {
    const raw = fs.readFileSync(MODULE_CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[ticketsystem] Konnte Modul-config.json nicht laden:', err);
    return null;
  }
}

async function deployPanel(client) {
  try {
    const config = loadConfig();
    if (!config) return;

    const panelConfig = config.ticketPanel;

    if (!panelConfig || !panelConfig.channelId) {
      console.error('[ticketsystem] ticketPanel.channelId fehlt in Modul-config.json!');
      return;
    }

    const channel = await client.channels.fetch(panelConfig.channelId);
    if (!channel) {
      console.error('[ticketsystem] Konnte Channel nicht finden.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(panelConfig.title || config.messages.panelTitle || 'Support Tickets')
      .setDescription(panelConfig.description || config.messages.panelDescription || 'Wähle eine Kategorie aus, um ein Ticket zu erstellen.')
      .setColor(0xC3DEFF);

    // Neues Feature: Bild-URL aus Config
    if (panelConfig.imageUrl) {
      embed.setImage(panelConfig.imageUrl);
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticketsystem:create')
      .setPlaceholder('Kategorie auswählen');

    for (const category of Object.values(config.ticketCategories || {})) {
      menu.addOptions({
        label: category.name,
        description: `Öffne ein Ticket in der Kategorie "${category.name}"`,
        emoji: category.emoji || null,
        value: category.key
      });
    }

    const row = new ActionRowBuilder().addComponents(menu);

    let message;
    if (panelConfig.messageId) {
      try {
        message = await channel.messages.fetch(panelConfig.messageId);
        await message.edit({ embeds: [embed], components: [row] });
        console.log('[ticketsystem] Panel aktualisiert.');
      } catch {
        console.warn('[ticketsystem] Konnte bestehendes Panel nicht finden, erstelle neues.');
        message = await channel.send({ embeds: [embed], components: [row] });
      }
    } else {
      message = await channel.send({ embeds: [embed], components: [row] });
      console.log('[ticketsystem] Neues Panel erstellt.');

      panelConfig.messageId = message.id;
      fs.writeFileSync(MODULE_CONFIG_PATH, JSON.stringify(config, null, 2));
      console.log('[ticketsystem] messageId in Modul-config.json gespeichert.');
    }

  } catch (err) {
    console.error('[ticketsystem] Fehler beim Deployen des Panels:', err);
  }
}

module.exports = { deployPanel };
