import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, CircleMarker, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useCollection } from '../../hooks/useCollection';
import { useTags } from '../../hooks/useTags';
import TagManager from '../../components/ui/TagManager';
import PageTransition from '../../components/layout/PageTransition';
import Button from '../../components/ui/Button';
import Input, { Textarea } from '../../components/ui/Input';
import styles from './OurPlaces.module.css';

// ------------------------------------------------------------------
// Map marker icon factory
// opts: { been, wantScore (1-3), rating (0-5) }
// ------------------------------------------------------------------
function makeIcon(emoji, color, { been = false, wantScore = 0, rating = 0 } = {}) {
  const bangs = !been && wantScore > 0 ? '!'.repeat(Math.min(3, wantScore)) : '';
  const stars = been && rating > 0 ? '★'.repeat(Math.min(5, rating)) : '';
  const topPad = bangs ? 14 : 0;
  const botPad = stars ? 14 : 0;
  const totalH = topPad + 44 + botPad;
  const border = been ? '#C9A96E' : 'white';
  const strokeW = been ? 2.5 : 2;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="${totalH}" viewBox="0 0 36 ${totalH}">`,
    bangs ? `<text x="18" y="11" text-anchor="middle" font-size="11" font-weight="bold" fill="#D4879A" font-family="sans-serif">${bangs}</text>` : '',
    `<g transform="translate(0,${topPad})">`,
    `<ellipse cx="18" cy="40" rx="8" ry="4" fill="rgba(0,0,0,0.15)"/>`,
    `<path d="M18 2 C9 2 2 9 2 18 C2 30 18 42 18 42 C18 42 34 30 34 18 C34 9 27 2 18 2Z" fill="${color}" stroke="${border}" stroke-width="${strokeW}"/>`,
    `<text x="18" y="22" text-anchor="middle" font-size="14" fill="white" font-family="sans-serif">${emoji}</text>`,
    `</g>`,
    stars ? `<text x="18" y="${topPad + 56}" text-anchor="middle" font-size="9" fill="#C9A96E" font-family="sans-serif">${stars}</text>` : '',
    `</svg>`,
  ].join('');

  return L.icon({
    iconUrl:     `data:image/svg+xml,${encodeURIComponent(svg)}`,
    iconSize:    [36, totalH],
    iconAnchor:  [18, topPad + 44],
    popupAnchor: [0, -(topPad + 44)],
  });
}

// Blue dot for current user location
const LOC_DOT = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="9" fill="#3B82F6" fill-opacity="0.25"/><circle cx="10" cy="10" r="5" fill="#3B82F6"/><circle cx="10" cy="10" r="5" fill="none" stroke="white" stroke-width="2"/></svg>`;
  return L.icon({ iconUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`, iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -14] });
})();

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// ------------------------------------------------------------------
// Google Places loader (reuses VITE_GOOGLE_API_KEY)
// ------------------------------------------------------------------
let placesScriptLoaded = false;
function loadGooglePlaces() {
  if (window.google?.maps?.places) return Promise.resolve();
  if (placesScriptLoaded) {
    return new Promise((res) => {
      const id = setInterval(() => { if (window.google?.maps?.places) { clearInterval(id); res(); } }, 100);
    });
  }
  placesScriptLoaded = true;
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_API_KEY}&libraries=places`;
    s.async = true; s.onload = res; s.onerror = rej;
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
  name: '', category: '', note: '',
  rating: 0, wantScore: 2,
  been: false, lat: null, lng: null,
};

const CITY_CENTER = [
  parseFloat(import.meta.env.VITE_MAP_LAT ?? '40.7128'),
  parseFloat(import.meta.env.VITE_MAP_LNG ?? '-74.0060'),
];
const CITY_ZOOM = parseInt(import.meta.env.VITE_MAP_ZOOM ?? '13', 10);

export default function OurPlaces() {
  const { docs: places, add, update, remove, loading } = useCollection('places', 'createdAt');
  const { docs: ideas }                                 = useCollection('dateIdeas', 'createdAt');
  const { tags, addTag, removeTag, getTag }             = useTags();

  const [catFilter, setCat]     = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch]     = useState('');
  const [placesReady, setPlacesReady] = useState(false);
  const [userPos, setUserPos]   = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(0);

  const mapRef          = useRef(null);
  const searchRef       = useRef(null);
  const autocompleteRef = useRef(null);

  // Geolocation watch
  useEffect(() => {
    if (!navigator.geolocation) return;
    const wid = navigator.geolocation.watchPosition(
      (pos) => { setUserPos([pos.coords.latitude, pos.coords.longitude]); setUserAccuracy(pos.coords.accuracy); },
      null,
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(wid);
  }, []);

  // Google Places autocomplete for the search bar
  useEffect(() => {
    loadGooglePlaces().then(() => setPlacesReady(true)).catch(() => {});
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
      mapRef.current?.flyTo([lat, lng], 16, { duration: 1 });
      setForm(f => ({ ...f, name: place.name ?? '', lat, lng, category: guessCategory(place.types) }));
      setShowForm(true);
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

  const openEdit = (place) => {
    setEditingId(place.id);
    setForm({
      name:      place.name,
      category:  place.category,
      note:      place.note ?? '',
      rating:    place.rating ?? 0,
      wantScore: place.wantScore ?? 2,
      been:      place.been ?? false,
      lat:       place.lat,
      lng:       place.lng,
    });
    setShowForm(true);
    mapRef.current?.flyTo([place.lat, place.lng], 16, { duration: 1 });
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(BLANK);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.lat || !form.name.trim()) {
      toast.error('Tap the map to drop a pin first.');
      return;
    }
    setSaving(true);
    try {
      const data = { ...form, category: formCategory, name: form.name.trim() };
      if (editingId) {
        await update(editingId, data);
        toast.success('Place updated ♡');
      } else {
        await add(data);
        toast.success('Place saved ♡');
      }
      closeForm();
    } catch {
      toast.error(editingId ? 'Failed to update place' : 'Failed to save place');
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

  const formCategory = form.category || tags[0]?.id || 'other';

  // Compute per-place icons inline (small app, cheap)
  const getIcon = (place) => {
    const tag = getTag(place.category);
    return makeIcon(tag.emoji, tag.color, {
      been:      place.been ?? false,
      wantScore: place.wantScore ?? 0,
      rating:    place.rating ?? 0,
    });
  };

  // Reverse lookup: ideas linked to each place
  const linkedIdeasFor = (placeId) =>
    ideas.filter((idea) => (idea.locationIds ?? []).includes(placeId));

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
                >{tag.emoji} {tag.name}</button>
              ))}
            </div>

            <TagManager tags={tags} onAdd={addTag} onRemove={removeTag} />

            <p className={styles.hint}>Tap anywhere on the map to add a new place.</p>
          </div>

          <div className={styles.placeList}>
            {loading && <p className={styles.loadingText}>Loading places…</p>}
            {!loading && filtered.length === 0 && (
              <p className={styles.emptyText}>No places yet — tap the map!</p>
            )}
            <AnimatePresence>
              {filtered.map((place) => {
                const cat = getTag(place.category);
                const ideaCount = linkedIdeasFor(place.id).length;
                return (
                  <motion.div
                    key={place.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.25 }}
                    className={`${styles.placeItem} ${selected?.id === place.id ? styles.placeItemActive : ''} ${place.been ? styles.placeItemBeen : ''}`}
                    onClick={() => {
                      setSelected(selected?.id === place.id ? null : place);
                      mapRef.current?.flyTo([place.lat, place.lng], 16, { duration: 1 });
                    }}
                  >
                    <div className={styles.placeTop}>
                      <div className={styles.placeStatus}>
                        {place.been
                          ? <span className={styles.beenBadge}>✓ Been</span>
                          : <span className={styles.wantBadge}>◌ Want to go</span>}
                        {!place.been && (place.wantScore ?? 0) > 0 && (
                          <span className={styles.placeBangs}>{'!'.repeat(place.wantScore)}</span>
                        )}
                      </div>
                      <span className={styles.placeEmoji}>{cat.emoji}</span>
                    </div>
                    <p className={styles.placeName}>{place.name}</p>
                    <div className={styles.placeFooter}>
                      {place.been && (place.rating ?? 0) > 0 && (
                        <span className={styles.placeRating}>
                          {'★'.repeat(place.rating)}{'☆'.repeat(5 - place.rating)}
                        </span>
                      )}
                      {ideaCount > 0 && (
                        <span className={styles.placeIdeaCount}>{ideaCount} idea{ideaCount > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <button
                      className={styles.editBtn}
                      onClick={(e) => { e.stopPropagation(); openEdit(place); }}
                      aria-label="Edit place"
                    >✎</button>
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

          {/* Where am I button */}
          {userPos && (
            <button
              className={styles.locBtn}
              onClick={() => mapRef.current?.flyTo(userPos, 17, { duration: 1 })}
              title="Centre on my location"
            >◎</button>
          )}

          <MapContainer center={CITY_CENTER} zoom={CITY_ZOOM} className={styles.map} ref={mapRef}>
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">Carto</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={19}
            />
            <MapClickHandler onMapClick={handleMapClick} />

            {/* Place markers */}
            {filtered.map((place) => {
              const icon       = getIcon(place);
              const linked     = linkedIdeasFor(place.id);
              return (
                <Marker
                  key={place.id}
                  position={[place.lat, place.lng]}
                  icon={icon}
                  eventHandlers={{ click: () => setSelected(place) }}
                >
                  <Popup>
                    <div className={styles.popup}>
                      <strong className={styles.popupName}>{place.name}</strong>

                      {place.note && <p className={styles.popupNote}>{place.note}</p>}

                      {place.been && (place.rating ?? 0) > 0 && (
                        <p className={styles.popupRating}>
                          {'★'.repeat(place.rating)}{'☆'.repeat(5 - place.rating)}
                        </p>
                      )}

                      {!place.been && (place.wantScore ?? 0) > 0 && (
                        <p className={styles.popupBangs}>
                          {'!'.repeat(place.wantScore)} excited
                        </p>
                      )}

                      {linked.length > 0 && (
                        <div className={styles.popupIdeas}>
                          <p className={styles.popupIdeasLabel}>Date ideas here:</p>
                          {linked.map((idea) => (
                            <span key={idea.id} className={styles.popupIdeaChip}>{idea.title}</span>
                          ))}
                        </div>
                      )}

                      <div className={styles.popupActions}>
                        <button onClick={() => toggleBeen(place)}>
                          {place.been ? '✓ Been here' : '◌ Want to go'}
                        </button>
                        <button onClick={() => openEdit(place)}>✎ Edit</button>
                        <button onClick={() => handleRemove(place.id)} style={{ color: '#ef4444' }}>Remove</button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Current location */}
            {userPos && (
              <>
                {userAccuracy > 30 && (
                  <Circle
                    center={userPos}
                    radius={userAccuracy}
                    pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.08, weight: 1 }}
                  />
                )}
                <Marker position={userPos} icon={LOC_DOT}>
                  <Popup>You are here</Popup>
                </Marker>
              </>
            )}
          </MapContainer>

          {/* Add / Edit place panel */}
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
                <form onSubmit={handleSubmit} className={styles.addForm}>
                  <h3 className={styles.addTitle}>{editingId ? 'Edit Place' : 'Add a Place'}</h3>
                  {!editingId && (
                    <p className={styles.addCoords}>
                      {form.lat ? `📍 ${form.lat.toFixed(5)}, ${form.lng.toFixed(5)}` : '📍 Tap the map to set location'}
                    </p>
                  )}

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
                    {/* Status toggle */}
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

                    {/* Excitement (! marks) — only when not been */}
                    {!form.been && (
                      <div className={styles.group}>
                        <label className={styles.label}>Excitement</label>
                        <div className={styles.bangs}>
                          {[1, 2, 3].map((n) => (
                            <button
                              key={n}
                              type="button"
                              className={`${styles.bangBtn} ${form.wantScore >= n ? styles.bangFilled : ''}`}
                              onClick={() => set('wantScore', form.wantScore === n ? 0 : n)}
                            >{'!'.repeat(n)}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rating stars — always visible, meaningful when been=true */}
                    <div className={styles.group}>
                      <label className={styles.label}>Rating</label>
                      <div className={styles.stars}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={`${styles.star} ${n <= form.rating ? styles.starFilled : ''}`}
                            onClick={() => set('rating', form.rating === n ? 0 : n)}
                          >★</button>
                        ))}
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
                    {editingId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(editingId).then(closeForm)}
                        style={{ color: '#ef4444', marginRight: 'auto' }}
                      >Delete</Button>
                    )}
                    <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
                    <Button type="submit" loading={saving}>{editingId ? 'Save Changes' : 'Save Place'}</Button>
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
