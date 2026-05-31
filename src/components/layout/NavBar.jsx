import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import styles from './NavBar.module.css';

const NAV_ITEMS = [
  { to: '/',       label: 'Home',   icon: '♡' },
  { to: '/dates',  label: 'Dates',  icon: '📅' },
  { to: '/photos', label: 'Photos', icon: '✦' },
  { to: '/ideas',  label: 'Ideas',  icon: '✧' },
  { to: '/places', label: 'Places', icon: '◎' },
];

export default function NavBar() {
  return (
    <motion.nav
      className={styles.nav}
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.inner}>
        {/* Wordmark */}
        <NavLink to="/" className={styles.wordmark}>
          Us
        </NavLink>

        {/* Links */}
        <ul className={styles.links}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `${styles.link} ${isActive ? styles.active : ''}`
                }
              >
                <span className={styles.icon}>{icon}</span>
                <span className={styles.label}>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </motion.nav>
  );
}
