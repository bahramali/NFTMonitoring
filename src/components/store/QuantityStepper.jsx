import React from 'react';
import styles from './QuantityStepper.module.css';

export default function QuantityStepper({
    value = 1,
    min = 1,
    max,
    onChange,
    compact = false,
    disabled = false,
}) {
    const handleChange = (next) => {
        if (Number.isNaN(next)) return;
        if (min !== undefined && next < min) return;
        if (max !== undefined && next > max) return;
        onChange?.(next);
    };

    return (
        <div className={`${styles.stepper} ${compact ? styles.compact : ''}`}>
            <button
                type="button"
                className={styles.button}
                onClick={() => handleChange(value - 1)}
                disabled={disabled || value <= min}
            >
                −
            </button>
            <div className={styles.value} aria-live="polite">
                {value}
            </div>
            <button
                type="button"
                className={styles.button}
                onClick={() => handleChange(value + 1)}
                disabled={disabled || (max !== undefined && value >= max)}
            >
                +
            </button>
        </div>
    );
}
