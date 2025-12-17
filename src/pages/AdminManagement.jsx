import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    deleteAdmin,
    fetchAdmins,
    fetchAdminPermissions,
    inviteAdmin,
    resendAdminInvite,
    updateAdminPermissions,
    updateAdminStatus,
} from '../api/admins.js';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './AdminManagement.module.css';

const buildEmptyForm = (defaultPermissions = []) => ({
    email: '',
    displayName: '',
    permissions: defaultPermissions,
    expiresInHours: '',
});

const normalizePermissionDefinitions = (payload) => {
    const rawPermissions = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.permissions)
            ? payload.permissions
            : [];

    return rawPermissions
        .map((permission) => {
            if (typeof permission === 'string') {
                return {
                    key: permission,
                    label: permission,
                    description: '',
                    defaultSelected: false,
                };
            }

            const key = permission?.key || permission?.value;
            if (!key) return null;

            return {
                key,
                label: permission?.label || permission?.name || key,
                description: permission?.description || '',
                defaultSelected: Boolean(permission?.defaultSelected),
            };
        })
        .filter(Boolean);
};

const buildPermissionLabels = (permissions = []) => permissions.reduce((map, permission) => {
    map[permission.key] = permission.label;
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

export default function AdminManagement() {
    const { token } = useAuth();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(false);
    const [availablePermissions, setAvailablePermissions] = useState([]);
    const [permissionLabels, setPermissionLabels] = useState({});
    const [defaultPermissionSelection, setDefaultPermissionSelection] = useState([]);
    const [permissionsLoading, setPermissionsLoading] = useState(false);
    const [permissionsError, setPermissionsError] = useState('');
    const [formState, setFormState] = useState(() => buildEmptyForm([]));
    const [hasUserModifiedPermissions, setHasUserModifiedPermissions] = useState(false);
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

    const loadPermissions = useCallback(async () => {
        if (!token) return;
        setPermissionsLoading(true);
        setPermissionsError('');
        try {
            const payload = await fetchAdminPermissions(token);
            const normalized = normalizePermissionDefinitions(payload);
            setAvailablePermissions(normalized);
            setPermissionLabels(buildPermissionLabels(normalized));
            setDefaultPermissionSelection(
                normalized.filter((permission) => permission.defaultSelected).map((permission) => permission.key),
            );
            setEditPermissions((previous) => previous.filter((permission) => normalized.some((item) => item.key === permission)));
            setFormState((previous) => ({
                ...previous,
                permissions: previous.permissions.filter((permission) => normalized.some((item) => item.key === permission)),
            }));
            setHasUserModifiedPermissions(false);
        } catch (error) {
            console.error('Failed to load permissions', error);
            setAvailablePermissions([]);
            setPermissionLabels({});
            setDefaultPermissionSelection([]);
            setPermissionsError(error?.message || 'Failed to load permissions');
        } finally {
            setPermissionsLoading(false);
        }
    }, [token]);

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
        loadPermissions();
    }, [loadPermissions]);

    useEffect(() => {
        loadAdmins();
    }, [loadAdmins]);

    useEffect(() => {
        if (hasUserModifiedPermissions) return;
        setFormState((previous) => ({ ...previous, permissions: defaultPermissionSelection }));
    }, [defaultPermissionSelection, hasUserModifiedPermissions]);

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
        setHasUserModifiedPermissions(true);
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

        if (permissionsLoading) {
            const message = 'Permissions are still loading. Please wait a moment.';
            setInviteFeedback({ type: 'error', message });
            showToast('error', message);
            return;
        }

        if (availablePermissions.length === 0) {
            const message = permissionsError || 'No permissions available. Please refresh permissions and try again.';
            setInviteFeedback({ type: 'error', message });
            showToast('error', message);
            return;
        }

        if (formState.permissions.length === 0) {
            const message = 'Select at least one permission before sending the invite.';
            setInviteFeedback({ type: 'error', message });
            showToast('error', message);
            return;
        }

        const unknownSelection = formState.permissions.filter((permission) => !permissionLabels[permission]);
        if (unknownSelection.length > 0) {
            const message = 'One or more selected permissions are no longer valid. Refreshing the list.';
            setInviteFeedback({ type: 'error', message });
            showToast('error', message);
            loadPermissions();
            return;
        }

        const payload = {
            email: formState.email.trim(),
            displayName: formState.displayName?.trim() || undefined,
            permissions: formState.permissions.map((permission) => permission),
        };

        if (formState.expiresInHours) {
            payload.expiresInHours = Number(formState.expiresInHours);
        }

        try {
            await inviteAdmin(payload, token);
            setInviteFeedback({ type: 'success', message: 'Invite sent successfully. Email sent to admin.' });
            setHasUserModifiedPermissions(false);
            setFormState(buildEmptyForm(defaultPermissionSelection));
            loadAdmins();
        } catch (error) {
            console.error('Failed to invite admin', error);
            const message = error?.payload?.message || error?.message || 'Failed to send invite';
            setInviteFeedback({ type: 'error', message });
            if (error?.payload?.invalidPermissions || `${error?.message}`.toLowerCase().includes('permission')) {
                loadPermissions();
            }
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
        if (editPermissions.length === 0) {
            showToast('error', 'Select at least one permission.');
            return;
        }

        const unknownSelection = editPermissions.filter((permission) => !permissionLabels[permission]);
        if (unknownSelection.length > 0) {
            const message = 'Selected permissions are no longer valid. Refreshing permissions.';
            showToast('error', message);
            loadPermissions();
            return;
        }

        try {
            await updateAdminPermissions(editModalAdmin.id, editPermissions, token);
            showToast('success', 'Permissions updated');
            setEditModalAdmin(null);
            setEditPermissions([]);
            loadAdmins();
        } catch (error) {
            console.error('Failed to update permissions', error);
            showToast('error', error?.message || 'Failed to update permissions');
            if (error?.payload?.invalidPermissions || `${error?.message}`.toLowerCase().includes('permission')) {
                loadPermissions();
            }
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
                    {permissionsError && (
                        <div className={`${styles.banner} ${styles.bannerError}`}>
                            {permissionsError}
                        </div>
                    )}
                    {permissionsLoading ? (
                        <p className={styles.helper}>Loading permissions…</p>
                    ) : (
                        <div className={styles.permissions}>
                            {availablePermissions.length === 0 ? (
                                <p className={styles.helper}>No permissions available. Refresh to try again.</p>
                            ) : (
                                availablePermissions.map((permission) => (
                                    <label key={permission.key} className={styles.checkboxRow}>
                                        <input
                                            type="checkbox"
                                            checked={formState.permissions.includes(permission.key)}
                                            onChange={() => togglePermission(permission.key)}
                                        />
                                        <div className={styles.permissionContent}>
                                            <span className={styles.permissionLabel}>{permission.label}</span>
                                            {permission.description && (
                                                <span className={styles.permissionDescription}>
                                                    {permission.description}
                                                </span>
                                            )}
                                            <span className={styles.permissionKey}>{permission.key}</span>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                    )}

                    <label className={styles.label} htmlFor="inviteExpiry">Invite expiry</label>
                    <select
                        id="inviteExpiry"
                        className={styles.input}
                        value={formState.expiresInHours}
                        onChange={(event) => {
                            setInviteFeedback(null);
                            setFormState((previous) => ({ ...previous, expiresInHours: event.target.value }));
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
                                                            {permissionLabels[permission] || permission}
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
                            {permissionsLoading ? (
                                <p className={styles.helper}>Loading permissions…</p>
                            ) : availablePermissions.length === 0 ? (
                                <p className={styles.helper}>No permissions available.</p>
                            ) : (
                                availablePermissions.map((permission) => (
                                    <label key={permission.key} className={styles.checkboxRow}>
                                        <input
                                            type="checkbox"
                                            checked={editPermissions.includes(permission.key)}
                                            onChange={() => toggleEditPermission(permission.key)}
                                        />
                                        <div className={styles.permissionContent}>
                                            <span className={styles.permissionLabel}>{permission.label}</span>
                                            {permission.description && (
                                                <span className={styles.permissionDescription}>
                                                    {permission.description}
                                                </span>
                                            )}
                                            <span className={styles.permissionKey}>{permission.key}</span>
                                        </div>
                                    </label>
                                ))
                            )}
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
