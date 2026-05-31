import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useCollection } from '../../hooks/useCollection';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input, { Textarea } from '../../components/ui/Input';
import styles from './IdeaList.module.css';

export const CATEGORIES = [
  { id: 'all',       label: 'All',       emoji: '✦' },
  { id: 'outdoor',   label: 'Outdoor',   emoji: '🌿' },
  { id: 'food',      label: 'Food',      emoji: '🍜' },
  { id: 'cozy',      label: 'Cozy',      emoji: '☕' },
  { id: 'adventure', label: 'Adventure', emoji: '🗺️' },
  { id: 'culture',   label: 'Culture',   emoji: '🎭' },
  { id: 'romantic',  label: 'Romantic',  emoji: '♡' },
];

const BLANK = { title: '', category: 'outdoor', notes: '' };

export default function IdeaList() {
  const { docs: ideas, add, remove, loading, error: dbError } = useCollection('dateIdeas', 'createdAt');
  const [search, setSearch]     = useState('');
  const [catFilter, setCat]     = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(BLANK);
  const [saving, setSaving]     = useState(false);

  const filtered = ideas.filter((idea) => {
    const matchCat    = catFilter === 'all' || idea.category === catFilter;
    const matchSearch = idea.title.toLowerCase().includes(search.toLowerCase()) ||
                        (idea.notes ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await add({ ...form, title: form.title.trim() });
      setForm(BLANK);
      setShowForm(false);
      toast.success('Date idea added ♡');
    } catch (err) {
      toast.error('Failed to save idea');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id) => {
    try {
      await remove(id);
      toast.success('Removed');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const catMeta = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[1];

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
        <Button size="sm" onClick={() => setShowForm(true)}>+ Add Idea</Button>
      </div>

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
                    <label className={styles.label}>Category</label>
                    <select
                      className={styles.select}
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                        <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
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
                <div className={styles.addActions}>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={saving}>Save Idea</Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Firebase connection error */}
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
          {[0,1,2,3].map(i => <div key={i} className={styles.skeleton} />)}
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
            const cat = catMeta(idea.category);
            return (
              <motion.div
                key={idea.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <Card hover className={styles.ideaCard}>
                  <div className={styles.ideaTop}>
                    <Badge variant="gold">{cat.emoji} {cat.label}</Badge>
                    <button
                      className={styles.removeBtn}
                      onClick={() => handleRemove(idea.id)}
                      aria-label="Remove idea"
                    >×</button>
                  </div>
                  <h3 className={styles.ideaTitle}>{idea.title}</h3>
                  {idea.notes && <p className={styles.ideaNotes}>{idea.notes}</p>}
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
