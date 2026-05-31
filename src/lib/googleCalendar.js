/**
 * Google Calendar API v3 (client-side OAuth via Google Identity Services).
 *
 * Scopes needed: https://www.googleapis.com/auth/calendar.readonly
 * This is read-only — we never modify the user's calendar here.
 * (Creating events from the Date Scheduler uses a separate write scope.)
 */

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

const LS_TOKEN  = 'jam_gcal_token';
const LS_EXPIRY = 'jam_gcal_expiry';

let tokenClient = null;
let gapiLoaded  = false;
let gisLoaded   = false;
let accessToken = null;

// ── Token persistence ────────────────────────────────────────────────────────

function saveToken(token, expiresIn = 3600) {
  accessToken = token;
  // Store with a 2-minute safety margin before actual expiry
  const expiry = Date.now() + (expiresIn - 120) * 1000;
  try {
    localStorage.setItem(LS_TOKEN,  token);
    localStorage.setItem(LS_EXPIRY, String(expiry));
  } catch { /* private/incognito may block localStorage */ }
}

function loadSavedToken() {
  try {
    const token  = localStorage.getItem(LS_TOKEN);
    const expiry = localStorage.getItem(LS_EXPIRY);
    if (token && expiry && Date.now() < parseInt(expiry, 10)) return token;
  } catch { /* ignore */ }
  clearSavedToken();
  return null;
}

function clearSavedToken() {
  try {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_EXPIRY);
  } catch { /* ignore */ }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function serializeError(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (err.error?.message) return `${err.error.message} (${err.error.status ?? err.error.code})`;
  if (err.details)  return err.details;
  if (err.message)  return err.message;
  return JSON.stringify(err);
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`Timed out waiting for ${label}`)), ms)
    ),
  ]);
}

// ── Init ─────────────────────────────────────────────────────────────────────

export async function initGoogleCalendar() {
  if (!gapiLoaded) {
    try {
      await loadScript('https://apis.google.com/js/api.js');
      await withTimeout(
        new Promise((res, rej) => window.gapi.load('client', { callback: res, onerror: rej })),
        10000, 'gapi.client'
      );
      await withTimeout(
        window.gapi.client.init({
          apiKey:        import.meta.env.VITE_GOOGLE_API_KEY,
          discoveryDocs: [DISCOVERY_DOC],
        }),
        10000, 'gapi.client.init'
      );
      gapiLoaded = true;
    } catch (err) {
      gapiLoaded = false;
      console.error('[Google] init error:', err);
      throw new Error(`Google API failed to load: ${serializeError(err)}`);
    }
  }

  if (!gisLoaded) {
    try {
      await withTimeout(
        new Promise((res) => {
          if (window.google?.accounts?.oauth2) return res();
          const id = setInterval(() => {
            if (window.google?.accounts?.oauth2) { clearInterval(id); res(); }
          }, 100);
        }),
        10000, 'Google Identity Services'
      );

      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope:     SCOPES,
        callback:  () => {}, // overridden per-call in requestAuth()
      });
      gisLoaded = true;
    } catch (err) {
      gisLoaded = false;
      throw new Error(`Google sign-in failed to load: ${serializeError(err)}`);
    }
  }

  // Restore a previously saved token so the user doesn't have to re-auth on refresh
  if (!accessToken) {
    const saved = loadSavedToken();
    if (saved) {
      accessToken = saved;
      window.gapi.client.setToken({ access_token: saved });
    }
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export function requestAuth() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) { reject(new Error('Google not initialized')); return; }
    tokenClient.callback = (resp) => {
      if (resp.error) {
        clearSavedToken();
        reject(resp);
        return;
      }
      saveToken(resp.access_token, resp.expires_in ?? 3600);
      window.gapi.client.setToken({ access_token: resp.access_token });
      resolve(resp.access_token);
    };
    // Empty prompt = skip consent screen if already granted
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function isAuthed() { return !!accessToken; }

// ── Calendar API calls ───────────────────────────────────────────────────────

export async function listUpcomingEvents(calendarId, maxResults = 30) {
  const response = await window.gapi.client.calendar.events.list({
    calendarId,
    timeMin:      new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy:      'startTime',
  });
  return response.result.items ?? [];
}

export async function createEvent(calendarId, event) {
  const response = await window.gapi.client.calendar.events.insert({
    calendarId,
    resource: event,
  });
  return response.result;
}
