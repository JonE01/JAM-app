import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useCollection } from '../../hooks/useCollection';
import { useTags } from '../../hooks/useTags';
import TagManager from '../../components/ui/TagManager';
import PageTransition from '../../components/layout/PageTransition';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input, { Textarea } from '../../components/ui/Input';
import styles from './OurPlaces.module.css';

// ------------------------------------------------------------------
// Map marker icon factory
// ------------------------------------------------------------------
function makeIcon(emoji, color) {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
      <ellipse cx="18" cy="40" rx="8" ry="4" fill="rgba(0,0,0,0.15)"/>
      <path d="M18 2 C9 2 2 9 2 18 C2 30 18 42 18 42 C18 42 34 30 34 18 C34 9 27 2 18 2Z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <text x="18" y="22" text-anchor="middle" font-size="14" fill="white">${emoji}</text>
    </svg>
  `);
  return L.icon({
    iconUrl:    `data:image/svg+xml,${svg}`,
    iconSize:   [36, 44],
    iconAnchor: [18, 44],
    popupAnchor:[0, -44],
  });
}

// Icons are built dynamically inside the component from useTags()

// Click-on-map handler component
function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// ------------------------------------------------------------------
// Google Places loader (reuses VITE_GOOGLE_API_KEY from Calendar setup)
// ------------------------------------------------------------------
let placesScriptLoaded = false;

function loadGooglePlaces() {
  if (window.google?.maps?.places) return Promise.resolve();
  if (placesScriptLoaded) {
    // Script tag added but not ready yet — wait
    return new Promise((res) => {
      const id = setInterval(() => {
        if (window.google?.maps?.places) { clearInterval(id); res(); }
      }, 100);
    });
  }
  placesScriptLoaded = true;
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_API_KEY}&libraries=places`;
    s.async = true;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

function guessCategory(types = []) {
  if (types.some(t => ['restaurant', 'food', 'meal_takeaway', 'meal_delivery'].includes(t))) return 'restaurant';
  if (types.some(t => ['cafe', 'bakery'].includes(t))) return 'cafe';
  if (types.some(t => ['park', 'natural_feature', 'campground'].includes(t))) return 'park';
  if (types.some(t => ['bar', 'night_club', 'movie_theater', 'amusement_park'].includes(t))) return 'date-spot';
  if (types.some(t => ['museum', 'art_gallery', 'library', 'bowling_alley', 'spa', 'gym'].includes(t))) return 'activity';
  return 'other';
}

// ------------------------------------------------------------------

const BLANK = {
  name:      '',
  category:  '', // filled dynamically from first tag
  note:      '',
  rating:    5,
  been:      false,
  lat:       null,
  lng:       null,
};

const CITY_CENTER = [
  parseFloat(import.meta.env.VITE_MAP_LAT   ?? '40.7128'),
  parseFloat(import.meta.env.VITE_MAP_LNG   ?? '-74.0060'),
];
const CITY_ZOOM = parseInt(import.meta.env.VITE_MAP_ZOOM ?? '13', 10);

export default function OurPlaces() {
  const { docs: places, add, update, remove, loading } = useCollection('places', 'createdAt');
  const { tags, addTag, removeTag, getTag } = useTags();

  // Build Leaflet icons from current tags (memoised by tag list)
  const icons = useMemo(
    () => Object.fromEntries(tags.map((t) => [t.id, makeIcon(t.emoji, t.color)])),
    [tags]
  );
  const [catFilter, setCat]     = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(BLANK);
  const [saving, setSaving]     = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch]     = useState('');
  const [placesReady, setPlacesReady] = useState(false);
  const mapRef       = useRef(null);
  const searchRef    = useRef(null);
  const autocompleteRef = useRef(null);

  // Load Google Places and wire up Autocomplete
  useEffect(() => {
    loadGooglePlaces()
      .then(() => setPlacesReady(true))
      .catch(() => {}); // graceful — search box just won't autocomplete
  }, []);

  useEffect(() => {
    if (!placesReady || !searchRef.current || autocompleteRef.current) return;

    const ac = new window.google.maps.places.Autocomplete(searchRef.current, {
      fields: ['geometry', 'name', 'formatted_address', 'types'],
    });

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.geometry?.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      // Fly the Leaflet map to the result
      mapRef.current?.flyTo([lat, lng], 16, { duration: 1 });

      // Pre-fill the add form
      setForm(f => ({
        ...f,
        name:     place.name ?? '',
        lat,
        lng,
        category: guessCategory(place.types),
      }));
      setShowForm(true);

      // Clear the search input
      if (searchRef.current) searchRef.current.value = '';
    });

    autocompleteRef.current = ac;
  }, [placesReady]);

  const filtered = places.filter((p) => {
    const matchCat = catFilter === 'all' || p.category === catFilter;
    const matchS   = p.name.toLowerCase().includes(search.toLowerCase()) ||
                     (p.note ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchS;
  });

  const handleMapClick = (latlng) => {
    setForm((f) => ({ ...f, lat: latlng.lat, lng: latlng.lng }));
    setShowForm(true);
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.lat || !form.name.trim()) {
      toast.error('Tap the map to drop a pin first.');
      return;
    }
    setSaving(true);
    try {
      await add({ ...form, category: formCategory, name: form.name.trim() });
      setForm(BLANK);
      setShowForm(false);
      toast.success('Place saved ♡');
    } catch {
      toast.error('Failed to save place');
    } finally {
      setSaving(false);
    }
  };

  const toggleBeen = async (place) => {
    await update(place.id, { been: !place.been });
  };

  const handleRemove = async (id) => {
    await remove(id);
    if (selected?.id === id) setSelected(null);
    toast.success('Removed');
  };

  const catMeta = (id) => getTag(id);
  const formCategory = form.category || tags[0]?.id || 'other';

  return (
    <PageTransition className={styles.page}>
      <div className={styles.layout}>
        {/* ---- Sidebar ---- */}
        <aside className={styles.sidebar}>
          <div className={styles.sideHeader}>
            <h1 className={styles.title}>Our Places</h1>

            <input
              className={styles.search}
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {/* Tag filter + manager */}
            <div className={styles.cats}>
              <button
                className={`${styles.catBtn} ${catFilter === 'all' ? styles.catActive : ''}`}
                onClick={() => setCat('all')}
              >◎ All</button>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  className={`${styles.catBtn} ${catFilter === tag.id ? styles.catActive : ''}`}
                  onClick={() => setCat(tag.id)}
                >
                  {tag.emoji} {tag.name}
                </button>
              ))}
            </div>

            <TagManager tags={tags} onAdd={addTag} onRemove={removeTag} />

            <p className={styles.hint}>
              Tap anywhere on the map to add a new place.
            </p>
          </div>

          {/* Place list */}
          <div className={styles.placeList}>
            {loading && <p className={styles.loadingText}>Loading places…</p>}
            {!loading && filtered.length === 0 && (
              <p className={styles.emptyText}>No places yet — tap the map!</p>
            )}
            <AnimatePresence>
              {filtered.map((place) => {
                const cat = catMeta(place.category);
                return (
                  <motion.div
                    key={place.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.25 }}
                    className={`${styles.placeItem} ${selected?.id === place.id ? styles.placeItemActive : ''}`}
                    onClick={() => {
                      setSelected(selected?.id === place.id ? null : place);
                      // Pan map to the place
                      mapRef.current?.flyTo([place.lat, place.lng], 16, { duration: 1 });
                    }}
                  >
                    <div className={styles.placeTop}>
                      <Badge variant={place.been ? 'gold' : 'cream'}>
                        {place.been ? '✓ Been' : '◌ Want to go'}
                      </Badge>
                      <span className={styles.placeEmoji}>{cat.emoji}</span>
                    </div>
                    <p className={styles.placeName}>{place.name}</p>
                    <div className={styles.placeRating}>
                      {'★'.repeat(place.rating ?? 0)}{'☆'.repeat(5 - (place.rating ?? 0))}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </aside>

        {/* ---- Map ---- */}
        <div className={styles.mapWrapper}>
          {/* Google Places search bar */}
          <div className={styles.searchOverlay}>
            <span className={styles.searchIcon}>⌕</span>
            <input
              ref={searchRef}
              className={styles.searchInput}
              type="text"
              placeholder={placesReady ? 'Search for a place…' : 'Loading search…'}
              disabled={!placesReady}
            />
          </div>
          <MapContainer
            center={CITY_CENTER}
            zoom={CITY_ZOOM}
            className={styles.map}
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">Carto</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={19}
            />
            <MapClickHandler onMapClick={handleMapClick} />

            {filtered.map((place) => (
              <Marker
                key={place.id}
                position={[place.lat, place.lng]}
                icon={icons[place.category] ?? icons['other'] ?? makeIcon('◦', '#9A7A6A')}
                eventHandlers={{ click: () => setSelected(place) }}
              >
                <Popup>
                  <div className={styles.popup}>
                    <strong>{place.name}</strong>
                    {place.note && <p>{place.note}</p>}
                    <div className={styles.popupActions}>
                      <button onClick={() => toggleBeen(place)}>
                        {place.been ? '✓ Been here' : '◌ Want to go'}
                      </button>
                      <button onClick={() => handleRemove(place.id)} style={{ color: '#ef4444' }}>
                        Remove
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Add-place form (slides up from bottom when a pin is dropped) */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                className={styles.addPanel}
              >
                <div className={styles.addPanelHandle} />
                <form onSubmit={handleAdd} className={styles.addForm}>
                  <h3 className={styles.addTitle}>Add a Place</h3>
                  <p className={styles.addCoords}>
                    📍 {form.lat?.toFixed(5)}, {form.lng?.toFixed(5)}
                  </p>

                  <div className={styles.addRow}>
                    <Input
                      label="Name"
                      placeholder="What's this place?"
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      required
                      className={styles.flex1}
                    />
                    <div className={styles.group}>
                      <label className={styles.label}>Category</label>
                      <select
                        className={styles.select}
                        value={formCategory}
                        onChange={(e) => set('category', e.target.value)}
                      >
                        {tags.map((t) => (
                          <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.addRow}>
                    <div className={styles.group}>
                      <label className={styles.label}>Rating</label>
                      <div className={styles.stars}>
                        {[1,2,3,4,5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={`${styles.star} ${n <= form.rating ? styles.starFilled : ''}`}
                            onClick={() => set('rating', n)}
                          >★</button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.group}>
                      <label className={styles.label}>Status</label>
                      <div className={styles.toggle}>
                        <button
                          type="button"
                          className={`${styles.toggleBtn} ${!form.been ? styles.toggleActive : ''}`}
                          onClick={() => set('been', false)}
                        >Want to go</button>
                        <button
                          type="button"
                          className={`${styles.toggleBtn} ${form.been ? styles.toggleActive : ''}`}
                          onClick={() => set('been', true)}
                        >Been here</button>
                      </div>
                    </div>
                  </div>

                  <Textarea
                    label="Personal note"
                    placeholder="Why this place? A memory, a must-order dish…"
                    value={form.note}
                    onChange={(e) => set('note', e.target.value)}
                  />

                  <div className={styles.addActions}>
                    <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" loading={saving}>Save Place</Button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
