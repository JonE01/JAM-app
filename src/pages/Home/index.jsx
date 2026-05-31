import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCollection } from '../../hooks/useCollection';
import PageTransition from '../../components/layout/PageTransition';
import Card from '../../components/ui/Card';
import styles from './Home.module.css';

const WIDGETS = [
  { to: '/dates',  label: 'Upcoming Dates',  icon: '📅', color: 'rose' },
  { to: '/photos', label: 'Our Photos',      icon: '✦',  color: 'gold' },
  { to: '/ideas',  label: 'Date Ideas',      icon: '✧',  color: 'rose' },
  { to: '/places', label: 'Our Places',      icon: '◎',  color: 'gold' },
];

function useTimeGreeting() {
  const [greeting, setGreeting] = useState('');
  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);
  return greeting;
}

export default function Home() {
  const greeting = useTimeGreeting();
  const { docs: ideas  } = useCollection('dateIdeas', 'createdAt');
  const { docs: places } = useCollection('places', 'createdAt');

  return (
    <PageTransition className={styles.page}>
      {/* ---- Hero ---- */}
      <section className={styles.hero}>
        {/* Background image — drop hero.jpg in /public to enable */}
        <div className={styles.heroBg} />

        <div className={styles.heroOverlay} />

        <div className={styles.heroContent}>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className={styles.heroGreeting}
          >
            {greeting} ♡
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className={styles.heroTitle}
          >
            Our little
            <br />
            world, together.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className={styles.heroSub}
          >
            Made with love, just for us.
          </motion.p>
        </div>
      </section>

      {/* ---- Stats ribbon ---- */}
      <section className={styles.stats}>
        <div className="container">
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{ideas.length}</span>
              <span className={styles.statLabel}>date ideas</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNum}>{places.length}</span>
              <span className={styles.statLabel}>saved places</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNum}>
                {places.filter((p) => p.been).length}
              </span>
              <span className={styles.statLabel}>places visited</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Nav widgets ---- */}
      <section className={styles.widgets}>
        <div className="container">
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className={styles.sectionTitle}
          >
            Explore
          </motion.h2>

          <div className={styles.widgetGrid}>
            {WIDGETS.map(({ to, label, icon, color }, i) => (
              <motion.div
                key={to}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link to={to} className={styles.widgetLink}>
                  <Card hover className={`${styles.widget} ${styles[`widget-${color}`]}`}>
                    <span className={styles.widgetIcon}>{icon}</span>
                    <span className={styles.widgetLabel}>{label}</span>
                    <span className={styles.widgetArrow}>→</span>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Recent ideas preview ---- */}
      {ideas.length > 0 && (
        <section className={styles.recentSection}>
          <div className="container">
            <div className={styles.sectionRow}>
              <h2 className={styles.sectionTitle}>Latest ideas</h2>
              <Link to="/ideas" className={styles.seeAll}>See all →</Link>
            </div>
            <div className={styles.recentGrid}>
              {ideas.slice(0, 3).map((idea, i) => (
                <motion.div
                  key={idea.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                >
                  <Card hover padding="sm" className={styles.recentCard}>
                    <p className={styles.recentTitle}>{idea.title}</p>
                    {idea.notes && (
                      <p className={styles.recentNotes}>{idea.notes}</p>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- Footer ---- */}
      <footer className={styles.footer}>
        <p>Made with ♡</p>
      </footer>
    </PageTransition>
  );
}
