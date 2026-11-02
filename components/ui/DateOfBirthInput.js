'use client';

import styles from './DateOfBirthInput.module.css';

export default function DateOfBirthInput({ value, onChange, style, ...props }) {
  return (
    <div className={styles.dateField} style={{ fontSize: style?.fontSize }}>
      <input
        {...props}
        className={styles.dateInput}
        style={{ ...style, minHeight: 44 }}
        type="date"
        aria-label="Date of birth"
        autoComplete="bday"
        required
        value={value}
        data-empty={!value}
        max={new Date().toISOString().slice(0, 10)}
        onChange={event => onChange(event.target.value)}
      />
      {!value && <span className={styles.datePlaceholder} aria-hidden="true">Date of birth</span>}
    </div>
  );
}
