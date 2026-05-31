import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAlbumPhotos } from '../../lib/icloudAlbum';
import PageTransition from '../../components/layout/PageTransition';
import Button from '../../components/ui/Button';
import styles from './OurPhotos.module.css';

const ALBUM_TOKEN    = import.meta.env.VITE_ICLOUD_ALBUM_TOKEN;
const SLIDE_INTERVAL = 8000; // ms between transitions

export default function OurPhotos() {
  const [photos, setPhotos]     = useState([]);
  const [current, setCurrent]   = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [paused, setPaused]     = useState(false);
  const [progress, setProgress] = useState(0);

  const intervalRef    = useRef(null);
  const progressRef    = useRef(null);
  const progressStart  = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchAlbumPhotos(ALBUM_TOKEN);
      setPhotos(items);
      setCurrent(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Progress bar animation
  const resetProgress = useCallback(() => {
    setProgress(0);
    progressStart.current = performance.now();
    cancelAnimationFrame(progressRef.current);

    function tick(now) {
      const elapsed = now - progressStart.current;
      const pct     = Math.min(elapsed / SLIDE_INTERVAL, 1);
      setProgress(pct * 100);
      if (pct < 1) progressRef.current = requestAnimationFrame(tick);
    }
    progressRef.current = requestAnimationFrame(tick);
  }, []);

  // Auto-advance
  useEffect(() => {
    if (photos.length < 2 || paused) {
      clearInterval(intervalRef.current);
      cancelAnimationFrame(progressRef.current);
      return;
    }

    resetProgress();
    intervalRef.current = setInterval(() => {
      setCurrent((c) => {
        let next;
        do { next = Math.floor(Math.random() * photos.length); } while (next === c);
        return next;
      });
      resetProgress();
    }, SLIDE_INTERVAL);

    return () => {
      clearInterval(intervalRef.current);
      cancelAnimationFrame(progressRef.current);
    };
  }, [photos, paused, resetProgress]);

  const goTo = (idx) => {
    setCurrent(idx);
    resetProgress();
  };

  const prev = () => goTo((current - 1 + photos.length) % photos.length);
  const next = () => goTo((current + 1) % photos.length);

  const photo = photos[current];

  return (
    <PageTransition className={styles.page}>
      {loading && (
        <div className={styles.loadingFull}>
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className={styles.loadingHeart}
          >
            ♡
          </motion.div>
          <p>Loading our photos…</p>
        </div>
      )}

      {error && (
        <div className={styles.errorState}>
          <p className={styles.errorIcon}>✦</p>
          <h2>Couldn't load photos</h2>
          <p className={styles.errorDetail}>{error}</p>
          <p className={styles.errorNote}>
            Make sure <code>VITE_ICLOUD_ALBUM_TOKEN</code> is set and the album
            is publicly shared.
          </p>
          <Button onClick={load} variant="ghost">Try again</Button>
        </div>
      )}

      {!loading && !error && photos.length > 0 && (
        <div
          className={styles.gallery}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Full-bleed photo with crossfade */}
          <div className={styles.frame}>
            <AnimatePresence>
              <motion.img
                key={photo.guid}
                src={photo.url}
                alt={photo.caption || 'Our photo'}
                className={styles.photo}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
                draggable={false}
                onError={(e) => {
                  console.error('[iCloud] Image failed to load:', photo.url);
                  e.currentTarget.style.display = 'none';
                }}
              />
            </AnimatePresence>

            {/* Gradient overlay */}
            <div className={styles.overlay} />

            {/* Caption + date */}
            <AnimatePresence mode="wait">
              <motion.div
                key={photo.guid + '-caption'}
                className={styles.caption}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                {photo.caption && (
                  <p className={styles.captionText}>{photo.caption}</p>
                )}
                {/* Original capture date not available from iCloud shared album API */}
              </motion.div>
            </AnimatePresence>

            {/* Nav arrows */}
            <button
              className={`${styles.arrow} ${styles.arrowLeft}`}
              onClick={prev}
              aria-label="Previous"
            >‹</button>
            <button
              className={`${styles.arrow} ${styles.arrowRight}`}
              onClick={next}
              aria-label="Next"
            >›</button>

            {/* Pause badge */}
            {paused && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={styles.pausedBadge}
              >
                Paused
              </motion.div>
            )}
          </div>

          {/* Progress bar */}
          <div className={styles.progressTrack}>
            <motion.div
              className={styles.progressBar}
              style={{ width: `${paused ? progress : progress}%` }}
            />
          </div>

          {/* Dot indicators */}
          <div className={styles.dots}>
            {photos.map((_, i) => (
              <button
                key={i}
                className={`${styles.dotBtn} ${i === current ? styles.dotActive : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>

          {/* Photo count */}
          <p className={styles.counter}>
            {current + 1} / {photos.length}
          </p>
        </div>
      )}
    </PageTransition>
  );
}
