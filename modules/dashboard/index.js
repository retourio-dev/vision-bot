const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const { readModuleConfig, readMainConfig, getAllowedRoleIds } = require("./utils/configHelper");
const { upsertDashboardMessage } = require("./utils/messageHelper");
const { memberHasAnyAllowedRole } = require("./utils/roleHelper");

module.exports = {
  onReady: async (client) => {
    const moduleCfg = readModuleConfig();

    // Auto-Update
    setInterval(() => {
      const updatedCfg = readModuleConfig();
      const nextTs = Math.floor((Date.now() + updatedCfg.updateIntervalSec * 1000) / 1000);
      upsertDashboardMessage(client, updatedCfg, nextTs).catch(console.error);
    }, moduleCfg.updateIntervalSec * 1000);

    console.log("[dashboard] Modul bereit.");
  }
};
