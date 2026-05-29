const fs = require('fs');
const path = require('path');
const os = require('os');

const dataFile = path.join(process.env.NETLIFY ? os.tmpdir() : __dirname, 'sharecar-data.json');

let netlifyStore = null;

async function getStore() {
  if (netlifyStore) return netlifyStore;
  if (process.env.NETLIFY) {
    try {
      const { getStore } = await import('@netlify/blobs');
      netlifyStore = getStore('webauthn-data');
    } catch (e) {
      console.error('Failed to init Netlify Blobs, using local file fallback:', e.message);
      netlifyStore = null;
    }
  }
  return netlifyStore;
}

async function readData() {
  const store = await getStore();
  if (store) {
    try {
      const raw = await store.get('data');
      return raw ? JSON.parse(raw) : { users: [], vehicles: [], rentals: [] };
    } catch {
      return { users: [], vehicles: [], rentals: [] };
    }
  }
  if (!fs.existsSync(dataFile)) return { users: [], vehicles: [], rentals: [] };
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    return { users: [], vehicles: [], rentals: [] };
  }
}

async function writeData(data) {
  try {
    const store = await getStore();
    if (store) {
      await store.set('data', JSON.stringify(data));
    } else {
      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error('writeData error:', e);
  }
}

module.exports = { readData, writeData };
