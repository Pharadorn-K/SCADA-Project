// backend/node/services/stateStore.js
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../data/systemState.json');

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return { lastIntent: 'STOPPED' };
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('❌ Failed to load system state:', err.message);
    return { lastIntent: 'STOPPED' };
  }
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('❌ Failed to save system state:', err.message);
  }
}

module.exports = {
  loadState,
  saveState
};
