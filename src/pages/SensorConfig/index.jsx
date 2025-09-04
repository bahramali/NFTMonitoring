import React, { useState } from 'react';
import { useSensorConfig } from '../../context/SensorConfigContext.jsx';

export default function SensorConfigPage() {
    const { configs, error, createConfig, updateConfig, deleteConfig } = useSensorConfig();

    const [form, setForm] = useState({
        sensor_type: '',
        minValue: '',
        maxValue: '',
        description: '',
    });
    const [editing, setEditing] = useState(null); // sensor_type being edited or null
    const [message, setMessage] = useState('');

    // Handle input changes
    const onChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    const resetForm = () => {
        setEditing(null);
        setForm({ sensor_type: '', minValue: '', maxValue: '', description: '' });
    };

    // Validate and submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        const sensorType = form.sensor_type.trim();
        const minNum = Number(form.minValue);
        const maxNum = Number(form.maxValue);
        const description = form.description?.trim() || '';

        // Frontend validation
        if ((!editing && !sensorType) || form.minValue === '' || form.maxValue === '' || !Number.isFinite(minNum) || !Number.isFinite(maxNum)) {
            setMessage('Invalid config');
            return; // important: stop here
        }

        const payload = { minValue: minNum, maxValue: maxNum, description };

        try {
            if (editing) {
                await updateConfig(editing, payload);
            } else {
                await createConfig(sensorType, payload);
            }
            setMessage('Saved');
            resetForm();
        } catch (err) {
            setMessage(err.message || 'Failed to save');
        }
    };

    const startEdit = (sensorType) => {
        const cfg = configs[sensorType] || {};
        setEditing(sensorType);
        setForm({
            sensor_type: sensorType,
            minValue: cfg.minValue ?? '',
            maxValue: cfg.maxValue ?? '',
            description: cfg.description ?? '',
        });
    };

    const handleDelete = async (sensorType) => {
        setMessage('');
        try {
            await deleteConfig(sensorType);
            setMessage('Deleted');
            if (editing === sensorType) resetForm();
        } catch (err) {
            setMessage(err.message || 'Failed to delete');
        }
    };

    return (
        <div style={{ padding: 16 }}>
            <h1>Sensor Config</h1>

            {error && <div role="alert">{error}</div>}
            {message && <div role="status">{message}</div>}

            <form onSubmit={handleSubmit}>
                <div>
                    <label>
                        Sensor Type:
                        <input
                            name="sensor_type"
                            value={form.sensor_type}
                            onChange={onChange}
                            disabled={Boolean(editing)}
                        />
                    </label>
                </div>

                <div>
                    <label>
                        Min:
                        <input
                            name="minValue"
                            type="number"
                            value={form.minValue}
                            onChange={onChange}
                        />
                    </label>
                </div>

                <div>
                    <label>
                        Max:
                        <input
                            name="maxValue"
                            type="number"
                            value={form.maxValue}
                            onChange={onChange}
                        />
                    </label>
                </div>

                <div>
                    <label>
                        Description:
                        <input
                            name="description"
                            value={form.description}
                            onChange={onChange}
                        />
                    </label>
                </div>

                <button type="submit">{editing ? 'Update' : 'Create'}</button>
                {editing && (
                    <button type="button" onClick={resetForm} style={{ marginLeft: 8 }}>
                        Cancel
                    </button>
                )}
            </form>

            <table style={{ marginTop: 16, borderCollapse: 'collapse' }}>
                <thead>
                <tr>
                    <th style={{ textAlign: 'left', paddingRight: 8 }}>Sensor Type</th>
                    <th style={{ textAlign: 'left', paddingRight: 8 }}>Min</th>
                    <th style={{ textAlign: 'left', paddingRight: 8 }}>Max</th>
                    <th style={{ textAlign: 'left', paddingRight: 8 }}>Description</th>
                    <th />
                </tr>
                </thead>
                <tbody>
                {Object.entries(configs).map(([sensorType, cfg]) => (
                    <tr key={sensorType}>
                        <td>{sensorType}</td>
                        <td>{cfg?.minValue}</td>
                        <td>{cfg?.maxValue}</td>
                        <td>{cfg?.description}</td>
                        <td>
                            <button type="button" onClick={() => startEdit(sensorType)}>Edit</button>
                            <button type="button" onClick={() => handleDelete(sensorType)} style={{ marginLeft: 8 }}>
                                Delete
                            </button>
                        </td>
                    </tr>
                ))}
                {Object.keys(configs).length === 0 && (
                    <tr>
                        <td colSpan={5} style={{ opacity: 0.7 }}>No configs</td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    );
}
