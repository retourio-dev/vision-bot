const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const STORAGE_PATH = path.join(__dirname, '..', 'giveaways.json');
const timers = new Map();
const activeGiveaways = new Map();

function loadGiveaways() {
  try {
    if (!fs.existsSync(STORAGE_PATH)) return;
    const raw = fs.readFileSync(STORAGE_PATH, 'utf8').trim();
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      for (const g of data) {
        if (g && g.messageId) activeGiveaways.set(g.messageId, g);
      }
    } else if (data && typeof data === 'object') {
      for (const k of Object.keys(data)) {
        const g = data[k];
        if (g && g.messageId) activeGiveaways.set(g.messageId, g);
      }
    }
  } catch {}
}

function saveGiveaways() {
  try {
    const arr = Array.from(activeGiveaways.values());
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(arr, null, 2), 'utf8');
  } catch (e) {
    console.error('[giveaway] Fehler beim Speichern:', e);
  }
}

function clearTimer(id) {
  const t = timers.get(id);
  if (t) {
    clearTimeout(t);
    timers.delete(id);
  }
}

function pickWinners(entries, count) {
  const list = Array.from(new Set(entries));
  if (list.length === 0 || count <= 0) return [];
  const winners = [];
  while (winners.length < count && list.length > 0) {
    const idx = Math.floor(Math.random() * list.length);
    winners.push(list.splice(idx, 1)[0]);
  }
  return winners;
}

function startGiveawayTimer(id, g) {
  clearTimer(id);
  const delay = Math.max(0, g.endTime - Date.now());
  const t = setTimeout(async () => {
    try {
      const winners = pickWinners(g.entries || [], g.winnerCount || 1);
      const client = g.client;
      if (client) {
        const ch = await client.channels.fetch(g.channelId).catch(() => null);
        if (ch) {
          let msg = null;
          try { msg = await ch.messages.fetch(g.messageId); } catch {}
          if (msg) {
            const base = msg.embeds && msg.embeds[0] ? EmbedBuilder.from(msg.embeds[0]) : new EmbedBuilder().setTitle('Giveaway');
            base.setDescription(`${base.data.description || ''}\n\nGewinner: ${
              winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'niemand'
            }`);
            await msg.edit({ embeds: [base], components: [] }).catch(() => {});
          }
          if (winners.length) {
            await ch.send(`🎉 Glückwunsch an ${winners.map(id => `<@${id}>`).join(', ')} für **${g.prize}**!`).catch(() => {});
          } else {
            await ch.send(`Kein Gewinner für **${g.prize}** – keine Teilnehmer.`).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.error('[giveaway] Abschlussfehler:', e);
    } finally {
      activeGiveaways.delete(id);
      saveGiveaways();
      clearTimer(id);
    }
  }, delay);
  timers.set(id, t);
}

// Initial laden beim require
loadGiveaways();
for (const [id, g] of activeGiveaways) {
  startGiveawayTimer(id, g);
}

module.exports = {
  activeGiveaways,
  saveGiveaways,
  startGiveawayTimer
};
