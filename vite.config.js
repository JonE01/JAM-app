import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev middleware that replicates api/icloud-photos.js locally.
// Handles Apple's 330 "use a different server" redirect that a simple proxy can't follow.
function icloudDevProxy() {
  return {
    name: 'icloud-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/icloud-photos', (req, res) => {
        // req.url here is the path after the mount point, e.g. /TOKEN/sharedstreams/webstream
        const parts = (req.url || '').split('/').filter(Boolean);
        const token    = parts[0];
        const endpoint = parts.slice(1).join('/');

        if (!token || !endpoint) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing token or endpoint' }));
          return;
        }

        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', async () => {
          const body = Buffer.concat(chunks).toString();
          let appleServer = 'p63';
          let appleRes;

          try {
            for (let attempt = 0; attempt < 5; attempt++) {
              const url = `https://${appleServer}-sharedstreams.icloud.com/${token}/${endpoint}`;
              appleRes = await fetch(url, {
                method:  'POST',
                headers: {
                  'Content-Type': 'text/plain',
                  'Origin':       'https://www.icloud.com',
                  'User-Agent':   'Mozilla/5.0 (compatible; JAM-App/1.0)',
                },
                body,
              });

              if (appleRes.status === 330) {
                const data = await appleRes.json().catch(() => ({}));
                const host = data['X-Apple-MMe-Host'];
                if (host) {
                  const match = host.match(/^(p\d+)-/);
                  if (match) { appleServer = match[1]; continue; }
                }
              }
              break;
            }

            res.statusCode = appleRes.status === 330 ? 502 : appleRes.status;
            const ct = appleRes.headers.get('content-type');
            if (ct) res.setHeader('Content-Type', ct);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(await appleRes.text());
          } catch (err) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), icloudDevProxy()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':    ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/storage'],
          'motion-vendor':   ['framer-motion'],
          'map-vendor':      ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
});
