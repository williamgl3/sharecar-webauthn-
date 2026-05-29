const fs = require('fs');
const path = require('path');
const os = require('os');

const dataFile = path.join(
  process.env.NETLIFY ? os.tmpdir() : __dirname,
  'sharecar-data.json'
);

async function readData() {
  try {
    if (fs.existsSync(dataFile)) {
      return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    }
  } catch (e) {
    console.error('readData error:', e.message);
  }
  return { users: [], vehicles: [], rentals: [] };
}

async function writeData(data) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('writeData error:', e.message);
  }
}

module.exports = { readData, writeData };
