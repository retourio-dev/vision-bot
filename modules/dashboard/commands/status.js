const { SlashCommandBuilder } = require('discord.js');
const { readModuleConfig, writeModuleConfig } = require("../utils/configHelper");
const { upsertDashboardMessage } = require("../utils/messageHelper");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Setzt den aktuellen Status im Dashboard")
    .addIntegerOption(opt =>
      opt.setName("level")
        .setDescription("Status-Level (1 = 🟢, 2 = 🟡, 3 = 🔵, 4 = 🔴)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(4)
    ),

  async execute(interaction, client) {
    const level = interaction.options.getInteger("level");

    const cfgNow = readModuleConfig();
    cfgNow.statusLevel = level;
    writeModuleConfig(cfgNow);

    const nextTs = Math.floor((Date.now() + cfgNow.updateIntervalSec * 1000) / 1000);
    await upsertDashboardMessage(client, cfgNow, nextTs);

    const icon = cfgNow.icons?.legend?.[level] || "❓";
    await interaction.reply({
      content: `Aktueller Status auf **${icon} (Level ${level})** gesetzt.`,
      ephemeral: true
    });
  }
};
