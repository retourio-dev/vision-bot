const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'customers.json');

function ensureFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ customers: {} }, null, 2), 'utf8');
  }
}

function readDb() {
  try {
    ensureFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw || '{}');
    if (!data.customers || typeof data.customers !== 'object') data.customers = {};
    return data;
  } catch {
    return { customers: {} };
  }
}

function writeDb(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function setCustomer(userId, type, meta) {
  const db = readDb();
  db.customers[userId] = {
    type,
    addedAt: Date.now(),
    ...meta
  };
  writeDb(db);
}

function getCustomer(userId) {
  const db = readDb();
  return db.customers[userId] || null;
}

module.exports = { setCustomer, getCustomer };

