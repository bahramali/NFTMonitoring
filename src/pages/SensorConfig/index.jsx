import React, {useState} from 'react';
import {useSensorConfig} from '../../context/SensorConfigContext.jsx';

function SensorConfig() {
    const {configs, createConfig, updateConfig, deleteConfig, error} = useSensorConfig();
    const [form, setForm] = useState({key: '', minValue: '', maxValue: '', description: ''});
    const [editing, setEditing] = useState(null);
    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        const {name, value} = e.target;
        // keep inputs as string; convert on submit
        setForm((f) => ({...f, [name]: value}));
    };

    const resetForm = () => {
        setForm({key: '', minValue: '', maxValue: '', description: ''});
        setEditing(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const {key, minValue, maxValue, description} = form;

        // basic validations (frontend)
        if (!editing && !key) {
            setMessage('Key is required');
            return;
        }
        if (minValue === '' || maxValue === '') {
            setMessage('Min and max are required');
            return;
        }

        // backend expects root-level minValue/maxValue (Double, NotNull)
        const payload = {
            minValue: Number(minValue),
            maxValue: Number(maxValue),
            description,
        };
        try {
            if (editing) {
                await updateConfig(editing, payload); // PUT/PATCH
            } else {
                await createConfig(key, payload);     // POST
            }
            setMessage('Saved');
            resetForm();
        } catch (err) {
            setMessage(err.message || 'Failed to save');
        }
    };

    const startEdit = (key) => {
        const cfg = configs[key] || {};
        setForm({
            key,
            minValue: cfg.minValue ?? '',
            maxValue: cfg.maxValue ?? '',
            description: cfg.description || '',
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
                            <input name="key" value={form.key} onChange={handleChange}/>
                        </label>
                    </div>
                )}
                {editing && (
                    <div>
                        <label>
                            Key:
                            <input name="key" value={form.key} disabled/>
                        </label>
                    </div>
                )}

                <div>
                    <label>
                        Min:
                        <input name="minValue" type="number" value={form.minValue} onChange={handleChange}/>
                    </label>
                </div>
                <div>
                    <label>
                        Max:
                        <input name="maxValue" type="number" value={form.maxValue} onChange={handleChange}/>
                    </label>
                </div>
                <div>
                    <label>
                        Description:
                        <input name="description" value={form.description} onChange={handleChange}/>
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
                        <td>{cfg?.minValue}</td>
                        <td>{cfg?.maxValue}</td>
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
