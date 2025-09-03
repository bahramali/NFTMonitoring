import React, { useState } from 'react';
import { useSensorConfig } from '../../context/SensorConfigContext.jsx';

function SensorConfig() {
    const { configs, createConfig, updateConfig, deleteConfig, error } = useSensorConfig();
    const [form, setForm] = useState({ key: '', min: '', max: '', description: '' });
    const [editing, setEditing] = useState(null);
    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    const resetForm = () => {
        setForm({ key: '', min: '', max: '', description: '' });
        setEditing(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { key, min, max, description } = form;
        if (!editing && !key) {
            setMessage('Key is required');
            return;
        }
        if (min === '' || max === '') {
            setMessage('Min and max are required');
            return;
        }
        const cfg = {
            idealRange: { min: Number(min), max: Number(max) },
            description,
        };
        try {
            if (editing) {
                await updateConfig(editing, cfg);
            } else {
                await createConfig(key, cfg);
            }
            setMessage('Saved');
            resetForm();
        } catch (err) {
            setMessage(err.message);
        }
    };

    const startEdit = (key) => {
        const cfg = configs[key];
        setForm({
            key,
            min: cfg?.idealRange?.min ?? '',
            max: cfg?.idealRange?.max ?? '',
            description: cfg?.description || '',
        });
        setEditing(key);
    };

    const handleDelete = async (key) => {
        try {
            await deleteConfig(key);
        } catch (err) {
            setMessage(err.message);
        }
    };

    return (
        <div>
            <h1>Sensor Config</h1>
            {error && <div role="alert">{error}</div>}
            {message && <div role="status">{message}</div>}
            <form onSubmit={handleSubmit}>
                {!editing && (
                    <div>
                        <label>
                            Key:
                            <input name="key" value={form.key} onChange={handleChange} />
                        </label>
                    </div>
                )}
                <div>
                    <label>
                        Min:
                        <input name="min" type="number" value={form.min} onChange={handleChange} />
                    </label>
                </div>
                <div>
                    <label>
                        Max:
                        <input name="max" type="number" value={form.max} onChange={handleChange} />
                    </label>
                </div>
                <div>
                    <label>
                        Description:
                        <input name="description" value={form.description} onChange={handleChange} />
                    </label>
                </div>
                <button type="submit">{editing ? 'Update' : 'Create'}</button>
                {editing && <button type="button" onClick={resetForm}>Cancel</button>}
            </form>

            <table>
                <thead>
                    <tr>
                        <th>Key</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Description</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(configs).map(([key, cfg]) => (
                        <tr key={key}>
                            <td>{key}</td>
                            <td>{cfg?.idealRange?.min}</td>
                            <td>{cfg?.idealRange?.max}</td>
                            <td>{cfg?.description}</td>
                            <td>
                                <button type="button" onClick={() => startEdit(key)}>Edit</button>
                                <button type="button" onClick={() => handleDelete(key)}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default SensorConfig;
