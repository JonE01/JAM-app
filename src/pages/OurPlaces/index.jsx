import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useCollection } from '../../hooks/useCollection';
import PageTransition from '../../components/layout/PageTransition';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input, { Textarea } from '../../components/ui/Input';
import styles from './OurPlaces.module.css';

// ------------------------------------------------------------------
// Map marker icons by category (CSS-drawn, no external images needed)
// ------------------------------------------------------------------
const CATEGORIES = [
  { id: 'all',        label: 'All',         emoji: '◎', color: '#C0606A' },
  { id: 'restaurant', label: 'Restaurant',  emoji: '🍜', color: '#C9A96E' },
  { id: 'park',       label: 'Park',        emoji: '🌿', color: '#6BAE75' },
  { id: 'cafe',       label: 'Café',        emoji: '☕', color: '#9B7A3C' },
  { id: 'date-spot',  label: 'Date Spot',   emoji: '♡',  color: '#C0606A' },
  { id: 'activity',   label: 'Activity',    emoji: '✦',  color: '#7B6FA0' },
  { id: 'other',      label: 'Other',       emoji: '◦',  color: '#9A7A6A' },
];

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

const ICONS = Object.fromEntries(
  CATEGORIES.filter((c) => c.id !== 'all').map((c) => [c.id, makeIcon(c.emoji, c.color)])
);

// Click-on-map handler component
function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// ------------------------------------------------------------------

const BLANK = {
  name:      '',
  category:  'restaurant',
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
  const [catFilter, setCat]     = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(BLANK);
  const [saving, setSaving]     = useState(false);
  const [selected, setSelected] = useState(null); // place being viewed in sidebar detail
  const [search, setSearch]     = useState('');
  const mapRef = useRef(null);

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
      await add({ ...form, name: form.name.trim() });
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

  const catMeta = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

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

            {/* Category filter */}
            <div className={styles.cats}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={`${styles.catBtn} ${catFilter === cat.id ? styles.catActive : ''}`}
                  onClick={() => setCat(cat.id)}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>

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
                icon={ICONS[place.category] ?? ICONS['other']}
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
                        value={form.category}
                        onChange={(e) => set('category', e.target.value)}
                      >
                        {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                          <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
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
