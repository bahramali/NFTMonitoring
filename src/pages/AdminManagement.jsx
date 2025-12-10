import React, { useMemo, useState } from 'react';
import { sendAdminInvite, getInviteSenderEmail } from '../api/admins.js';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './AdminManagement.module.css';

const AVAILABLE_PERMISSIONS = [
    { id: 'admin-dashboard', label: 'Admin Dashboard' },
    { id: 'admin-reports', label: 'Reports' },
    { id: 'admin-team', label: 'Team' },
];

const emptyForm = { id: '', username: '', email: '', permissions: ['admin-dashboard'] };

export default function AdminManagement() {
    const { adminAssignments, upsertAdmin, removeAdmin } = useAuth();
    const [formState, setFormState] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [inviteNotice, setInviteNotice] = useState('');
    const inviteSenderEmail = getInviteSenderEmail();

    const sortedAdmins = useMemo(
        () => [...(adminAssignments || [])].sort((a, b) => a.username.localeCompare(b.username)),
        [adminAssignments],
    );

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!formState.id || !formState.username || !formState.email) {
            return;
        }

        const normalizedAdmin = {
            ...formState,
            id: formState.id.trim(),
            username: formState.username.trim(),
            email: formState.email.trim(),
        };

        upsertAdmin(normalizedAdmin);

        try {
            const inviteResult = await sendAdminInvite(normalizedAdmin);
            if (inviteResult?.queued) {
                const senderEmail = inviteResult?.senderEmail || inviteSenderEmail;
                setInviteNotice(
                    `Invitation email queued for ${normalizedAdmin.email} from ${senderEmail} so they can set and confirm their password.`,
                );
            } else {
                const failureReason = inviteResult?.errorMessage ? ` (${inviteResult.errorMessage})` : '';
                setInviteNotice(
                    `Admin saved, but email delivery is unavailable${failureReason}. Please notify ${normalizedAdmin.email} manually.`,
                );
            }
        } catch (error) {
            console.error('Failed to handle admin invite flow', error);
            setInviteNotice('Admin saved, but email delivery is unavailable. Please notify them manually.');
        }

        setFormState(emptyForm);
        setEditingId(null);
    };

    const startEdit = (admin) => {
        setFormState({ ...admin, email: admin.email || '' });
        setEditingId(admin.id);
        setInviteNotice('');
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
                    <label className={styles.label} htmlFor="email">Admin email</label>
                    <input
                        id="email"
                        type="email"
                        className={styles.input}
                        value={formState.email}
                        onChange={(event) => setFormState((previous) => ({ ...previous, email: event.target.value }))}
                        required
                    />
                    <p className={styles.helper}>
                        We’ll email the admin so they can set and confirm their own password. Emails are sent from
                        {' '}
                        {inviteSenderEmail}
                        .
                    </p>
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
                    {inviteNotice && <p className={styles.notice}>{inviteNotice}</p>}
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
                                        <p className={styles.meta}>Email: {admin.email || 'Not provided'}</p>
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
