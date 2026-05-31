import styles from './Badge.module.css';

export default function Badge({ children, variant = 'rose', className = '' }) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}
