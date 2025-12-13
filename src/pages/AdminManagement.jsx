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

const PERMISSION_LABELS = AVAILABLE_PERMISSIONS.reduce((map, permission) => {
    map[permission.id] = permission.label;
    return map;
}, {});

const INVITE_EXPIRY_OPTIONS = [
    { value: '72', label: '72 hours (recommended)' },
    { value: '24', label: '24 hours' },
    { value: '48', label: '48 hours' },
    { value: '168', label: '7 days' },
    { value: '', label: 'No expiry override' },
];

const STATUS_META = {
    INVITED: { icon: '🟡', label: 'Invited', description: 'Email sent, password not set' },
    ACTIVE: { icon: '🟢', label: 'Active', description: 'Login allowed' },
    DISABLED: { icon: '🔴', label: 'Disabled', description: 'Login blocked' },
};

const emptyForm = { email: '', displayName: '', permissions: ['admin-dashboard'], inviteExpiryHours: '72' };

export default function AdminManagement() {
    const { token } = useAuth();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(false);
    const [formState, setFormState] = useState(emptyForm);
    const [toast, setToast] = useState(null);
    const [inviteFeedback, setInviteFeedback] = useState(null);
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

    const formatLastLogin = (value) => {
        if (!value) return 'Never';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return 'Unknown';
        return parsed.toLocaleString();
    };

    const renderStatusBadge = (status) => {
        const meta = STATUS_META[status] || { icon: '⚪', label: status || 'Unknown' };
        return (
            <span className={`${styles.statusBadge} ${styles[`status${status}`] || ''}`}>
                <span aria-hidden className={styles.statusIcon}>
                    {meta.icon}
                </span>
                <span className={styles.statusText}>{meta.label.toUpperCase()}</span>
            </span>
        );
    };

    const togglePermission = (permission) => {
        setInviteFeedback(null);
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
            setInviteFeedback({ type: 'error', message: 'Email is required.' });
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
            setInviteFeedback({ type: 'success', message: 'Invite sent successfully. Email sent to admin.' });
            setFormState(emptyForm);
            loadAdmins();
        } catch (error) {
            console.error('Failed to invite admin', error);
            const message = error?.message || 'Failed to send invite';
            setInviteFeedback({ type: 'error', message });
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

    const updateStatus = async (admin, nextStatus) => {
        try {
            await updateAdminStatus(admin.id, nextStatus, token);
            const action = nextStatus === 'ACTIVE' ? 'enabled' : nextStatus === 'DISABLED' ? 'disabled' : 'updated';
            showToast('success', `Admin ${action}`);
            loadAdmins();
        } catch (error) {
            console.error('Failed to update admin status', error);
            showToast('error', error?.message || 'Failed to update status');
        }
    };

    const confirmRemoval = async () => {
        if (!confirmAdmin) return;
        try {
            await deleteAdmin(confirmAdmin.admin.id, token);
            const successMessage = confirmAdmin.intent === 'revoke' ? 'Invite revoked' : 'Admin removed';
            showToast('success', successMessage);
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
                    <p className={styles.helper}>Lifecycle: Invite → Active → Disabled. No passwords are collected here.</p>
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

                    {inviteFeedback && (
                        <div
                            className={`${styles.banner} ${inviteFeedback.type === 'error' ? styles.bannerError : styles.bannerSuccess}`}
                        >
                            {inviteFeedback.message}
                        </div>
                    )}

                    <label className={styles.label} htmlFor="email">Admin email (required)</label>
                    <input
                        id="email"
                        type="email"
                        className={styles.input}
                        value={formState.email}
                        onChange={(event) => {
                            setInviteFeedback(null);
                            setFormState((previous) => ({ ...previous, email: event.target.value }));
                        }}
                        required
                    />

                    <label className={styles.label} htmlFor="displayName">Display name (optional)</label>
                    <input
                        id="displayName"
                        type="text"
                        className={styles.input}
                        value={formState.displayName}
                        onChange={(event) => {
                            setInviteFeedback(null);
                            setFormState((previous) => ({ ...previous, displayName: event.target.value }));
                        }}
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
                        onChange={(event) => {
                            setInviteFeedback(null);
                            setFormState((previous) => ({ ...previous, inviteExpiryHours: event.target.value }));
                        }}
                    >
                        {INVITE_EXPIRY_OPTIONS.map((option) => (
                            <option key={option.value || 'none'} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    <button className={styles.button} type="submit">Send invite</button>

                    <div className={styles.notice} role="status">
                        Admin will receive an email to set their password securely after accepting the invite.
                    </div>
                </form>

                <div className={`${styles.card} ${styles.tableCard}`}>
                    <div className={styles.cardHeader}>
                        <div>
                            <p className={styles.kicker}>Admin roster</p>
                            <h2>Lifecycle &amp; access</h2>
                            <div className={styles.statusLegend}>
                                {Object.entries(STATUS_META).map(([key, meta]) => (
                                    <div key={key} className={styles.legendItem}>
                                        <span className={styles.legendIcon} aria-hidden>{meta.icon}</span>
                                        <div>
                                            <div className={styles.legendLabel}>{meta.label.toUpperCase()}</div>
                                            <div className={styles.meta}>{meta.description}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
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
                                        <th>Last login</th>
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
                                                {renderStatusBadge(admin.status)}
                                            </td>
                                            <td>
                                                <div className={styles.chips}>
                                                    {(admin.permissions || []).length === 0 && <span className={styles.chip}>None</span>}
                                                    {(admin.permissions || []).map((permission) => (
                                                        <span key={permission} className={styles.chip}>
                                                            {PERMISSION_LABELS[permission] || permission}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.primaryText}>
                                                    {formatLastLogin(
                                                        admin.lastLoginAt || admin.lastLogin || admin.lastActiveAt || admin.lastSeenAt,
                                                    )}
                                                </div>
                                                {admin.lastIp && <div className={styles.meta}>From {admin.lastIp}</div>}
                                            </td>
                                            <td>
                                                <div className={styles.rowActions}>
                                                    {admin.status === 'INVITED' && (
                                                        <>
                                                            <button type="button" onClick={() => resendInviteAction(admin)}>
                                                                Resend invite
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={styles.danger}
                                                                onClick={() => setConfirmAdmin({ admin, intent: 'revoke' })}
                                                            >
                                                                Revoke
                                                            </button>
                                                        </>
                                                    )}
                                                    {admin.status === 'ACTIVE' && (
                                                        <>
                                                            <button type="button" onClick={() => openEdit(admin)}>
                                                                Edit permissions
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateStatus(admin, 'DISABLED')}
                                                                className={styles.softDanger}
                                                            >
                                                                Disable
                                                            </button>
                                                        </>
                                                    )}
                                                    {admin.status === 'DISABLED' && (
                                                        <>
                                                            <button type="button" onClick={() => updateStatus(admin, 'ACTIVE')}>
                                                                Enable
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={styles.danger}
                                                                onClick={() => setConfirmAdmin({ admin, intent: 'delete' })}
                                                            >
                                                                Delete
                                                            </button>
                                                        </>
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
                                <p className={styles.kicker}>
                                    {confirmAdmin.intent === 'revoke' ? 'Revoke invite' : 'Delete admin'}
                                </p>
                                <h3>{confirmAdmin.admin.email}</h3>
                            </div>
                            <button type="button" className={styles.closeButton} onClick={() => setConfirmAdmin(null)}>
                                ✕
                            </button>
                        </div>
                        <p className={styles.helper}>
                            {confirmAdmin.intent === 'revoke'
                                ? 'This cancels the invitation. The admin will need a new invite to join later.'
                                : 'This removes the admin and revokes all access. Are you sure?'}
                        </p>
                        <div className={styles.modalActions}>
                            <button type="button" onClick={() => setConfirmAdmin(null)} className={styles.subtleButton}>
                                Cancel
                            </button>
                            <button type="button" className={styles.danger} onClick={confirmRemoval}>
                                {confirmAdmin.intent === 'revoke' ? 'Revoke invite' : 'Delete admin'}
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
