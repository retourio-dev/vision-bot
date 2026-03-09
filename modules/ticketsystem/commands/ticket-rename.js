const { SlashCommandBuilder } = require("discord.js");
const permissions = require("../utils/permissions");
const path = require("path");
const fs = require("fs");

// Config laden
const configPath = path.join(__dirname, "../config.json");
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (err) {
  console.error("[ticket-rename] Konnte config.json nicht laden:", err);
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
    .setName("ticket-rename")
    .setDescription("Benennt das aktuelle Ticket um.")
    .addStringOption(opt =>
      opt.setName("name")
        .setDescription("Neuer Ticket-Name")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      // Berechtigungen prüfen
      if (!permissions.hasCommandPermission(interaction.member, config)) {
        return interaction.reply({ content: "❌ Keine Berechtigung.", ephemeral: true });
      }

      const name = interaction.options.getString("name", true);

      // Prüfen, ob der Channel ein Ticket ist
      if (!isTicketChannel(interaction.channel)) {
        return interaction.reply({ content: "❌ Dies ist kein Ticket-Kanal.", ephemeral: true });
      }

      // Neuen Namen setzen
      await interaction.channel.setName(name);

      // Topic beibehalten oder erstellen
      let currentTopic = interaction.channel.topic || "";
      if (!currentTopic.includes("TICKET:true")) {
        currentTopic = (currentTopic ? currentTopic + " " : "") + "TICKET:true";
      }
      await interaction.channel.setTopic(currentTopic);

      logger.info(`[ticket-rename] Ticket ${interaction.channel.id} umbenannt in "${name}" von ${interaction.user.tag}.`);

      await interaction.reply({ content: `✅ Ticket umbenannt zu: \`${name}\``, ephemeral: true });

    } catch (err) {
      logger.error("[ticket-rename] Fehler beim Umbenennen des Tickets:", err);
      await interaction.reply({ content: "❌ Fehler beim Umbenennen des Tickets.", ephemeral: true });
    }
  }
};
