const fs = require('fs');
const path = require('path');

const MODULE_CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const MAIN_CONFIG_PATH = path.resolve(__dirname, '..', '..', '..', 'config.json');

function safeReadJson(p, fallback = {}) {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { ...fallback };
  }
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

function readModuleConfig() {
  return safeReadJson(MODULE_CONFIG_PATH, {});
}

function writeModuleConfig(cfg) {
  writeJson(MODULE_CONFIG_PATH, cfg || {});
}

function readMainConfig() {
  return safeReadJson(MAIN_CONFIG_PATH, {});
}

function getAllowedRoleIds(moduleCfg) {
  const ids = (moduleCfg && Array.isArray(moduleCfg.allowedroles)) ? moduleCfg.allowedroles : [];
  return new Set(ids.map(x => String(x)));
}

module.exports = {
  readModuleConfig,
  writeModuleConfig,
  readMainConfig,
  getAllowedRoleIds
};
