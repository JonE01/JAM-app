import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import styles from './TagManager.module.css';

const QUICK_EMOJI = [
  '🍜','🍕','🍣','🍷','🍦','🧁','🥗','🍔',
  '☕','🧋','🍵','🥂',
  '🌿','🌊','🏔️','🌅','🌸','🌻','🌙','⭐',
  '♡','✦','✨','💫','🎯','🎲','🎨','🎭',
  '🎶','🎬','🎪','🛍️','🚴','🛶','🏊','🧘',
];

export default function TagManager({ tags, onAdd, onRemove }) {
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState('');
  const [emoji, setEmoji]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !emoji) return;
    setSaving(true);
    try {
      await onAdd(name, emoji);
      setName('');
      setEmoji('');
      setShowPicker(false);
      toast.success('Tag added ♡');
    } catch {
      toast.error('Failed to add tag');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (tag) => {
    try {
      await onRemove(tag.id);
      toast.success('Tag removed');
    } catch {
      toast.error('Failed to remove tag');
    }
  };

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen((v) => !v)}>
        <span>🏷</span> Edit Tags <span className={styles.chevron}>{open ? '▴' : '▾'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.dropdown}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            <p className={styles.heading}>Tags</p>

            {/* Tag list */}
            <ul className={styles.list}>
              {tags.map((tag) => (
                <li key={tag.id} className={styles.tagRow}>
                  <span className={styles.tagEmoji}>{tag.emoji}</span>
                  <span className={styles.tagName}>{tag.name}</span>
                  {tag.isDefault
                    ? <span className={styles.defaultLabel}>default</span>
                    : (
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleRemove(tag)}
                        aria-label={`Remove ${tag.name}`}
                      >×</button>
                    )
                  }
                </li>
              ))}
            </ul>

            {/* Add form */}
            <div className={styles.divider} />
            <p className={styles.subheading}>Add a tag</p>

            <form onSubmit={handleAdd} className={styles.addForm}>
              {/* Emoji selector */}
              <div className={styles.emojiRow}>
                <button
                  type="button"
                  className={styles.emojiPreview}
                  onClick={() => setShowPicker((v) => !v)}
                  title="Pick an emoji"
                >
                  {emoji || '＋'}
                </button>
                <input
                  className={styles.nameInput}
                  placeholder="Tag name…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  required
                />
                <button
                  type="submit"
                  className={styles.addBtn}
                  disabled={!name.trim() || !emoji || saving}
                >
                  {saving ? '…' : 'Add'}
                </button>
              </div>

              {/* Emoji quick-pick grid */}
              <AnimatePresence>
                {showPicker && (
                  <motion.div
                    className={styles.emojiGrid}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    {QUICK_EMOJI.map((e) => (
                      <button
                        key={e}
                        type="button"
                        className={`${styles.emojiCell} ${emoji === e ? styles.emojiCellActive : ''}`}
                        onClick={() => { setEmoji(e); setShowPicker(false); }}
                      >
                        {e}
                      </button>
                    ))}
                    {/* Custom emoji text input */}
                    <input
                      className={styles.customEmojiInput}
                      placeholder="✏️"
                      maxLength={2}
                      value={emoji}
                      onChange={(e) => setEmoji(e.target.value)}
                      title="Or type a custom emoji"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
