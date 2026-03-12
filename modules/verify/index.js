const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
  MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Globale Warteschlange
const interactionQueue = [];
let processing = false;

module.exports = (client) => {
  if (client._verifyModuleRegistered) return;
  client._verifyModuleRegistered = true;

  client.on(Events.GuildMemberAdd, async member => {
    try {
      const role = member.guild.roles.cache.get(config.unverifiedRoleId);
      if (role) await member.roles.add(role);
    } catch (err) {
      console.error('[Verify] Fehler beim Hinzufügen der Unverified-Rolle:', err);
    }
  });

  client.once(Events.ClientReady, async () => {
    await sendOrUpdateVerifyEmbed(client);
  });

  client.on('raw', async (packet) => {
    try {
      if (!packet?.t || !packet?.d) return;
      if (!config?.messageId || !config?.verifyChannelId) return;

      if (packet.t === 'MESSAGE_DELETE') {
        const deletedId = String(packet.d.id);
        const deletedChannelId = String(packet.d.channel_id);
        if (deletedId !== String(config.messageId)) return;
        if (deletedChannelId !== String(config.verifyChannelId)) return;
      } else if (packet.t === 'MESSAGE_DELETE_BULK') {
        const deletedChannelId = String(packet.d.channel_id);
        if (deletedChannelId !== String(config.verifyChannelId)) return;
        const ids = Array.isArray(packet.d.ids) ? packet.d.ids.map(String) : [];
        if (!ids.includes(String(config.messageId))) return;
      } else {
        return;
      }

      await sendOrUpdateVerifyEmbed(client);
    } catch (e) {
      console.error('[Verify] Fehler beim Wiederherstellen nach Löschung:', e);
    }
  });

  async function sendOrUpdateVerifyEmbed(client) {
    const channel = await client.channels.fetch(config.verifyChannelId).catch(() => null);
    if (!channel) {
      console.error("[Verify] Verify-Channel nicht gefunden!");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(config.embed.title)
      .setDescription(config.embed.description)
      .setColor(config.embed.color)
      .setImage(config.embed.image);

    const button = new ButtonBuilder()
      .setCustomId('verify_start')
      .setLabel(config.button.label)
      .setStyle(ButtonStyle[config.button.style]);

    const row = new ActionRowBuilder().addComponents(button);

    if (config.messageId) {
      try {
        const message = await channel.messages.fetch(config.messageId);
        await message.edit({ embeds: [embed], components: [row] });
        console.log("[Verify] Panel aktualisiert.");
        return;
      } catch {
        console.warn("[Verify] Konnte bestehendes Panel nicht finden. Sende neues...");
      }
    }

    const sentMessage = await channel.send({ embeds: [embed], components: [row] });
    config.messageId = sentMessage.id;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("[Verify] Panel erstellt und messageId gespeichert.");
  }

  // Haupt-Listener → packt alles in Queue
  client.on(Events.InteractionCreate, interaction => {
    interaction._receivedAt = Date.now(); // Zeit merken
    interactionQueue.push(interaction);
    processQueue();
  });

  async function processQueue() {
    if (processing) return;
    processing = true;

    while (interactionQueue.length > 0) {
      const interaction = interactionQueue.shift();

      try {
        // BUTTON: Verify starten
        if (interaction.isButton() && interaction.customId === 'verify_start') {
          if (Date.now() - interaction._receivedAt > 2500) continue; // Zu alt → überspringen

          const num1 = randomInt(config.mathChallenge.min, config.mathChallenge.max);
          const num2 = randomInt(config.mathChallenge.min, config.mathChallenge.max);

          await interaction.showModal(
            new ModalBuilder()
              .setCustomId(`verify_modal_${num1}_${num2}`)
              .setTitle('Verifizierung')
              .addComponents(
                new ActionRowBuilder().addComponents(
                  new TextInputBuilder()
                    .setCustomId('answer')
                    .setLabel(`Was ist ${num1} + ${num2}?`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                )
              )
          ).catch(() => {});
          continue;
        }

        // MODAL: Antwort prüfen
        if (interaction.isModalSubmit() && interaction.customId.startsWith('verify_modal_')) {
          if (Date.now() - interaction._receivedAt > 2500) continue; // Zu alt → überspringen

          const [, , num1, num2] = interaction.customId.split('_');
          const correctAnswer = parseInt(num1) + parseInt(num2);
          const userAnswer = parseInt(interaction.fields.getTextInputValue('answer'));

          // deferReply nur, wenn noch gültig
          await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

          if (userAnswer === correctAnswer) {
            const member = interaction.member;

            if (Array.isArray(config.verifiedRoleIds)) {
              for (const roleId of config.verifiedRoleIds) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) await member.roles.add(role).catch(() => {});
              }
            } else {
              const role = member.guild.roles.cache.get(config.verifiedRoleId);
              if (role) await member.roles.add(role).catch(() => {});
            }

            const unverifiedRole = member.guild.roles.cache.get(config.unverifiedRoleId);
            if (unverifiedRole) {
              await member.roles.remove(unverifiedRole).catch(() => {});
            }

            await interaction.editReply({ content: config.messages.correct }).catch(() => {});
          } else {
            await interaction.editReply({ content: config.messages.incorrect }).catch(() => {});
          }
        }

      } catch (err) {
        console.error('[Verify] Fehler bei Interaction:', err);
      }
    }

    processing = false;
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
};
