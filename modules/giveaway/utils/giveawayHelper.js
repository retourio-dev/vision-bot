const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const DATA_FILE = path.join(__dirname, '..', 'giveaways.json');

function ensureFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
}

function readStore() {
  try {
    ensureFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw || '{}');
    return typeof data === 'object' && data ? data : {};
  } catch {
    return {};
  }
}

function stringifySafe(obj) {
  return JSON.stringify(
    obj,
    (_, v) => (typeof v === 'bigint' ? v.toString() : v),
    2
  );
}

function writeStore(data) {
  fs.writeFileSync(DATA_FILE, stringifySafe(data), 'utf8');
}

const activeGiveaways = new Map();

function saveGiveaways() {
  const obj = Object.create(null);
  for (const [id, g] of activeGiveaways.entries()) {
    obj[id] = {
      channelId: String(g.channelId),
      messageId: String(g.messageId),
      prize: g.prize,
      winnerCount: Number(g.winnerCount || 1),
      endTime: Number(g.endTime),
      entries: Array.isArray(g.entries) ? g.entries.map(x => String(x)) : [],
      creatorId: String(g.creatorId)
    };
  }
  writeStore(obj);
}

function startGiveawayTimer(id, g) {
  const delay = Math.max(0, Number(g.endTime) - Date.now());
  setTimeout(async () => {
    try {
      const unique = Array.from(new Set(g.entries || []));
      const count = Math.max(1, Number(g.winnerCount) || 1);
      const winners = unique.slice(0, count);
      const client = g.client;
      if (client) {
        const ch = await client.channels.fetch(String(g.channelId)).catch(() => null);
        if (ch) {
          let msg = null;
          try { msg = await ch.messages.fetch(String(g.messageId)); } catch {}
          if (msg) {
            const base = msg.embeds && msg.embeds[0] ? EmbedBuilder.from(msg.embeds[0]) : new EmbedBuilder().setTitle('Giveaway');
            base.setDescription(`${base.data.description || ''}\n\nGewinner: ${winners.length ? winners.map(x => `<@${x}>`).join(', ') : 'niemand'}`);
            await msg.edit({ embeds: [base], components: [] }).catch(() => {});
          }
          if (winners.length) {
            await ch.send(`🎉 Glückwunsch an ${winners.map(x => `<@${x}>`).join(', ')} für **${g.prize}**!`).catch(() => {});
          }
        }
      }
    } finally {
      activeGiveaways.delete(id);
      saveGiveaways();
    }
  }, delay);
}

// Initial load
(function loadFromDisk() {
  const data = readStore();
  for (const id of Object.keys(data)) {
    activeGiveaways.set(id, { ...data[id] });
  }
})();

module.exports = {
  activeGiveaways,
  saveGiveaways,
  startGiveawayTimer
};

