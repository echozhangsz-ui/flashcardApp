const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

let apiBase = null;
try {
  apiBase = fs.readFileSync(path.join(__dirname, 'backend_url.txt'), 'utf8').trim();
  console.log('[Config] Backend URL:', apiBase);
} catch {
  console.log('[Config] No backend_url.txt found, using fallback');
}

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: { apiBase },
  },
};
