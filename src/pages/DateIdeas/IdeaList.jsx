import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useCollection } from '../../hooks/useCollection';
import { useTags } from '../../hooks/useTags';
import TagManager from '../../components/ui/TagManager';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Textarea } from '../../components/ui/Input';
import styles from './IdeaList.module.css';

// ---- Google Places (reuses VITE_GOOGLE_API_KEY) ----------------------
let placesLoaded = false;
function loadGooglePlaces() {
  if (window.google?.maps?.places) return Promise.resolve();
  if (placesLoaded) {
    return new Promise((res) => {
      const id = setInterval(() => { if (window.google?.maps?.places) { clearInterval(id); res(); } }, 100);
    });
  }
  placesLoaded = true;
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
  if (types.some(t => ['museum', 'art_gallery', 'library', 'bowling_alley', 'spa'].includes(t))) return 'activity';
  return 'other';
}

// -----------------------------------------------------------------------

const BLANK = { title: '', category: '', notes: '', locationIds: [] };

// ---- Location section sub-component ----------------------------------
function LocationSection({ locationIds, onChange, places, addPlace }) {
  const [query, setQuery]       = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const [gReady, setGReady]     = useState(false);
  const inputRef  = useRef(null);
  const acRef     = useRef(null);
  const wrapRef   = useRef(null);

  useEffect(() => {
    loadGooglePlaces().then(() => setGReady(true)).catch(() => {});
  }, []);

  // Wire up Google autocomplete once the input is mounted and API is ready
  useEffect(() => {
    if (!gReady || !inputRef.current || acRef.current) return;
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ['geometry', 'name', 'types'],
    });
    ac.addListener('place_changed', async () => {
      const p = ac.getPlace();
      if (!p.geometry?.location) return;

      const lat  = p.geometry.location.lat();
      const lng  = p.geometry.location.lng();
      const name = p.name ?? '';

      // Check if it already exists in our map (case-insensitive name match)
      const existing = places.find((pl) => pl.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        if (!locationIds.includes(existing.id)) onChange([...locationIds, existing.id]);
        toast(`Linked to existing pin: ${existing.name}`);
      } else {
        try {
          const ref = await addPlace({
            name,
            lat, lng,
            category:  guessCategory(p.types ?? []),
            note:      '',
            rating:    0,
            wantScore: 2,
            been:      false,
          });
          onChange([...locationIds, ref.id]);
          toast.success(`${name} added to the map ♡`);
        } catch {
          toast.error('Could not add place to the map');
        }
      }
      if (inputRef.current) inputRef.current.value = '';
      setQuery('');
      setDropOpen(false);
    });
    acRef.current = ac;
  }, [gReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = places.filter(
    (p) => !locationIds.includes(p.id) && p.name.toLowerCase().includes(query.toLowerCase())
  );

  const linkExisting = (id) => {
    onChange([...locationIds, id]);
    setQuery('');
    setDropOpen(false);
  };

  const unlink = (id) => onChange(locationIds.filter((i) => i !== id));

  const linkedPlaces = locationIds.map((id) => places.find((p) => p.id === id)).filter(Boolean);

  return (
    <div className={styles.locSection}>
      <label className={styles.label}>Linked Places</label>

      {linkedPlaces.length > 0 && (
        <div className={styles.locChips}>
          {linkedPlaces.map((p) => (
            <span key={p.id} className={styles.locChip}>
              {p.name}
              <button type="button" onClick={() => unlink(p.id)} aria-label="Remove">×</button>
            </span>
          ))}
        </div>
      )}

      <div ref={wrapRef} className={styles.locInputWrap}>
        <input
          ref={inputRef}
          className={styles.locInput}
          placeholder={gReady ? 'Search existing or add new place…' : 'Loading search…'}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setDropOpen(true); }}
          onFocus={() => setDropOpen(true)}
          autoComplete="off"
        />
        <AnimatePresence>
          {dropOpen && query && (
            <motion.div
              className={styles.locDrop}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
            >
              {filtered.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.locDropItem}
                  onMouseDown={() => linkExisting(p.id)}
                >
                  <span>{p.name}</span>
                  <span className={styles.locDropMeta}>{p.been ? '✓ Been' : '◌ Want to go'}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className={styles.locDropEmpty}>
                  Not on your map yet — select from Google suggestions above to add it.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------

export default function IdeaList() {
  const { docs: ideas, add, update, remove, loading, error: dbError } = useCollection('dateIdeas', 'createdAt');
  const { docs: places, add: addPlace }                               = useCollection('places', 'createdAt');
  const { tags, addTag, removeTag, getTag }                           = useTags();

  const [search, setSearch]       = useState('');
  const [catFilter, setCat]       = useState('all');
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(BLANK);
  const [saving, setSaving]       = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm]   = useState(BLANK);

  const firstTagId   = tags[0]?.id ?? '';
  const formCategory = form.category     || firstTagId;
  const editCategory = editForm.category || firstTagId;

  const filtered = ideas.filter((idea) => {
    const matchCat    = catFilter === 'all' || idea.category === catFilter;
    const matchSearch = idea.title.toLowerCase().includes(search.toLowerCase()) ||
                        (idea.notes ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Add ──────────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await add({ ...form, category: formCategory, title: form.title.trim(), locationIds: form.locationIds ?? [] });
      setForm(BLANK);
      setShowForm(false);
      toast.success('Date idea added ♡');
    } catch {
      toast.error('Failed to save idea');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────
  const startEdit = (idea) => {
    setEditingId(idea.id);
    setEditForm({
      title:       idea.title,
      category:    idea.category,
      notes:       idea.notes ?? '',
      locationIds: idea.locationIds ?? [],
    });
    setShowForm(false);
  };

  const handleUpdate = async (e, id) => {
    e.preventDefault();
    if (!editForm.title.trim()) return;
    setSaving(true);
    try {
      await update(id, {
        title:       editForm.title.trim(),
        category:    editCategory,
        notes:       editForm.notes,
        locationIds: editForm.locationIds ?? [],
      });
      setEditingId(null);
      toast.success('Idea updated ♡');
    } catch {
      toast.error('Failed to update idea');
    } finally {
      setSaving(false);
    }
  };

  // ── Remove ────────────────────────────────────────────────────────────
  const handleRemove = async (id) => {
    try { await remove(id); toast.success('Removed'); }
    catch { toast.error('Failed to remove'); }
  };

  return (
    <div className={styles.wrapper}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          placeholder="Search ideas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <TagManager tags={tags} onAdd={addTag} onRemove={removeTag} />
        <Button size="sm" onClick={() => { setShowForm(true); setEditingId(null); }}>+ Add Idea</Button>
      </div>

      {/* Tag filter chips */}
      <div className={styles.cats}>
        <button
          className={`${styles.catBtn} ${catFilter === 'all' ? styles.catActive : ''}`}
          onClick={() => setCat('all')}
        >✦ All</button>
        {tags.map((tag) => (
          <button
            key={tag.id}
            className={`${styles.catBtn} ${catFilter === tag.id ? styles.catActive : ''}`}
            onClick={() => setCat(tag.id)}
          >{tag.emoji} {tag.name}</button>
        ))}
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <Card className={styles.addCard}>
              <form onSubmit={handleAdd} className={styles.addForm}>
                <h3 className={styles.addTitle}>New Date Idea</h3>
                <Input
                  label="What's the idea?"
                  placeholder="e.g. Picnic at the botanical garden"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
                <div className={styles.addRow}>
                  <div className={styles.group}>
                    <label className={styles.label}>Tag</label>
                    <select
                      className={styles.select}
                      value={formCategory}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      {tags.map((t) => (
                        <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Textarea
                  label="Notes (optional)"
                  placeholder="Any details, places, or vibes…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
                <LocationSection
                  locationIds={form.locationIds}
                  onChange={(ids) => setForm((f) => ({ ...f, locationIds: ids }))}
                  places={places}
                  addPlace={addPlace}
                />
                <div className={styles.addActions}>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" loading={saving}>Save Idea</Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Firebase error */}
      {dbError && (
        <div className={styles.dbError}>
          <strong>Couldn't connect to the database.</strong>{' '}
          {dbError.includes('Missing or insufficient permissions')
            ? 'Check your Firestore security rules in the Firebase console.'
            : dbError.includes('offline')
            ? 'You appear to be offline — ideas will sync when you reconnect.'
            : `Firebase error: ${dbError}`}
        </div>
      )}

      {/* Ideas grid */}
      {loading && (
        <div className={styles.loadingGrid}>
          {[0, 1, 2, 3].map((i) => <div key={i} className={styles.skeleton} />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyIcon}>✦</p>
          <p>{search ? 'No ideas match your search.' : 'No ideas yet — add one above!'}</p>
        </div>
      )}

      <div className={styles.grid}>
        <AnimatePresence>
          {filtered.map((idea, i) => {
            const tag       = getTag(idea.category);
            const isEditing = editingId === idea.id;
            const locPlaces = (idea.locationIds ?? []).map((id) => places.find((p) => p.id === id)).filter(Boolean);

            return (
              <motion.div
                key={idea.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <Card hover={!isEditing} padding="md" className={styles.ideaCard}>
                  <AnimatePresence mode="wait">
                    {isEditing ? (
                      /* ── Edit form ── */
                      <motion.form
                        key="edit"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onSubmit={(e) => handleUpdate(e, idea.id)}
                        className={styles.editForm}
                      >
                        <Input
                          label="Idea"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          required
                        />
                        <div className={styles.group}>
                          <label className={styles.label}>Tag</label>
                          <select
                            className={styles.select}
                            value={editCategory}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          >
                            {tags.map((t) => (
                              <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                            ))}
                          </select>
                        </div>
                        <Textarea
                          label="Notes"
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        />
                        <LocationSection
                          locationIds={editForm.locationIds}
                          onChange={(ids) => setEditForm((f) => ({ ...f, locationIds: ids }))}
                          places={places}
                          addPlace={addPlace}
                        />
                        <div className={styles.editActions}>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                          <Button type="submit" size="sm" loading={saving}>Save</Button>
                        </div>
                      </motion.form>
                    ) : (
                      /* ── Display view ── */
                      <motion.div
                        key="view"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <div className={styles.ideaTop}>
                          <span className={styles.ideaTagBadge} style={{ background: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}55` }}>
                            {tag.emoji} {tag.name}
                          </span>
                          <div className={styles.ideaActions}>
                            <button className={styles.editBtn} onClick={() => startEdit(idea)} aria-label="Edit idea">✎</button>
                            <button className={styles.removeBtn} onClick={() => handleRemove(idea.id)} aria-label="Remove idea">×</button>
                          </div>
                        </div>
                        <h3 className={styles.ideaTitle}>{idea.title}</h3>
                        {idea.notes && <p className={styles.ideaNotes}>{idea.notes}</p>}

                        {locPlaces.length > 0 && (
                          <div className={styles.ideaLocs}>
                            {locPlaces.map((p) => (
                              <span key={p.id} className={styles.ideaLocChip}>
                                📍 {p.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
