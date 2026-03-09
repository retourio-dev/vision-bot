const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'ratings.json');

function ensureFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ ratings: [] }, null, 2), 'utf8');
  }
}

function readDb() {
  try {
    ensureFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw || '{}');
    if (!Array.isArray(data.ratings)) data.ratings = [];
    return data;
  } catch {
    return { ratings: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function addRating(entry) {
  const db = readDb();
  db.ratings.push({ ...entry, createdAt: Date.now() });
  writeDb(db);
}

module.exports = { addRating };

