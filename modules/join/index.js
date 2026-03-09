const { EmbedBuilder } = require('discord.js');
const joinConfig = require('./config.json');

module.exports = (client) => {
  if (client._joinModuleRegistered) return;
  client._joinModuleRegistered = true;

  client.on('guildMemberAdd', async (member) => {
    const timestamp = new Date().toLocaleString('de-DE');

    // Auto-Role zuweisen
    const autoRoleId = joinConfig.autoRoleId;
    if (autoRoleId) {
      const role = member.guild.roles.cache.get(autoRoleId);
      if (role) {
        try {
          await member.roles.add(role);
          console.log(`✅ Rolle "${role.name}" wurde ${member.user.tag} zugewiesen.`);
        } catch (err) {
          console.error(`❌ Fehler beim Zuweisen der Rolle:`, err);
        }
      } else {
        console.warn(`⚠️ Rolle mit ID ${autoRoleId} nicht gefunden.`);
      }
    }

    // Join-Channel holen
    const channel = member.guild.channels.cache.get(joinConfig.channelId);
    if (!channel) return;

    // Embed bauen
    const embed = new EmbedBuilder();

    if (joinConfig.embed?.color) {
      embed.setColor(joinConfig.embed.color);
    }

    // Beschreibung zusammensetzen mit Ping des Users
    let description = `<@${member.user.id}>, willkommen auf **${member.guild.name}**`;

    // Leerzeile hinzufügen
    description += `\n`;

    // Channels mit grauem Balken (\n> ...) und fett (Discord zeigt fett text standardmäßig in Weiß)
    if (Array.isArray(joinConfig.embed?.fields)) {
      for (const field of joinConfig.embed.fields) {
        description += `\n> <#${field.channelId}> | **${field.label}**`;
      }
    }

    // Leerzeile und dann Abschlusstext
    description += `\n\nSchön, dass Du hier bist! **Entdecke** unsere Botmodule und gestalte aktiv die Zukunft **deines** Servers mit uns.`;

    embed.setDescription(description);

    // Bild
    if (joinConfig.embed?.image) {
      embed.setImage(joinConfig.embed.image);
    }

    // Footer mit Text und Servericon
    if (joinConfig.embed?.footer?.text) {
      embed.setFooter({
        text: joinConfig.embed.footer.text.replace('{timestamp}', timestamp),
        iconURL: member.guild.iconURL({ extension: 'png', size: 64 }) || undefined
      });
    }

    // Nachricht senden
    try {
      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Fehler beim Senden der Join-Nachricht:', err);
    }
  });
};
