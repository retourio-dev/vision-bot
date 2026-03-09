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
  console.error("[ticket-removeuser] Konnte config.json nicht laden:", err);
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
    .setName("ticket-removeuser")
    .setDescription("Entfernt einen Benutzer aus diesem Ticket.")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Der Benutzer, der entfernt werden soll.")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      // Berechtigungen prüfen
      if (!permissions.hasCommandPermission(interaction.member, config)) {
        return interaction.reply({ content: "❌ Keine Berechtigung.", ephemeral: true });
      }

      const target = interaction.options.getUser("user", true);

      // Prüfen, ob der Channel ein Ticket ist
      if (!isTicketChannel(interaction.channel)) {
        return interaction.reply({ content: "❌ Dies ist kein Ticket-Kanal.", ephemeral: true });
      }

      // Schreib- & Leserechte entziehen
      await interaction.channel.permissionOverwrites.edit(target.id, { ViewChannel: false });

      logger.info(`[ticket-removeuser] ${target.tag} wurde aus Ticket ${interaction.channel.name} entfernt von ${interaction.user.tag}.`);

      await interaction.reply({ content: `✅ ${target.tag} wurde aus dem Ticket entfernt.`, ephemeral: true });

    } catch (err) {
      logger.error("[ticket-removeuser] Fehler beim Entfernen eines Benutzers:", err);
      await interaction.reply({ content: "❌ Fehler beim Entfernen des Benutzers aus dem Ticket.", ephemeral: true });
    }
  }
};
