import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    deleteAdmin,
    fetchAdmins,
    fetchPermissionDefinitions,
    inviteAdmin,
    resendAdminInvite,
    updateAdminPermissions,
    updateAdminStatus,
} from '../api/admins.js';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './AdminManagement.module.css';

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

const emptyForm = { email: '', displayName: '', expiresInHours: '' };

export default function AdminManagement() {
    const { token } = useAuth();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(false);
    const [permissionDefs, setPermissionDefs] = useState([]);
    const [selectedPermissionKeys, setSelectedPermissionKeys] = useState([]);
    const [hasFetchedPermissions, setHasFetchedPermissions] = useState(false);
    const [hasAppliedDefaultPermissions, setHasAppliedDefaultPermissions] = useState(false);
    const [permissionLoadError, setPermissionLoadError] = useState(null);
    const [loadingPermissions, setLoadingPermissions] = useState(false);
    const [formState, setFormState] = useState(emptyForm);
    const [toast, setToast] = useState(null);
    const [inviteFeedback, setInviteFeedback] = useState(null);
    const [editModalAdmin, setEditModalAdmin] = useState(null);
    const [editPermissions, setEditPermissions] = useState([]);
    const [confirmAdmin, setConfirmAdmin] = useState(null);
    const [confirmPermissions, setConfirmPermissions] = useState(null);

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

    const normalizePermissionDefinitions = useCallback((payload) => {
        if (Array.isArray(payload)) return payload;
        if (payload && Array.isArray(payload.permissions)) return payload.permissions;
        return [];
    }, []);

    const deriveDefaultPermissionKeys = useCallback(
        (definitions) =>
            definitions
                .filter((permission) => permission?.defaultSelected)
                .map((permission) => permission.key)
                .filter(Boolean),
        [],
    );

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

    const loadPermissionDefinitions = useCallback(async () => {
        if (!token) return;
        setLoadingPermissions(true);
        try {
            const payload = await fetchPermissionDefinitions(token);
            const normalized = normalizePermissionDefinitions(payload);
            setPermissionDefs(normalized);
            setHasFetchedPermissions(true);
            setPermissionLoadError(null);
        } catch (error) {
            console.error('Failed to load permissions', error);
            setPermissionLoadError(error?.message || 'Failed to load permissions');
            showToast('error', error?.message || 'Failed to load permissions');
        } finally {
            setLoadingPermissions(false);
        }
    }, [normalizePermissionDefinitions, showToast, token]);

    const loadPermissions = useCallback(() => {
        loadPermissionDefinitions();
    }, [loadPermissionDefinitions]);

    useEffect(() => {
        loadPermissions();
    }, [loadPermissions]);

    useEffect(() => {
        loadAdmins();
    }, [loadAdmins]);

    useEffect(() => {
        setHasFetchedPermissions(false);
        setHasAppliedDefaultPermissions(false);
        setPermissionDefs([]);
        setSelectedPermissionKeys([]);
    }, [token]);

    useEffect(() => {
        if (!hasFetchedPermissions || hasAppliedDefaultPermissions) return;
        setSelectedPermissionKeys(deriveDefaultPermissionKeys(permissionDefs));
        setHasAppliedDefaultPermissions(true);
    }, [deriveDefaultPermissionKeys, hasAppliedDefaultPermissions, hasFetchedPermissions, permissionDefs]);

    useEffect(() => {
        if (!hasFetchedPermissions) return;
        const validKeys = new Set(permissionDefs.map((permission) => permission?.key).filter(Boolean));
        setSelectedPermissionKeys((previous) => previous.filter((key) => validKeys.has(key)));
    }, [permissionDefs, hasFetchedPermissions]);

    const sortedAdmins = useMemo(
        () => [...admins].sort((a, b) => (a.email || '').localeCompare(b.email || '')),
        [admins],
    );

    const permissionLabelMap = useMemo(() => {
        const map = {};
        permissionDefs.forEach((permission) => {
            if (permission?.key) {
                map[permission.key] = permission.label || permission.key;
            }
        });
        return map;
    }, [permissionDefs]);

    const defaultPermissionKeys = useMemo(
        () => deriveDefaultPermissionKeys(permissionDefs),
        [deriveDefaultPermissionKeys, permissionDefs],
    );

    const hasUnknownPermissions = useMemo(
        () =>
            admins.some((admin) => (admin.permissions || []).some((permission) => !permissionLabelMap[permission])),
        [admins, permissionLabelMap],
    );

    const formatLastLogin = (value) => {
        if (!value) return 'Never';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return 'Unknown';
        return parsed.toLocaleString();
    };

    const renderPermissionCheckboxes = (selectedKeys, toggleHandler) => {
        const errorBanner = permissionLoadError ? (
            <div className={`${styles.banner} ${styles.bannerError}`}>{permissionLoadError}</div>
        ) : null;

        if (!permissionDefs.length && loadingPermissions) {
            return (
                <>
                    {errorBanner}
                    <p className={styles.helper}>Loading permissions…</p>
                </>
            );
        }

        if (!permissionDefs.length) {
            return (
                <>
                    {errorBanner}
                    <p className={styles.helper}>No permissions available.</p>
                </>
            );
        }

        return (
            <>
                {errorBanner}
                <div className={styles.permissions}>
                    {permissionDefs.map((permission, index) => (
                        <label
                            key={permission.key || permission.label || `permission-${index}`}
                            className={styles.checkboxRow}
                            title={permission.description || undefined}
                        >
                            <input
                                type="checkbox"
                                checked={selectedKeys.includes(permission.key)}
                                onChange={() => toggleHandler(permission.key)}
                            />
                            <div>
                                <div>{permission.label || permission.key}</div>
                                {permission.description ? (
                                    <div className={styles.permissionDescription}>{permission.description}</div>
                                ) : null}
                            </div>
                        </label>
                    ))}
                </div>
            </>
        );
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
        setSelectedPermissionKeys((previous) => {
            const hasPermission = previous.includes(permission);
            return hasPermission ? previous.filter((item) => item !== permission) : [...previous, permission];
        });
    };

    const handleInvite = async (event) => {
        event.preventDefault();
        if (!formState.email) {
            showToast('error', 'Email is required.');
            setInviteFeedback({ type: 'error', message: 'Email is required.' });
            return;
        }

        if (selectedPermissionKeys.length === 0) {
            const message = 'Select at least one permission';
            showToast('error', message);
            setInviteFeedback({ type: 'error', message });
            return;
        }

        const payload = {
            email: formState.email.trim(),
            displayName: formState.displayName?.trim() || undefined,
            permissions: Array.from(new Set(selectedPermissionKeys)),
        };

        if (formState.expiresInHours) {
            payload.expiresInHours = Number(formState.expiresInHours);
        }

        try {
            await inviteAdmin(payload, token);
            setInviteFeedback({ type: 'success', message: 'Invite sent successfully. Email sent to admin.' });
            setFormState(emptyForm);
            setSelectedPermissionKeys(defaultPermissionKeys);
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

    const savePermissions = async (payload = {}) => {
        const admin = payload.admin || editModalAdmin;
        const permissionsToSave = payload.permissions || editPermissions;
        if (!admin) return;
        if (permissionsToSave.length === 0) {
            showToast('error', 'Select at least one permission.');
            return;
        }

        const permissionLabels = permissionsToSave.reduce((acc, key) => {
            acc[key] = permissionLabelMap[key] || key;
            return acc;
        }, {});

        const unknownSelection = permissionsToSave.filter((permission) => !permissionLabels[permission]);
        if (unknownSelection.length > 0) {
            const message = 'Selected permissions are no longer valid. Refreshing permissions.';
            showToast('error', message);
            loadPermissions();
            return;
        }

        try {
            await updateAdminPermissions(admin.id, permissionsToSave, token);
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

    const confirmAdminAction = async () => {
        if (!confirmAdmin) return;
        try {
            if (confirmAdmin.intent === 'disable') {
                await updateAdminStatus(confirmAdmin.admin.id, 'DISABLED', token);
                showToast('success', 'Admin disabled');
            } else {
                await deleteAdmin(confirmAdmin.admin.id, token);
                const successMessage = confirmAdmin.intent === 'revoke' ? 'Invite revoked' : 'Admin removed';
                showToast('success', successMessage);
            }
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
                    {renderPermissionCheckboxes(selectedPermissionKeys, togglePermission)}

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
                        <div className={styles.headerActions}>
                            <button className={styles.refreshButton} type="button" onClick={loadAdmins} disabled={loading}>
                                Refresh
                            </button>
                            <button
                                className={styles.refreshButton}
                                type="button"
                                onClick={loadPermissionDefinitions}
                                disabled={loadingPermissions}
                            >
                                Refresh permissions
                            </button>
                        </div>
                    </div>

                    {hasUnknownPermissions && (
                        <p className={styles.helper}>
                            Some permissions are unknown. Refresh permissions to update the roster labels.
                        </p>
                    )}

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
                                                            {permissionLabelMap[permission] || `[UNKNOWN: ${permission}]`}
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
                                                                onClick={() => setConfirmAdmin({ admin, intent: 'disable' })}
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
                        {renderPermissionCheckboxes(editPermissions, toggleEditPermission)}
                        <div className={styles.modalActions}>
                            <button type="button" onClick={() => setEditModalAdmin(null)} className={styles.subtleButton}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={styles.button}
                                onClick={() => setConfirmPermissions({ admin: editModalAdmin, permissions: editPermissions })}
                            >
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
                                    {confirmAdmin.intent === 'revoke'
                                        ? 'Revoke invite'
                                        : confirmAdmin.intent === 'disable'
                                            ? 'Disable admin'
                                            : 'Delete admin'}
                                </p>
                                <h3>{confirmAdmin.admin.email}</h3>
                            </div>
                            <button type="button" className={styles.closeButton} onClick={() => setConfirmAdmin(null)}>
                                ✕
                            </button>
                        </div>
                        <div className={styles.dangerZone}>
                            <span className={styles.dangerZoneLabel}>Danger zone</span>
                            <p className={styles.helper}>
                                {confirmAdmin.intent === 'disable'
                                    ? 'Disabling an admin immediately blocks access until they are re-enabled.'
                                    : 'This action affects access and cannot be undone easily.'}
                            </p>
                        </div>
                        <p className={styles.helper}>
                            {confirmAdmin.intent === 'revoke'
                                ? 'This cancels the invitation. The admin will need a new invite to join later.'
                                : confirmAdmin.intent === 'disable'
                                    ? 'You can re-enable the admin later if needed.'
                                    : 'This removes the admin and revokes all access. Are you sure?'}
                        </p>
                        <div className={styles.modalActions}>
                            <button type="button" onClick={() => setConfirmAdmin(null)} className={styles.subtleButton}>
                                Cancel
                            </button>
                            <button type="button" className={styles.danger} onClick={confirmAdminAction}>
                                {confirmAdmin.intent === 'revoke'
                                    ? 'Revoke invite'
                                    : confirmAdmin.intent === 'disable'
                                        ? 'Disable admin'
                                        : 'Delete admin'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmPermissions && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <div>
                                <p className={styles.kicker}>Confirm permissions</p>
                                <h3>{confirmPermissions.admin?.email}</h3>
                            </div>
                            <button type="button" className={styles.closeButton} onClick={() => setConfirmPermissions(null)}>
                                ✕
                            </button>
                        </div>
                        <div className={styles.dangerZone}>
                            <span className={styles.dangerZoneLabel}>Danger zone</span>
                            <p className={styles.helper}>Changing permissions affects access immediately.</p>
                        </div>
                        <div className={styles.modalActions}>
                            <button type="button" onClick={() => setConfirmPermissions(null)} className={styles.subtleButton}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={styles.button}
                                onClick={() => {
                                    savePermissions(confirmPermissions);
                                    setConfirmPermissions(null);
                                }}
                            >
                                Confirm changes
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
