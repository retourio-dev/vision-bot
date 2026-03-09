const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setCustomer } = require('../utils/customerDb');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pcustomer')
    .setDescription('Premium-Kundenverwaltung')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Verleiht die Rolle Premium Customer und speichert den Kunden')
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
      const roleId = '1403382106565902397';
      await member.roles.add(roleId).catch(() => {});
      setCustomer(user.id, 'premium', { addedBy: interaction.user.id });
      return interaction.reply({ content: `✅ ${user} ist nun Premium Customer.`, ephemeral: true });
    } catch {
      return interaction.reply({ content: '❌ Fehler beim Ausführen.', ephemeral: true });
    }
  }
};
