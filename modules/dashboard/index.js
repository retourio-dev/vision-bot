const { Events } = require("discord.js");
const { readModuleConfig } = require("./utils/configHelper");
const { upsertDashboardMessage } = require("./utils/messageHelper");

module.exports = {
  onReady: async (client) => {
    if (client._dashboardModuleRegistered) return;
    client._dashboardModuleRegistered = true;

    const moduleCfg = readModuleConfig();
    const nextTs = Math.floor((Date.now() + (moduleCfg.updateIntervalSec || 300) * 1000) / 1000);
    await upsertDashboardMessage(client, moduleCfg, nextTs).catch(console.error);

    // Auto-Update
    setInterval(() => {
      const updatedCfg = readModuleConfig();
      const nextTs = Math.floor((Date.now() + (updatedCfg.updateIntervalSec || 300) * 1000) / 1000);
      upsertDashboardMessage(client, updatedCfg, nextTs).catch(console.error);
    }, (moduleCfg.updateIntervalSec || 300) * 1000);

    client.on(Events.MessageDelete, async (message) => {
      try {
        const cfg = readModuleConfig();
        if (!cfg?.messageId) return;
        if (message?.id !== cfg.messageId) return;
        const nextTs = Math.floor((Date.now() + (cfg.updateIntervalSec || 300) * 1000) / 1000);
        await upsertDashboardMessage(client, cfg, nextTs);
      } catch (e) {
        console.error('[dashboard] Fehler beim Wiederherstellen nach Löschung:', e);
      }
    });

    client.on(Events.MessageBulkDelete, async (messages) => {
      try {
        const cfg = readModuleConfig();
        if (!cfg?.messageId) return;
        if (!messages?.has?.(cfg.messageId)) return;
        const nextTs = Math.floor((Date.now() + (cfg.updateIntervalSec || 300) * 1000) / 1000);
        await upsertDashboardMessage(client, cfg, nextTs);
      } catch (e) {
        console.error('[dashboard] Fehler beim Wiederherstellen nach Bulk-Löschung:', e);
      }
    });

    console.log("[dashboard] Modul bereit.");
  }
};
