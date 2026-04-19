// Prefer a direct LAN URL for the FastAPI backend on port 8000.
// Fall back to localtunnel only when a LAN address cannot be found.

const localtunnel = require('./mobile/node_modules/localtunnel');
const fs = require('fs');
const os = require('os');
const path = require('path');

const URL_FILE = path.join(__dirname, 'mobile', 'backend_url.txt');

function getLanUrl() {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries || []) {
      if (
        entry &&
        entry.family === 'IPv4' &&
        !entry.internal &&
        (
          entry.address.startsWith('192.168.') ||
          entry.address.startsWith('10.') ||
          entry.address.startsWith('172.')
        )
      ) {
        return `http://${entry.address}:8000`;
      }
    }
  }
  return null;
}

(async () => {
  const lanUrl = getLanUrl();
  if (lanUrl) {
    fs.writeFileSync(URL_FILE, lanUrl);
    console.log('[Backend] LAN URL:', lanUrl);
    console.log('[Backend] Using direct local network connection for faster uploads.');
    return;
  }

  console.log('[Tunnel] Connecting...');
  try {
    const tunnel = await localtunnel({ port: 8000 });
    fs.writeFileSync(URL_FILE, tunnel.url);
    console.log('[Tunnel] Backend URL:', tunnel.url);

    tunnel.on('close', () => {
      console.log('[Tunnel] Closed.');
      try { fs.unlinkSync(URL_FILE); } catch {}
    });

    tunnel.on('error', (err) => {
      console.error('[Tunnel] Error:', err.message);
    });
  } catch (e) {
    console.error('[Tunnel] Failed:', e.message);
  }
})();
