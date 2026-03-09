const { SlashCommandBuilder } = require("discord.js");
const permissions = require("../utils/permissions");
const path = require("path");
const fs = require("fs");

// Ticket-Helper importieren (mit handleClose)
const ticketHelper = require("../utils/ticketHelper");

// Config laden
const configPath = path.join(__dirname, "../config.json");
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (err) {
  console.error("[ticket-close] Konnte config.json nicht laden:", err);
  config = {};
}

// Logger laden
let logger;
try {
  const importedLogger = require("../../logger");
  logger = {
    info: importedLogger.info || console.log,
    warn: importedLogger.warn || console.warn,
    error: importedLogger.error || console.error
  };
} catch {
  logger = { info: console.log, warn: console.warn, error: console.error };
}

// Ticket-Erkennung
function isTicketChannel(channel) {
  return channel?.topic?.includes("TICKET:true");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-close")
    .setDescription("Schließt das aktuelle Ticket."),

  async execute(interaction) {
    try {
      // Berechtigung prüfen
      if (!permissions.hasCommandPermission(interaction.member, config)) {
        return interaction.reply({ content: "❌ Keine Berechtigung.", ephemeral: true });
      }

      // Prüfen ob es ein Ticket-Channel ist
      if (!isTicketChannel(interaction.channel)) {
        return interaction.reply({ content: "❌ Dies ist kein Ticket-Kanal.", ephemeral: true });
      }

      logger.info(`[ticket-close] Ticket ${interaction.channel.name} wird von ${interaction.user.tag} geschlossen.`);

      // handleClose aus ticketHelper nutzen
      await ticketHelper.handleClose(interaction);

    } catch (err) {
      logger.error("[ticket-close] Fehler beim Schließen des Tickets:", err);
      if (!interaction.replied) {
        await interaction.reply({ content: "❌ Fehler beim Schließen des Tickets.", ephemeral: true });
      }
    }
  }
};
