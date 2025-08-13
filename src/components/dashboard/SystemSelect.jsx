import React from 'react';

export default function SystemSelect({ systems = [], value, onChange }) {
    return (
        <select
            className="border rounded p-2"
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
