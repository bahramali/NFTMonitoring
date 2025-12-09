import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './AdminManagement.module.css';

const AVAILABLE_PERMISSIONS = [
    { id: 'admin-dashboard', label: 'Admin Dashboard' },
    { id: 'admin-reports', label: 'Reports' },
    { id: 'admin-team', label: 'Team' },
];

const emptyForm = { id: '', username: '', permissions: ['admin-dashboard'] };

export default function AdminManagement() {
    const { adminAssignments, upsertAdmin, removeAdmin } = useAuth();
    const [formState, setFormState] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);

    const sortedAdmins = useMemo(
        () => [...(adminAssignments || [])].sort((a, b) => a.username.localeCompare(b.username)),
        [adminAssignments],
    );

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!formState.id || !formState.username) {
            return;
        }

        upsertAdmin(formState);
        setFormState(emptyForm);
        setEditingId(null);
    };

    const startEdit = (admin) => {
        setFormState(admin);
        setEditingId(admin.id);
    };

    const togglePermission = (permission) => {
        setFormState((previous) => {
            const hasPermission = previous.permissions.includes(permission);
            const permissions = hasPermission
                ? previous.permissions.filter((item) => item !== permission)
                : [...previous.permissions, permission];
            return { ...previous, permissions };
        });
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Super admin only</p>
                    <h1>Admin management</h1>
                    <p className={styles.subtitle}>Assign which routes an admin can open.</p>
                </div>
            </header>

            <section className={styles.grid}>
                <form className={styles.card} onSubmit={handleSubmit}>
                    <h2>{editingId ? 'Edit admin' : 'Create admin'}</h2>
                    <label className={styles.label} htmlFor="id">Admin ID</label>
                    <input
                        id="id"
                        className={styles.input}
                        value={formState.id}
                        onChange={(event) => setFormState((previous) => ({ ...previous, id: event.target.value }))}
                        required
                    />
                    <label className={styles.label} htmlFor="username">Username (login)</label>
                    <input
                        id="username"
                        className={styles.input}
                        value={formState.username}
                        onChange={(event) => setFormState((previous) => ({ ...previous, username: event.target.value }))}
                        required
                    />
                    <p className={styles.label}>Permissions</p>
                    <div className={styles.permissions}>
                        {AVAILABLE_PERMISSIONS.map((permission) => (
                            <label key={permission.id} className={styles.checkboxRow}>
                                <input
                                    type="checkbox"
                                    checked={formState.permissions.includes(permission.id)}
                                    onChange={() => togglePermission(permission.id)}
                                />
                                {permission.label}
                            </label>
                        ))}
                    </div>
                    <button className={styles.button} type="submit">
                        {editingId ? 'Save changes' : 'Create admin'}
                    </button>
                </form>

                <div className={styles.card}>
                    <h2>Current admins</h2>
                    {sortedAdmins.length === 0 ? (
                        <p className={styles.empty}>No admins configured yet.</p>
                    ) : (
                        <ul className={styles.adminList}>
                            {sortedAdmins.map((admin) => (
                                <li key={admin.id}>
                                    <div>
                                        <strong>{admin.username}</strong>
                                        <p className={styles.meta}>Permissions: {admin.permissions.join(', ') || 'None'}</p>
                                    </div>
                                    <div className={styles.rowActions}>
                                        <button type="button" onClick={() => startEdit(admin)}>Edit</button>
                                        <button type="button" onClick={() => removeAdmin(admin.id)} className={styles.danger}>
                                            Delete
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>
        </div>
    );
}
