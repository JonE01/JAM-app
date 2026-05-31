import styles from './Input.module.css';

export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className={`${styles.group} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      <input className={`${styles.input} ${error ? styles.error : ''}`} {...props} />
      {error && <p className={styles.errorMsg}>{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className={`${styles.group} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      <textarea className={`${styles.input} ${styles.textarea} ${error ? styles.error : ''}`} {...props} />
      {error && <p className={styles.errorMsg}>{error}</p>}
    </div>
  );
}
