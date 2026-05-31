# JAM App ♡

A private web app built as a gift — a shared space to plan dates, revisit memories, discover new places, and feel close even when apart.

---

## What's inside

| Page | Description |
|------|-------------|
| **Home** | Hero photo, stats, quick navigation |
| **Upcoming Dates** | Google Calendar events displayed as a beautiful timeline |
| **Our Photos** | Full-screen gallery cycling through your iCloud shared album |
| **Date Ideas** | Firebase-backed list with search, categories, "Surprise Me", and AI scheduling |
| **Our Places** | Interactive Leaflet map — pin places, add notes, filter by category |

---

## Quick start

### 1 — Install dependencies

```bash
npm install
```

### 2 — Set up environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in each variable. See the sections below for how to get each key.

### 3 — Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## API keys — step by step

### Firebase

1. Go to [Firebase Console](https://console.firebase.google.com) → **Create project**
2. Add a **Web app** → copy the config values into `.env.local`
3. Enable **Firestore Database** (Start in test mode for now, lock down rules before sharing)
4. Enable **Storage** (if you want to host photos there as a fallback)

**Firestore collections used:**
- `dateIdeas` — date idea list
- `scheduledDates` — AI-scheduled events history
- `places` — saved map pins

**Recommended Firestore security rules** (paste in Firebase Console → Firestore → Rules):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // Only allow access if you add Firebase Auth later.
      // For a private 2-person app, you can temporarily leave this open:
      allow read, write: if true;
    }
  }
}
```

---

### Google Calendar

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. **APIs & Services → Library** → enable **Google Calendar API**
4. **APIs & Services → Credentials**:
   - Create an **OAuth 2.0 Client ID** (Web application type)
     - Authorized JavaScript origins: `http://localhost:5173` (dev) + your production URL
   - Create an **API key** (restrict it to Calendar API)
5. Paste `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_API_KEY` in `.env.local`

**Getting your shared Calendar ID:**
1. Open [Google Calendar](https://calendar.google.com)
2. Find your shared calendar → ⋮ → **Settings and sharing**
3. Scroll to "Integrate calendar" → copy **Calendar ID**
4. Paste as `VITE_GOOGLE_CALENDAR_ID`

**Scopes used:**
- `calendar.readonly` — read events for the Dates page
- `calendar.events` — create events from the AI Scheduler

---

### iCloud Shared Album

> ⚠ **Unofficial API.** Apple does not provide a public API for shared albums. This uses a reverse-engineered endpoint that has worked reliably but could break after an iCloud update without notice.

1. On your iPhone, open **Photos** → **Albums** → your shared album
2. Tap the person icon → **Share Link** → enable **Public Website**
3. Copy the link: `https://www.icloud.com/photos/#AbCdEfGhIjKl`
4. Paste only the token (the part after `#`) as `VITE_ICLOUD_ALBUM_TOKEN`

---

### Anthropic (Claude AI)

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Paste as `ANTHROPIC_API_KEY` in `.env.local`

This key is used **server-side only** in `api/generate-event.js` — it's never sent to the browser.

---

### Map center

Set `VITE_MAP_LAT` and `VITE_MAP_LNG` to the coordinates of your city.  
You can right-click on Google Maps and choose **"What's here?"** to get the exact coordinates.

---

## Personalization

### Add your hero photo

Drop a photo named `hero.jpg` into the `/public` folder.  
The home page hero section will automatically use it.

### Change the color theme

All colors are CSS variables in [src/styles/theme.css](src/styles/theme.css).  
Edit the values at the top of that file to change the entire app's palette.

---

## Deploy to Vercel

1. Push the project to a GitHub repository
2. Import it at [vercel.com](https://vercel.com) → **New Project**
3. Add all environment variables under **Settings → Environment Variables**
   - Paste each `VITE_*` variable from your `.env.local`
   - Also add `ANTHROPIC_API_KEY` (no `VITE_` prefix — it's server-side only)
4. Click **Deploy**

The `vercel.json` in the project root handles routing automatically.

---

## Deploy to Netlify

1. Push to GitHub
2. Import at [app.netlify.com](https://app.netlify.com)
3. Build command: `npm run build`, publish directory: `dist`
4. Add environment variables in **Site settings → Environment variables**
5. For the serverless functions, move `api/` contents to `netlify/functions/` and update fetch paths accordingly

---

## Project structure

```
JAM_app/
├── api/                    # Vercel serverless functions
│   ├── icloud-photos.js    # iCloud album proxy (avoids browser CORS)
│   └── generate-event.js   # Anthropic API proxy
├── public/
│   ├── heart.svg           # Favicon
│   └── hero.jpg            # ← drop your photo here
├── src/
│   ├── components/
│   │   ├── layout/         # NavBar, PageTransition
│   │   └── ui/             # Button, Card, Badge, Input
│   ├── hooks/
│   │   └── useCollection.js # Real-time Firestore hook
│   ├── lib/
│   │   ├── firebase.js
│   │   ├── googleCalendar.js
│   │   └── icloudAlbum.js
│   ├── pages/
│   │   ├── Home/
│   │   ├── UpcomingDates/
│   │   ├── OurPhotos/
│   │   ├── DateIdeas/
│   │   └── OurPlaces/
│   └── styles/
│       ├── theme.css       # ← all color/font variables here
│       └── global.css
├── .env.example
├── vercel.json
└── vite.config.js
```

---

Made with ♡
