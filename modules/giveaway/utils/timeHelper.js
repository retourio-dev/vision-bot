function parseDurationString(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  const regex = /^(\d+)\s*([smhdw])$/; // seconds, minutes, hours, days, weeks
  const match = s.match(regex);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[unit];
  if (!mult) return null;
  return val * mult;
}

module.exports = { parseDurationString };
