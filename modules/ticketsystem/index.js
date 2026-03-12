const fs = require('fs');
const path = require('path');
const ticketHelper = require('./utils/ticketHelper');
const logger = require('./utils/logger');
const ratingCommand = require('./commands/rating');

const MODULE_CONFIG_PATH = path.join(__dirname, 'config.json');

// Config-Loader
function loadModuleConfig() {
  try {
    return JSON.parse(fs.readFileSync(MODULE_CONFIG_PATH, 'utf8'));
  } catch (err) {
    console.error('[ticketsystem] Fehler beim Laden der Modul-config:', err);
    return null;
  }
}
function noop() {}

module.exports = {
  onReady: async function (client) {
    const moduleConfig = loadModuleConfig();
    if (!moduleConfig) {
      console.error('[ticketsystem] Modul-Config konnte nicht geladen werden — Abbruch.');
      return;
    }

    // Panel deployen
    try {
      const panel = require('./panel/panel');
      await panel.deployPanel(client, moduleConfig);
      console.log('[ticketsystem] Panel deployed/aktualisiert.');
    } catch (e) {
      console.warn('[ticketsystem] Panel deploy skipped:', e?.message || e);
    }

    if (!client._ticketsystemPanelWatchRegistered) {
      client._ticketsystemPanelWatchRegistered = true;

      const redeployIfMatches = async (channelId, messageId) => {
        try {
          const cfg = loadModuleConfig();
          const panelCfg = cfg?.ticketPanel;
          if (!panelCfg?.messageId || !panelCfg?.channelId) return;
          if (String(panelCfg.messageId) !== String(messageId)) return;
          if (String(panelCfg.channelId) !== String(channelId)) return;
          const panel = require('./panel/panel');
          await panel.deployPanel(client);
        } catch (e) {
          console.error('[ticketsystem] Fehler beim Wiederherstellen des Panels:', e);
        }
      };

      client.on('raw', async (packet) => {
        try {
          if (!packet?.t || !packet?.d) return;
          if (packet.t === 'MESSAGE_DELETE') {
            await redeployIfMatches(packet.d.channel_id, packet.d.id);
          } else if (packet.t === 'MESSAGE_DELETE_BULK') {
            const channelId = packet.d.channel_id;
            const ids = Array.isArray(packet.d.ids) ? packet.d.ids : [];
            if (ids.length === 0) return;
            const cfg = loadModuleConfig();
            const panelCfg = cfg?.ticketPanel;
            if (!panelCfg?.messageId || !panelCfg?.channelId) return;
            if (String(panelCfg.channelId) !== String(channelId)) return;
            if (!ids.map(String).includes(String(panelCfg.messageId))) return;
            await redeployIfMatches(panelCfg.channelId, panelCfg.messageId);
          }
        } catch {}
      });
    }

    console.log('[ticketsystem] initialized');
  },

  handleComponent: async function (interaction) {
    const moduleConfig = loadModuleConfig();
    if (!moduleConfig) return false;

    try {
      if (interaction.isStringSelectMenu?.() || interaction.isSelectMenu?.()) {
        if (interaction.customId === 'ticketsystem:create') {
          const categoryKey = Array.isArray(interaction.values) ? interaction.values[0] : null;
          if (!categoryKey) {
            await interaction.reply({ content: '❌ Ungültige Auswahl.', ephemeral: true });
            return true;
          }
          await ticketHelper.createTicketFromPanel(interaction, moduleConfig, categoryKey);
          return true;
        }
      }

      if (interaction.isButton?.()) {
        const id = interaction.customId;
        if (!id) return false;

        if (id === 'ticketsystem:close') {
          await ticketHelper.handleClose(interaction);
          return true;
        }
        if (id === 'ticketsystem:confirmClose') {
          if (typeof ticketHelper.confirmClose === 'function') {
            await ticketHelper.confirmClose(interaction);
          }
          return true;
        }
        if (id === 'ticketsystem:cancelClose') {
          try {
            await interaction.reply({ content: '❌ Schließen abgebrochen.', ephemeral: true });
          } catch {}
          return true;
        }
        if (id === 'ticketsystem:rating:open') {
          if (typeof ratingCommand.handleComponent === 'function') {
            const handled = await ratingCommand.handleComponent(interaction);
            if (handled) return true;
          }
        }
      }
    } catch (err) {
      console.error('[ticketsystem] Fehler in handleComponent:', err);
      try {
        if (!interaction.replied) {
          await interaction.reply({ content: 'Ein Fehler ist aufgetreten.', ephemeral: true });
        }
      } catch {}
      return true;
    }

    return false;
  },

  handleModal: async function (interaction) {
    try {
      if (typeof ratingCommand.handleModal === 'function') {
        const handled = await ratingCommand.handleModal(interaction);
        if (handled) return true;
      }
    } catch (err) {
      console.error('[ticketsystem] Fehler in handleModal:', err);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Ein Fehler ist aufgetreten.', ephemeral: true });
        }
      } catch {}
      return true;
    }

    return false;
  }
};
