const { EmbedBuilder, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

module.exports = (client) => {
  // verhindert doppelte Registrierung bei mehrfachen Modul-Loads
  if (client.supportNotifyLoaded) return;
  client.supportNotifyLoaded = true;

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
      // Prüfen: User ist in WaitingRoom gejoined (und kam nicht aus dem gleichen Channel)
      if (newState.channelId === config.waitingRoomChannelId && oldState.channelId !== config.waitingRoomChannelId) {
        
        const notifyChannel = await client.channels.fetch(config.notifyChannelId).catch(() => null);
        if (!notifyChannel) return console.error("[SupportNotify] Notify-Channel nicht gefunden!");

        const roleMention = `<@&${config.supportRoleId}>`;
        const userMention = `<@${newState.id}>`;

        const description = config.embed.description
          .replace("{user}", userMention)
          .replace("{roleId}", config.supportRoleId);

        const guildIcon = newState.guild.iconURL({ dynamic: true, size: 1024 });
        const userAvatar = newState.member?.user?.displayAvatarURL({ dynamic: true, size: 1024 });
        const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

        const embed = new EmbedBuilder()
          .setTitle(config.embed.title || "Support Notify")
          .setDescription(description) // Ping ist hier schon in der Config enthalten
          .setColor(config.embed.color || "#00ff00")
          .setThumbnail(userAvatar || null)
          .setFooter({
            text: `VISION-BOTS · ${time}`,
            iconURL: guildIcon || undefined
          });

        await notifyChannel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error("[SupportNotify] Fehler:", err);
    }
  });
};
