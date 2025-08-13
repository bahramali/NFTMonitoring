import React from 'react';
import styles from './SystemSelect.module.css';

export default function SystemSelect({ systems = [], value, onChange }) {
    return (
        <select
            className={styles.select}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
        >
            {systems.map((sys) => (
                <option key={sys.id} value={sys.id}>
                    {sys.name}
                </option>
            ))}
        </select>
    );
}
