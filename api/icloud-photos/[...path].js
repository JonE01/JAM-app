/**
 * Vercel catch-all route: /api/icloud-photos/{token}/{...endpoint}
 *
 * Proxies requests to Apple's sharedstreams API to bypass browser CORS.
 * Path segments arrive in req.query.path as an array, e.g.
 *   /api/icloud-photos/TOKEN/sharedstreams/webstream
 *   → req.query.path = ['TOKEN', 'sharedstreams', 'webstream']
 */

const DEFAULT_SERVER = 'p63';

export default async function handler(req, res) {
  const segments = Array.isArray(req.query.path) ? req.query.path : [];
  const token    = segments[0];
  const endpoint = segments.slice(1).join('/');

  if (!token || !endpoint) {
    res.status(400).json({ error: 'Missing token or endpoint in path' });
    return;
  }

  // Read request body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();

  let appleServer = DEFAULT_SERVER;
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

    const status = appleRes.status === 330 ? 502 : appleRes.status;
    res.status(status);
    const ct = appleRes.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(await appleRes.text());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
