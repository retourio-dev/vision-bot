const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder } = require('discord.js');

function readConfig() {
  const p = path.join(__dirname, '..', 'config.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return { p, cfg: JSON.parse(raw) };
  } catch {
    return { p, cfg: {} };
  }
}

function writeConfig(p, cfg) {
  try {
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard-set')
    .setDescription('Setzt einen Wert in modules/dashboard/config.json')
    .addStringOption(opt =>
      opt.setName('key').setDescription('Schlüssel, z. B. updateIntervalSec').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('value').setDescription('Wert (wird als String gespeichert)').setRequired(true)
    ),

  async execute(interaction) {
    const key = interaction.options.getString('key', true);
    const value = interaction.options.getString('value', true);
    const { p, cfg } = readConfig();
    cfg[key] = value;
    const ok = writeConfig(p, cfg);
    if (ok) {
      await interaction.reply({ content: `Gesetzt: ${key} = ${value}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `Fehler beim Speichern.`, ephemeral: true });
    }
  }
};
