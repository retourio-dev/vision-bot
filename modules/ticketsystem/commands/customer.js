const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setCustomer } = require('../utils/customerDb');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('customer')
    .setDescription('Kundenverwaltung')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Verleiht die Rolle Customer und speichert den Kunden')
        .addUserOption(opt => opt.setName('user').setDescription('Ziel-User').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const memberPerms = interaction.member?.permissions;
      if (!memberPerms || !memberPerms.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Nur Administratoren dürfen diesen Befehl verwenden.', ephemeral: true });
      }
      const sub = interaction.options.getSubcommand();
      if (sub !== 'add') {
        return interaction.reply({ content: '❌ Unbekannte Aktion.', ephemeral: true });
      }
      const user = interaction.options.getUser('user', true);
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        return interaction.reply({ content: '❌ Mitglied nicht gefunden.', ephemeral: true });
      }
      const roleId = '1403381977834455080';
      const role = interaction.guild.roles.cache.get(roleId) || await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (!role) {
        return interaction.reply({ content: '⚠️ Rolle „Customer“ existiert nicht oder ist nicht erreichbar.', ephemeral: true });
      }
      await member.roles.add(role).catch((e) => {
        throw new Error('Rolle konnte nicht vergeben werden. Prüfe Bot-Berechtigungen und Rollen-Hierarchie.');
      });
      setCustomer(user.id, 'customer', { addedBy: interaction.user.id });
      return interaction.reply({ content: `✅ ${user} ist nun Customer.`, ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: `❌ Fehler: ${e?.message || 'beim Ausführen'}`, ephemeral: true });
    }
  }
};
