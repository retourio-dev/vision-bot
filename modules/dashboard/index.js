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

    client.on('raw', async (packet) => {
      try {
        if (!packet?.t || !packet?.d) return;
        const cfg = readModuleConfig();
        if (!cfg?.messageId || !cfg?.channelId) return;

        if (packet.t === 'MESSAGE_DELETE') {
          const deletedId = String(packet.d.id);
          const deletedChannelId = String(packet.d.channel_id);
          if (deletedId !== String(cfg.messageId)) return;
          if (deletedChannelId !== String(cfg.channelId)) return;
        } else if (packet.t === 'MESSAGE_DELETE_BULK') {
          const deletedChannelId = String(packet.d.channel_id);
          if (deletedChannelId !== String(cfg.channelId)) return;
          const ids = Array.isArray(packet.d.ids) ? packet.d.ids.map(String) : [];
          if (!ids.includes(String(cfg.messageId))) return;
        } else {
          return;
        }

        const nextTs = Math.floor((Date.now() + (cfg.updateIntervalSec || 300) * 1000) / 1000);
        await upsertDashboardMessage(client, cfg, nextTs);
      } catch (e) {
        console.error('[dashboard] Fehler beim Wiederherstellen nach Löschung:', e);
      }
    });

    console.log("[dashboard] Modul bereit.");
  }
};
