const fs = require('fs');
const path = require('path');
const ticketHelper = require('./utils/ticketHelper');
const logger = require('./utils/logger');

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
  }
};
