/**
 * Vercel serverless function — iCloud Shared Album proxy.
 *
 * Requests to /api/icloud-photos/{token}/{...path} are proxied to
 * Apple's sharedstreams endpoint to bypass browser CORS restrictions.
 *
 * ⚠ This relies on Apple's undocumented internal API and may break
 * without notice after any iCloud update.
 */

const DEFAULT_SERVER = 'p63';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // Path format: /api/icloud-photos/{token}/sharedstreams/{endpoint}
  const parts = req.url.split('/').filter(Boolean);
  // parts[0] = "api", parts[1] = "icloud-photos", parts[2] = token, parts[3+] = path
  const token    = parts[2];
  const endpoint = parts.slice(3).join('/');

  if (!token || !endpoint) {
    res.status(400).json({ error: 'Missing token or endpoint' });
    return;
  }

  // Collect request body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();

  // Try the default server, follow 330 redirects (Apple's way of saying "use a different host")
  let server = DEFAULT_SERVER;
  let appleRes;

  for (let attempt = 0; attempt < 3; attempt++) {
    const url = `https://${server}-sharedstreams.icloud.com/${token}/${endpoint}`;

    appleRes = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':   'text/plain',
        'Origin':         'https://www.icloud.com',
        'User-Agent':     'Mozilla/5.0 (compatible; JAM-App/1.0)',
      },
      body,
    });

    // 330 means "retry on a different server"
    if (appleRes.status === 330) {
      const data = await appleRes.json().catch(() => ({}));
      const host = data['X-Apple-MMe-Host'];
      if (host) {
        // Extract server number from host like "p63-sharedstreams.icloud.com"
        const match = host.match(/^(p\d+)-/);
        if (match) { server = match[1]; continue; }
      }
    }
    break;
  }

  // Forward the response
  res.status(appleRes.status);
  const contentType = appleRes.headers.get('content-type');
  if (contentType) res.setHeader('Content-Type', contentType);
  res.setHeader('Access-Control-Allow-Origin', '*');

  const responseBody = await appleRes.text();
  res.send(responseBody);
}
