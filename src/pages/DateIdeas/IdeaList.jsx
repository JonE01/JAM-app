import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useCollection } from '../../hooks/useCollection';
import { useTags } from '../../hooks/useTags';
import TagManager from '../../components/ui/TagManager';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input, { Textarea } from '../../components/ui/Input';
import styles from './IdeaList.module.css';

const BLANK = { title: '', category: '', notes: '' };

export default function IdeaList() {
  const { docs: ideas, add, update, remove, loading, error: dbError } = useCollection('dateIdeas', 'createdAt');
  const { tags, addTag, removeTag, getTag } = useTags();

  const [search, setSearch]       = useState('');
  const [catFilter, setCat]       = useState('all');
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(BLANK);
  const [saving, setSaving]       = useState(false);
  const [editingId, setEditingId] = useState(null);   // id of card being edited
  const [editForm, setEditForm]   = useState(BLANK);  // edit form state

  const firstTagId    = tags[0]?.id ?? '';
  const formCategory  = form.category     || firstTagId;
  const editCategory  = editForm.category || firstTagId;

  const filtered = ideas.filter((idea) => {
    const matchCat    = catFilter === 'all' || idea.category === catFilter;
    const matchSearch = idea.title.toLowerCase().includes(search.toLowerCase()) ||
                        (idea.notes ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Add ──────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await add({ ...form, category: formCategory, title: form.title.trim() });
      setForm(BLANK);
      setShowForm(false);
      toast.success('Date idea added ♡');
    } catch {
      toast.error('Failed to save idea');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────
  const startEdit = (idea) => {
    setEditingId(idea.id);
    setEditForm({ title: idea.title, category: idea.category, notes: idea.notes ?? '' });
    setShowForm(false); // close add form if open
  };

  const handleUpdate = async (e, id) => {
    e.preventDefault();
    if (!editForm.title.trim()) return;
    setSaving(true);
    try {
      await update(id, {
        title:    editForm.title.trim(),
        category: editCategory,
        notes:    editForm.notes,
      });
      setEditingId(null);
      toast.success('Idea updated ♡');
    } catch {
      toast.error('Failed to update idea');
    } finally {
      setSaving(false);
    }
  };

  // ── Remove ───────────────────────────────────────────────────────
  const handleRemove = async (id) => {
    try {
      await remove(id);
      toast.success('Removed');
    } catch {
      toast.error('Failed to remove');
    }
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
          >
            {tag.emoji} {tag.name}
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
            const tag      = getTag(idea.category);
            const isEditing = editingId === idea.id;

            return (
              <motion.div
                key={idea.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <Card hover={!isEditing} padding={isEditing ? 'md' : 'md'} className={styles.ideaCard}>
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
                        <div className={styles.editActions}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
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
                          <Badge variant="gold">{tag.emoji} {tag.name}</Badge>
                          <div className={styles.ideaActions}>
                            <button
                              className={styles.editBtn}
                              onClick={() => startEdit(idea)}
                              aria-label="Edit idea"
                            >✎</button>
                            <button
                              className={styles.removeBtn}
                              onClick={() => handleRemove(idea.id)}
                              aria-label="Remove idea"
                            >×</button>
                          </div>
                        </div>
                        <h3 className={styles.ideaTitle}>{idea.title}</h3>
                        {idea.notes && <p className={styles.ideaNotes}>{idea.notes}</p>}
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
