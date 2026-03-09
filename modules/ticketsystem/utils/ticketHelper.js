const fs = require("fs");
const path = require("path");
const { PermissionFlagsBits, ChannelType, MessageFlags, EmbedBuilder } = require("discord.js");

const configPath = path.join(__dirname, "..", "config.json");
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (err) {
  console.error("[ticketsystem] Konnte config.json nicht laden:", err);
  config = {};
}

// Logger-Fallback
let logger;
try {
  const importedLogger = require("../logger");
  logger = {
    info: importedLogger.info || console.log,
    warn: importedLogger.warn || console.warn,
    error: importedLogger.error || console.error
  };
} catch {
  logger = { info: console.log, warn: console.warn, error: console.error };
}

const ticketCounterPath = path.join(__dirname, "..", "ticketCounter.json");
function getNextTicketNumber() {
  let counter = 0;
  try {
    if (fs.existsSync(ticketCounterPath)) {
      const data = JSON.parse(fs.readFileSync(ticketCounterPath, "utf8"));
      counter = data.counter || counter;
    }
  } catch {}
  counter++;
  fs.writeFileSync(ticketCounterPath, JSON.stringify({ counter }), "utf8");
  return String(counter).padStart(4, "0");
}

// Ticket-Kanalerkennung
function isTicketChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildText) return false;
  if (!channel.topic) return false;
  return channel.topic.includes("TICKET:true");
}

async function createTicketFromPanel(interaction, config, categoryKey) {
  try {
    const category = config.ticketCategories?.[categoryKey];

    if (!category) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Ungültige Ticket-Kategorie.",
          flags: MessageFlags.Ephemeral
        });
      }
      return;
    }

    const ticketNumber = getNextTicketNumber();
    const ticketId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const channelName = `${config.botSettings?.ticketChannelPrefix?.replace("{key}", category.key || categoryKey) || "ticket-"}${interaction.user.username}`;
    const permissionOverwrites = [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      { id: category.teamRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
    ];

    const ticketChannel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.categoryId || null,
      permissionOverwrites
    });

    // Wichtig: Ticket-Info im Topic speichern
    await ticketChannel.setTopic(`TICKET:true|id:${ticketId}|creator:${interaction.user.id}|category:${categoryKey}`);

    logger.info(`[ticketsystem] Ticket erstellt: ${ticketChannel.name}`);

    const date = new Date();
    const formattedDate = date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

    const embed = new EmbedBuilder()
      .setColor(0xc3deff)
      .setTitle(`Support Ticket #${ticketId}`)
      .setDescription(`Hallo, ${interaction.user}!\n\nBitte haben Sie einen Moment Geduld, unser <@&${category.teamRoleId}> wird sich so schnell wie möglich um Sie kümmern.`)
      .addFields(
        { name: "Anliegen", value: category.name || "Allgemeiner Support" },
        { name: "Erstellt von", value: interaction.user.username, inline: false },
        { name: "Erstellt", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
        { name: "ID", value: ticketId, inline: false },
        { name: "Nummer", value: `#${ticketNumber}`, inline: false }
      )
      .setFooter({
        text: `VISION-BOTS · ${formattedDate}`,
        iconURL: interaction.guild.iconURL({ dynamic: true })
      });

    await ticketChannel.send({
      content: `Ping: ${interaction.user} | <@&${category.teamRoleId}>`,
      embeds: [embed],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 4,
              label: "Close Ticket",
              custom_id: "ticketsystem:close"
            }
          ]
        }
      ]
    });

    const replyData = {
      content: config.messages?.ticketCreated
        ? config.messages.ticketCreated
            .replace("{user}", `<@${interaction.user.id}>`)
            .replace("{channel}", `<#${ticketChannel.id}>`)
        : `✅ Ticket erstellt: <#${ticketChannel.id}>`,
      flags: MessageFlags.Ephemeral
    };

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(replyData);
    } else if (typeof interaction.followUp === "function") {
      await interaction.followUp(replyData);
    }

    if (config.ticketLogsChannel) {
      const logsChannel = interaction.guild.channels.cache.get(config.ticketLogsChannel);
      if (logsChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle("📩 Neues Ticket erstellt")
          .addFields(
            { name: "Ticket", value: `<#${ticketChannel.id}>`, inline: true },
            { name: "Erstellt von", value: `${interaction.user} (${interaction.user.id})`, inline: true },
            { name: "Kategorie", value: category.name, inline: true }
          )
          .setTimestamp();
        logsChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }
  } catch (err) {
    logger.error("[ticketsystem] Fehler beim Erstellen des Tickets:", err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Es gab einen Fehler beim Erstellen des Tickets.",
        flags: MessageFlags.Ephemeral
      });
    }
  }
}

async function handleClose(interaction) {
  try {
    if (!isTicketChannel(interaction.channel)) {
      return interaction.reply({ content: "❌ Dies ist kein Ticket-Kanal.", flags: MessageFlags.Ephemeral });
    }

    const closedCategoryId = config.ticketClosedCategory || null;
    if (!closedCategoryId) {
      return interaction.reply({
        content: "⚠️ Keine 'ticketClosedCategory' in config.json definiert.",
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.reply({ content: "📁 Ticket wird geschlossen...", flags: MessageFlags.Ephemeral });

    await interaction.channel.setParent(closedCategoryId, { lockPermissions: true });

    await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
      SendMessages: false,
      ViewChannel: true
    });

    await interaction.channel.send(`🔒 Dieses Ticket wurde von ${interaction.user} geschlossen und wird in 1 Stunde automatisch gelöscht.`);

    if (config.ticketLogsChannel) {
      const logsChannel = interaction.guild.channels.cache.get(config.ticketLogsChannel);
      if (logsChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("🔒 Ticket geschlossen")
          .addFields(
            { name: "Ticket", value: `${interaction.channel.name}`, inline: true },
            { name: "Geschlossen von", value: `${interaction.user} (${interaction.user.id})`, inline: true }
          )
          .setTimestamp();
        logsChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }

    setTimeout(() => {
      interaction.channel.delete().catch(err => logger.error("[ticketsystem] Fehler beim automatischen Löschen:", err));
    }, 60 * 60 * 1000);

  } catch (err) {
    logger.error("[ticketsystem] Fehler beim Schließen des Tickets:", err);
    if (!interaction.replied) {
      interaction.reply({ content: "❌ Fehler beim Schließen des Tickets.", flags: MessageFlags.Ephemeral });
    }
  }
}

module.exports = { createTicketFromPanel, handleClose, isTicketChannel };
