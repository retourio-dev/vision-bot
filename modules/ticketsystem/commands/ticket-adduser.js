const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const permissions = require("../utils/permissions");
const path = require("path");
const fs = require("fs");

// Config laden
const configPath = path.join(__dirname, "../config.json");
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (err) {
  console.error("[ticket-adduser] Konnte config.json nicht laden:", err);
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

// Ticket-Check aus Hauptsystem laden
let isTicketChannel;
try {
  ({ isTicketChannel } = require("../ticketsystem/ticketManager")); // Datei, in der wir `isTicketChannel` exportieren
} catch {
  // Fallback, falls die Funktion nicht geladen werden kann
  isTicketChannel = (channel) => channel?.topic?.includes("TICKET:true");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-adduser")
    .setDescription("Fügt einen Benutzer zum Ticket hinzu.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Der Benutzer, der hinzugefügt werden soll")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      // Berechtigung prüfen
      if (!permissions.hasCommandPermission(interaction.member, config)) {
        return interaction.reply({ content: "❌ Keine Berechtigung.", ephemeral: true });
      }

      const target = interaction.options.getUser("user", true);
      const channel = interaction.channel;

      // Prüfen ob es ein Ticket-Channel ist
      if (!isTicketChannel(channel)) {
        return interaction.reply({ content: "❌ Dies ist kein Ticket-Kanal.", ephemeral: true });
      }

      // Rechte hinzufügen
      await channel.permissionOverwrites.edit(target.id, {
        ViewChannel: true,
        SendMessages: true
      });

      logger.info(`[ticket-adduser] ${target.tag} zu Ticket ${channel.name} hinzugefügt.`);

      // Optional ins Log-Channel posten
      if (config.ticketLogsChannel) {
        const logChannel = interaction.guild.channels.cache.get(config.ticketLogsChannel);
        if (logChannel) {
          logChannel.send(`📥 **${target.tag}** wurde von **${interaction.user.tag}** zu Ticket <#${channel.id}> hinzugefügt.`);
        }
      }

      await interaction.reply({ content: `✅ ${target.tag} wurde zum Ticket hinzugefügt.`, ephemeral: true });

    } catch (err) {
      logger.error("[ticket-adduser] Fehler:", err);
      if (!interaction.replied) {
        await interaction.reply({ content: "❌ Fehler beim Hinzufügen des Benutzers.", ephemeral: true });
      }
    }
  }
};
