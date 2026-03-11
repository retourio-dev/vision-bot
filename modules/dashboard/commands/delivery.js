const { SlashCommandBuilder } = require('discord.js');
const { readModuleConfig, writeModuleConfig } = require('../utils/configHelper');
const { upsertDashboardMessage } = require('../utils/messageHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delivery')
    .setDescription('Lieferübersicht im Dashboard pflegen')
    .addSubcommand(sub =>
      sub.setName('warteliste')
        .setDescription('Warteliste-Zähler setzen')
        .addIntegerOption(o => o.setName('anzahl').setDescription('Wert').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('bearbeitung')
        .setDescription('Zähler In Bearbeitung setzen')
        .addIntegerOption(o => o.setName('anzahl').setDescription('Wert').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('fastlane')
        .setDescription('Fast Lane-Zähler setzen')
        .addIntegerOption(o => o.setName('anzahl').setDescription('Wert').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const value = interaction.options.getInteger('anzahl', true);
    const cfg = readModuleConfig();
    const counts = cfg.counts || { warteliste: 0, inBearbeitung: 0, fastLane: 0 };

    if (sub === 'warteliste') counts.warteliste = value;
    else if (sub === 'bearbeitung') counts.inBearbeitung = value;
    else if (sub === 'fastlane') counts.fastLane = value;
    else return interaction.reply({ content: '❌ Unbekannte Aktion.', ephemeral: true });

    cfg.counts = counts;
    writeModuleConfig(cfg);
    const nextTs = Math.floor((Date.now() + (cfg.updateIntervalSec || 300) * 1000) / 1000);
    await upsertDashboardMessage(interaction.client, cfg, nextTs);
    return interaction.reply({ content: `✅ ${sub} auf ${value} gesetzt.`, ephemeral: true });
  }
};
