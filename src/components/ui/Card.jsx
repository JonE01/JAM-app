import { motion } from 'framer-motion';
import styles from './Card.module.css';

export default function Card({
  children,
  className = '',
  hover = true,
  padding = 'md',
  ...props
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={hover ? { y: -3, boxShadow: 'var(--shadow-lg)' } : {}}
      className={`${styles.card} ${styles[`pad-${padding}`]} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
