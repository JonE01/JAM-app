/**
 * iCloud Shared Album — unofficial reverse-engineered API.
 *
 * ⚠ DISCLAIMER: This uses Apple's undocumented internal API. It is not
 * officially supported and may break after any iCloud/iOS update without
 * notice. No sensitive credentials are transmitted — only the public
 * album token from your shared-album URL.
 *
 * Flow:
 *  1. POST /sharedstreams/webstream      →  photo metadata + derivative counts
 *  2. POST /sharedstreams/webasseturls   →  time-limited CDN URLs
 *
 * Matching strategy:
 *  Apple's webasseturls items are keyed by an internal checksum that does NOT
 *  match the `checksum` fields in the webstream derivatives object (this changed
 *  in newer iCloud versions). Instead we rely on positional ordering: Apple
 *  returns items in the same order as the photoGuids we sent, grouped per photo
 *  with derivatives in ascending size order. We slice the right chunk per photo
 *  and take the last (largest) item.
 *
 * URL note:
 *  url_location comes back without a scheme ("cvws.icloud-content.com"),
 *  so we always prepend https:// if no scheme is present.
 */

const BASE_PATH = '/api/icloud-photos';

function buildUrl(item) {
  const loc  = item.url_location ?? '';
  const path = item.url_path     ?? '';

  // url_path is occasionally already a full URL
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  // Ensure location has a scheme
  const base = loc.startsWith('http') ? loc : `https://${loc}`;
  const sep  = path.startsWith('/') ? '' : '/';
  return `${base.replace(/\/$/, '')}${sep}${path}`;
}

/**
 * Apple's dateCreated can be an ISO string, a Unix timestamp in seconds,
 * or a Unix timestamp in milliseconds. Normalise to an ISO string.
 */
function parseAppleDate(raw) {
  if (!raw) return null;

  if (typeof raw === 'number') {
    // Timestamps < 1e12 are almost certainly seconds; >= 1e12 are milliseconds
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d  = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(raw); // handles ISO 8601 and most date strings
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function icloudPost(token, endpoint, payload) {
  const res = await fetch(BASE_PATH, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ token, endpoint, payload }),
  });
  if (!res.ok) throw new Error(`iCloud ${endpoint} error: ${res.status}`);
  return res.json();
}

export async function fetchAlbumPhotos(albumToken) {
  // ── Step 1: stream metadata ──────────────────────────────────────
  const streamData = await icloudPost(
    albumToken,
    'sharedstreams/webstream',
    { streamCtag: null }
  );

  const photos = streamData.photos ?? [];
  if (photos.length === 0) return [];

  // ── Step 2: asset (CDN) URLs ─────────────────────────────────────
  const photoGuids = photos.map((p) => p.photoGuid);
  const urlData    = await icloudPost(
    albumToken,
    'sharedstreams/webasseturls',
    { photoGuids }
  );
  const itemValues = Object.values(urlData.items ?? {});


  // ── Match items to photos by position ────────────────────────────
  // Items are returned grouped by photo in the same order as photoGuids,
  // with each photo's derivatives in ascending size order (smallest first).
  let cursor = 0;

  return photos
    .map((photo) => {
      const derivatives  = photo.derivatives ?? {};
      const derivCount   = Object.keys(derivatives).filter((k) => !isNaN(+k)).length;

      if (derivCount === 0) return null;

      const photoItems = itemValues.slice(cursor, cursor + derivCount);
      cursor += derivCount;

      if (photoItems.length === 0) return null;

      // Last item = largest derivative
      const bestItem = photoItems[photoItems.length - 1];
      const url      = buildUrl(bestItem);

      if (!url.startsWith('http')) return null;

      // Pull dimensions from the matching (largest) derivative key
      const sortedDerivKeys = Object.keys(derivatives)
        .filter((k) => !isNaN(+k))
        .sort((a, b) => +a - +b);
      const bestDeriv = derivatives[sortedDerivKeys[sortedDerivKeys.length - 1]] ?? {};

      if (import.meta.env.DEV && cursor <= 3) {
        console.log(`[iCloud] Photo ${photo.photoGuid} → ${url}`);
      }

      return {
        guid:    photo.photoGuid,
        url,
        width:   bestDeriv.width  ?? null,
        height:  bestDeriv.height ?? null,
        caption: photo.caption    ?? '',
      };
    })
    .filter(Boolean);
}
