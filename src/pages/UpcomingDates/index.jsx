import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isSameDay, parseISO, isToday, isTomorrow } from 'date-fns';
import PageTransition from '../../components/layout/PageTransition';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import {
  initGoogleCalendar,
  requestAuth,
  isAuthed,
  listUpcomingEvents,
} from '../../lib/googleCalendar';
import styles from './UpcomingDates.module.css';

const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID;

function humanDate(event) {
  const start = event.start?.dateTime ?? event.start?.date;
  if (!start) return '';
  const d = parseISO(start);
  if (isToday(d))    return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEEE, MMMM d');
}

function humanTime(event) {
  const start = event.start?.dateTime;
  const end   = event.end?.dateTime;
  if (!start) return 'All day';
  const s = format(parseISO(start), 'h:mm a');
  const e = end ? format(parseISO(end), 'h:mm a') : null;
  return e ? `${s} – ${e}` : s;
}

function DateCard({ event, index }) {
  const [expanded, setExpanded] = useState(false);
  const label = humanDate(event);
  const isSpecial = isToday(parseISO(event.start?.dateTime ?? event.start?.date));

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={styles.timelineItem}
    >
      {/* Timeline dot */}
      <div className={`${styles.dot} ${isSpecial ? styles.dotActive : ''}`} />

      <Card
        hover
        className={`${styles.eventCard} ${isSpecial ? styles.eventCardToday : ''}`}
        onClick={() => setExpanded((v) => !v)}
        style={{ cursor: 'pointer' }}
      >
        <div className={styles.eventHeader}>
          <div className={styles.eventMeta}>
            <Badge variant={isSpecial ? 'rose' : 'cream'}>{label}</Badge>
            <p className={styles.eventTime}>{humanTime(event)}</p>
          </div>
          <span className={styles.chevron} style={{ transform: expanded ? 'rotate(180deg)' : '' }}>
            ›
          </span>
        </div>

        <h3 className={styles.eventTitle}>{event.summary}</h3>

        {event.location && (
          <p className={styles.eventLocation}>
            <span>◎</span> {event.location}
          </p>
        )}

        <AnimatePresence>
          {expanded && event.description && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={styles.eventDesc}
            >
              {event.description}
            </motion.p>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export default function UpcomingDates() {
  const [events, setEvents]   = useState([]);
  const [authed, setAuthed]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [inited, setInited]   = useState(false);

  useEffect(() => {
    initGoogleCalendar()
      .then(() => setInited(true))
      .catch((e) => setError(e.message));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listUpcomingEvents(CALENDAR_ID, 30);
      setEvents(items);
    } catch (e) {
      setError(e.message ?? 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!inited) {
        await initGoogleCalendar();
        setInited(true);
      }
      await requestAuth();
      setAuthed(true);
      await load();
    } catch (e) {
      setError(e.error_description ?? e.message ?? 'Auth failed');
      setLoading(false);
    }
  };

  // Auto-load if already authed (token still in memory after tab switch)
  useEffect(() => {
    if (inited && isAuthed()) {
      setAuthed(true);
      load();
    }
  }, [inited, load]);

  // Group events by date label
  const grouped = events.reduce((acc, ev) => {
    const key = humanDate(ev);
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  return (
    <PageTransition className={styles.page}>
      {/* Page header */}
      <div className={styles.header}>
        <div className="container">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={styles.title}
          >
            Upcoming Dates
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className={styles.subtitle}
          >
            What we have planned together
          </motion.p>
        </div>
      </div>

      <div className="container">
        {/* Auth gate */}
        {!authed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className={styles.authGate}
          >
            <div className={styles.authIcon}>📅</div>
            <h2 className={styles.authTitle}>Connect Google Calendar</h2>
            <p className={styles.authText}>
              Sign in to see your upcoming dates from our shared calendar.
            </p>
            <Button
              onClick={handleAuth}
              loading={loading || (!inited && !error)}
              size="lg"
            >
              {error ? 'Retry' : 'Connect Calendar'}
            </Button>
            {error && (
              <p className={styles.errorMsg}>
                {error.includes('popup') || error.includes('Popup')
                  ? 'Popup blocked — allow popups for this site in your browser and try again.'
                  : error}
              </p>
            )}
            {!error && !authed && (
              <p className={styles.popupHint}>A Google sign-in window will open — allow popups if prompted.</p>
            )}
          </motion.div>
        )}

        {/* Event timeline */}
        {authed && (
          <div className={styles.timeline}>
            {loading && (
              <div className={styles.loadingState}>
                {[0,1,2].map(i => (
                  <div key={i} className={styles.skeleton} />
                ))}
              </div>
            )}

            {!loading && events.length === 0 && (
              <div className={styles.empty}>
                <p className={styles.emptyIcon}>✦</p>
                <p>No upcoming dates found in the calendar.</p>
                <Button variant="ghost" size="sm" onClick={load}>Refresh</Button>
              </div>
            )}

            {!loading && events.map((ev, i) => (
              <DateCard key={ev.id} event={ev} index={i} />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
