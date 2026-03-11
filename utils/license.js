const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readModuleLicenseKey(moduleName, moduleDir) {
  const envKey = process.env[`LICENSE_KEY_${moduleName.toUpperCase()}`];
  if (envKey) return envKey;
  const p = path.join(moduleDir, 'license.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    if (data && typeof data.key === 'string') return data.key;
  } catch {}
  return null;
}

function verifyToken(token, secret, moduleName) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const payloadB64 = parts[0];
  const sig = parts[1];
  const h = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
  if (h !== sig) return null;
  let payload;
  try {
    const json = Buffer.from(payloadB64, 'base64').toString('utf8');
    payload = JSON.parse(json);
  } catch {
    return null;
  }
  if (payload.name && payload.name !== moduleName) return null;
  if (payload.exp && Date.now() > Number(payload.exp)) return null;
  return payload;
}

function isLicensed(moduleName, moduleDir, manifest, currentGuildId) {
  const secret = process.env.LICENSE_SECRET;
  if (!secret) return true;
  const key = readModuleLicenseKey(moduleName, moduleDir);
  if (!key) return false;
  const payload = verifyToken(key, secret, moduleName);
  if (!payload) return false;
  if (payload.guildId && currentGuildId && String(payload.guildId) !== String(currentGuildId)) {
    return false;
  }
  if (Array.isArray(payload.allowedGuilds) && payload.allowedGuilds.length > 0 && currentGuildId) {
    if (!payload.allowedGuilds.map(String).includes(String(currentGuildId))) return false;
  }
  return true;
}

module.exports = { isLicensed };
