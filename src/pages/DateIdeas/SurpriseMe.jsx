import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCollection } from '../../hooks/useCollection';
import { useTags } from '../../hooks/useTags';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import styles from './SurpriseMe.module.css';

const REVEAL_MESSAGES = [
  'Tonight you could…',
  'How about…',
  'The universe suggests…',
  'Your next adventure…',
  'This one sounds lovely…',
];

export default function SurpriseMe() {
  const { docs: ideas, loading } = useCollection('dateIdeas', 'createdAt');
  const { getTag } = useTags();
  const [picked, setPicked]      = useState(null);
  const [spinning, setSpinning]  = useState(false);
  const [msg, setMsg]            = useState('');

  const spin = async () => {
    if (ideas.length === 0) return;
    setSpinning(true);
    setPicked(null);

    // Brief "thinking" delay for drama
    await new Promise((r) => setTimeout(r, 900));

    const random = ideas[Math.floor(Math.random() * ideas.length)];
    setMsg(REVEAL_MESSAGES[Math.floor(Math.random() * REVEAL_MESSAGES.length)]);
    setPicked(random);
    setSpinning(false);
  };

  const cat = picked ? getTag(picked.category) : null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.center}>
        {/* Spin button */}
        <motion.button
          className={styles.spinBtn}
          onClick={spin}
          disabled={spinning || loading || ideas.length === 0}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          animate={spinning ? { rotate: [0, 15, -15, 10, -10, 0] } : {}}
          transition={spinning ? { duration: 0.9, ease: 'easeInOut' } : { duration: 0.15 }}
        >
          <span className={styles.spinHeart}>♡</span>
          <span className={styles.spinLabel}>
            {spinning ? 'Picking…' : 'Surprise Me'}
          </span>
        </motion.button>

        {ideas.length === 0 && !loading && (
          <p className={styles.hint}>Add some date ideas first in the All Ideas tab.</p>
        )}

        {/* Reveal card */}
        <AnimatePresence mode="wait">
          {picked && !spinning && (
            <motion.div
              key={picked.id}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className={styles.revealCard}
            >
              <p className={styles.revealMsg}>{msg}</p>
              <h2 className={styles.revealTitle}>{picked.title}</h2>
              {cat && (
                <Badge variant="gold" className={styles.revealBadge}>
                  {cat.emoji} {cat.label}
                </Badge>
              )}
              {picked.notes && (
                <p className={styles.revealNotes}>{picked.notes}</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={spin}
                className={styles.againBtn}
              >
                Try another ✦
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
