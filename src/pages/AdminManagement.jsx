import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    deleteAdmin,
    fetchAdmins,
    inviteAdmin,
    resendAdminInvite,
    updateAdminPermissions,
    updateAdminStatus,
} from '../api/admins.js';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './AdminManagement.module.css';

const AVAILABLE_PERMISSIONS = [
    { id: 'admin-dashboard', label: 'Admin Dashboard' },
    { id: 'admin-reports', label: 'Reports' },
    { id: 'admin-team', label: 'Team' },
];

const INVITE_EXPIRY_OPTIONS = [
    { value: '', label: 'No expiry override' },
    { value: '24', label: '24h' },
    { value: '48', label: '48h' },
    { value: '168', label: '7d' },
];

const emptyForm = { email: '', displayName: '', permissions: ['admin-dashboard'], inviteExpiryHours: '' };

export default function AdminManagement() {
    const { token } = useAuth();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(false);
    const [formState, setFormState] = useState(emptyForm);
    const [toast, setToast] = useState(null);
    const [editModalAdmin, setEditModalAdmin] = useState(null);
    const [editPermissions, setEditPermissions] = useState([]);
    const [confirmAdmin, setConfirmAdmin] = useState(null);

    const showToast = useCallback((type, message) => {
        setToast({ type, message });
        window.setTimeout(() => setToast(null), 4000);
    }, []);

    const normalizeAdmins = useCallback((payload) => {
        if (!payload) return [];
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload.admins)) return payload.admins;
        return [];
    }, []);

    const loadAdmins = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const payload = await fetchAdmins(token);
            setAdmins(normalizeAdmins(payload));
        } catch (error) {
            console.error('Failed to load admins', error);
            showToast('error', error?.message || 'Failed to load admins');
        } finally {
            setLoading(false);
        }
    }, [normalizeAdmins, showToast, token]);

    useEffect(() => {
        loadAdmins();
    }, [loadAdmins]);

    const sortedAdmins = useMemo(
        () => [...admins].sort((a, b) => (a.email || '').localeCompare(b.email || '')),
        [admins],
    );

    const togglePermission = (permission) => {
        setFormState((previous) => {
            const hasPermission = previous.permissions.includes(permission);
            const permissions = hasPermission
                ? previous.permissions.filter((item) => item !== permission)
                : [...previous.permissions, permission];
            return { ...previous, permissions };
        });
    };

    const handleInvite = async (event) => {
        event.preventDefault();
        if (!formState.email) {
            showToast('error', 'Email is required.');
            return;
        }

        const payload = {
            email: formState.email.trim(),
            displayName: formState.displayName?.trim() || undefined,
            permissions: formState.permissions,
            inviteExpiryHours: formState.inviteExpiryHours || undefined,
        };

        try {
            await inviteAdmin(payload, token);
            showToast('success', 'Invite sent successfully.');
            setFormState(emptyForm);
            loadAdmins();
        } catch (error) {
            console.error('Failed to invite admin', error);
            showToast('error', error?.message || 'Failed to send invite');
        }
    };

    const openEdit = (admin) => {
        setEditModalAdmin(admin);
        setEditPermissions(admin.permissions || []);
    };

    const toggleEditPermission = (permission) => {
        setEditPermissions((previous) => {
            const hasPermission = previous.includes(permission);
            return hasPermission ? previous.filter((item) => item !== permission) : [...previous, permission];
        });
    };

    const savePermissions = async () => {
        if (!editModalAdmin) return;
        try {
            await updateAdminPermissions(editModalAdmin.id, editPermissions, token);
            showToast('success', 'Permissions updated');
            setEditModalAdmin(null);
            setEditPermissions([]);
            loadAdmins();
        } catch (error) {
            console.error('Failed to update permissions', error);
            showToast('error', error?.message || 'Failed to update permissions');
        }
    };

    const toggleStatus = async (admin) => {
        const nextStatus = admin.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
        try {
            await updateAdminStatus(admin.id, nextStatus, token);
            showToast('success', `Admin ${nextStatus === 'ACTIVE' ? 'enabled' : 'disabled'}`);
            loadAdmins();
        } catch (error) {
            console.error('Failed to toggle admin status', error);
            showToast('error', error?.message || 'Failed to update status');
        }
    };

    const confirmRemoval = async () => {
        if (!confirmAdmin) return;
        try {
            await deleteAdmin(confirmAdmin.id, token);
            showToast('success', 'Admin removed');
            setConfirmAdmin(null);
            loadAdmins();
        } catch (error) {
            console.error('Failed to remove admin', error);
            showToast('error', error?.message || 'Failed to remove admin');
        }
    };

    const resendInviteAction = async (admin) => {
        try {
            await resendAdminInvite(admin.id, token);
            showToast('success', 'Invite resent');
        } catch (error) {
            console.error('Failed to resend invite', error);
            showToast('error', error?.message || 'Failed to resend invite');
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Super admin only</p>
                    <h1>Super Admin Console</h1>
                    <p className={styles.subtitle}>Invite admins, manage permissions, and control access.</p>
                </div>
                <div className={styles.badge}>SUPER_ADMIN</div>
            </header>

            <section className={styles.grid}>
                <form className={styles.card} onSubmit={handleInvite}>
                    <div className={styles.cardHeader}>
                        <div>
                            <p className={styles.kicker}>Onboard admins</p>
                            <h2>Invite admin</h2>
                        </div>
                    </div>

                    <label className={styles.label} htmlFor="email">Admin email (required)</label>
                    <input
                        id="email"
                        type="email"
                        className={styles.input}
                        value={formState.email}
                        onChange={(event) => setFormState((previous) => ({ ...previous, email: event.target.value }))}
                        required
                    />

                    <label className={styles.label} htmlFor="displayName">Display name (optional)</label>
                    <input
                        id="displayName"
                        type="text"
                        className={styles.input}
                        value={formState.displayName}
                        onChange={(event) => setFormState((previous) => ({ ...previous, displayName: event.target.value }))}
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

                    <label className={styles.label} htmlFor="inviteExpiry">Invite expiry</label>
                    <select
                        id="inviteExpiry"
                        className={styles.input}
                        value={formState.inviteExpiryHours}
                        onChange={(event) =>
                            setFormState((previous) => ({ ...previous, inviteExpiryHours: event.target.value }))
                        }
                    >
                        {INVITE_EXPIRY_OPTIONS.map((option) => (
                            <option key={option.value || 'none'} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    <button className={styles.button} type="submit">Send invite</button>
                </form>

                <div className={`${styles.card} ${styles.tableCard}`}>
                    <div className={styles.cardHeader}>
                        <div>
                            <p className={styles.kicker}>Current admins</p>
                            <h2>Admin roster</h2>
                        </div>
                        <button className={styles.refreshButton} type="button" onClick={loadAdmins} disabled={loading}>
                            Refresh
                        </button>
                    </div>

                    {loading ? (
                        <p className={styles.helper}>Loading admins…</p>
                    ) : sortedAdmins.length === 0 ? (
                        <p className={styles.empty}>No admins configured yet.</p>
                    ) : (
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Email</th>
                                        <th>Display name</th>
                                        <th>Status</th>
                                        <th>Permissions</th>
                                        <th className={styles.actionsColumn}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedAdmins.map((admin) => (
                                        <tr key={admin.id}>
                                            <td>
                                                <div className={styles.primaryText}>{admin.email}</div>
                                                <div className={styles.meta}>ID: {admin.id}</div>
                                            </td>
                                            <td>{admin.displayName || '—'}</td>
                                            <td>
                                                <span className={`${styles.statusBadge} ${styles[`status${admin.status}`] || ''}`}>
                                                    {admin.status || 'UNKNOWN'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className={styles.chips}>
                                                    {(admin.permissions || []).length === 0 && <span className={styles.chip}>None</span>}
                                                    {(admin.permissions || []).map((permission) => (
                                                        <span key={permission} className={styles.chip}>{permission}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.rowActions}>
                                                    <button type="button" onClick={() => openEdit(admin)}>
                                                        Edit permissions
                                                    </button>
                                                    <button type="button" onClick={() => toggleStatus(admin)}>
                                                        {admin.status === 'DISABLED' ? 'Enable' : 'Disable'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.danger}
                                                        onClick={() => setConfirmAdmin(admin)}
                                                    >
                                                        Remove
                                                    </button>
                                                    {admin.status === 'INVITED' && (
                                                        <button type="button" onClick={() => resendInviteAction(admin)}>
                                                            Resend invite
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>

            {editModalAdmin && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <div>
                                <p className={styles.kicker}>Edit permissions</p>
                                <h3>{editModalAdmin.email}</h3>
                            </div>
                            <button type="button" className={styles.closeButton} onClick={() => setEditModalAdmin(null)}>
                                ✕
                            </button>
                        </div>
                        <div className={styles.permissions}>
                            {AVAILABLE_PERMISSIONS.map((permission) => (
                                <label key={permission.id} className={styles.checkboxRow}>
                                    <input
                                        type="checkbox"
                                        checked={editPermissions.includes(permission.id)}
                                        onChange={() => toggleEditPermission(permission.id)}
                                    />
                                    {permission.label}
                                </label>
                            ))}
                        </div>
                        <div className={styles.modalActions}>
                            <button type="button" onClick={() => setEditModalAdmin(null)} className={styles.subtleButton}>
                                Cancel
                            </button>
                            <button type="button" className={styles.button} onClick={savePermissions}>
                                Save permissions
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmAdmin && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <div>
                                <p className={styles.kicker}>Confirm removal</p>
                                <h3>{confirmAdmin.email}</h3>
                            </div>
                            <button type="button" className={styles.closeButton} onClick={() => setConfirmAdmin(null)}>
                                ✕
                            </button>
                        </div>
                        <p className={styles.helper}>
                            This removes the admin and revokes all access. Are you sure?
                        </p>
                        <div className={styles.modalActions}>
                            <button type="button" onClick={() => setConfirmAdmin(null)} className={styles.subtleButton}>
                                Cancel
                            </button>
                            <button type="button" className={styles.danger} onClick={confirmRemoval}>
                                Remove admin
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
}
