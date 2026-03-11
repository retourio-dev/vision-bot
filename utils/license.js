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

function getPublicKey() {
  if (process.env.LICENSE_PUBLIC_KEY) {
    return process.env.LICENSE_PUBLIC_KEY.replace(/\\n/g, '\n');
  }
  const pkPath = path.resolve(__dirname, './public_key.pem');
  try {
    if (fs.existsSync(pkPath)) {
      return fs.readFileSync(pkPath, 'utf8');
    }
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

function verifyTokenWithPublicKey(token, publicKey, moduleName) {
  if (!token || !publicKey) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const payloadB64 = parts[0];
  const sigB64 = parts[1];
  let ok = false;
  try {
    ok = crypto.verify(
      'RSA-SHA256',
      Buffer.from(payloadB64, 'utf8'),
      publicKey,
      Buffer.from(sigB64, 'base64')
    );
  } catch {
    return null;
  }
  if (!ok) return null;
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
  const enforce = String(process.env.LICENSE_ENFORCE || '0') === '1';
  const key = readModuleLicenseKey(moduleName, moduleDir);
  const publicKey = getPublicKey();
  const secret = process.env.LICENSE_SECRET || null;

  let payload = null;
  if (publicKey) {
    payload = verifyTokenWithPublicKey(key, publicKey, moduleName);
  }
  if (!payload && secret) {
    payload = verifyToken(key, secret, moduleName);
  }
  if (!payload) {
    return enforce ? false : !publicKey && !secret ? true : false;
  }
  if (payload.guildId && currentGuildId && String(payload.guildId) !== String(currentGuildId)) {
    return false;
  }
  if (Array.isArray(payload.allowedGuilds) && payload.allowedGuilds.length > 0 && currentGuildId) {
    if (!payload.allowedGuilds.map(String).includes(String(currentGuildId))) return false;
  }
  return true;
}

module.exports = { isLicensed };
