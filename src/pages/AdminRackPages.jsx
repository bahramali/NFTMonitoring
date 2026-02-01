import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    adminCreateMonitoringPage,
    adminDeleteMonitoringPage,
    adminListMonitoringPages,
    adminUpdateMonitoringPage,
    listTelemetryTargets,
} from '../api/monitoringPages.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSearchParams } from 'react-router-dom';
import styles from './AdminRackPages.module.css';

const emptyForm = {
    title: '',
    rackId: '',
    telemetryRackId: '',
    slug: '',
    enabled: true,
    sortOrder: 0,
};

const normalizeMonitoringPages = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.pages)) return payload.pages;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.pages)) return payload.data.pages;
    return [];
};

const normalizeTelemetryTargets = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.targets)) return payload.targets;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.targets)) return payload.data.targets;
    return [];
};

const resolveRackId = (rack) =>
    rack?.rackId ??
    rack?.rack_id ??
    rack?.rack ??
    rack?.id ??
    rack?.telemetryRackId ??
    rack?.telemetry_rack_id ??
    rack?.telemetryRack ??
    rack?.telemetry_rack ??
    '';

const resolveRackLabel = (rack) => rack?.name || rack?.title || rack?.label || resolveRackId(rack);

const resolveTargetSystem = (target) =>
    target?.system ??
    target?.systemId ??
    target?.system_id ??
    target?.site ??
    target?.siteId ??
    target?.site_id ??
    '';

const resolveTargetTelemetryId = (target) =>
    target?.telemetryRackId ??
    target?.telemetry_rack_id ??
    target?.telemetryRack ??
    target?.telemetry_rack ??
    target?.rackId ??
    target?.rack_id ??
    target?.rack ??
    target?.id ??
    '';

const resolvePageField = (page, candidates, fallback = '') => {
    for (const key of candidates) {
        const value = page?.[key];
        if (value !== undefined && value !== null && `${value}`.trim()) {
            return value;
        }
    }
    return fallback;
};

const resolvePageRackId = (page) => {
    const candidates = [
        page?.rackId,
        page?.rack_id,
        page?.rack,
        page?.rack?.id,
        page?.rack?.rackId,
        page?.rack?.rack_id,
        page?.rack?.rack,
    ];
    for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) continue;
        const value = `${candidate}`.trim();
        if (value) return value;
    }
    return '';
};

const resolvePageTelemetryRackId = (page) => {
    const candidates = [
        page?.telemetryRackId,
        page?.telemetry_rack_id,
        page?.telemetryRack,
        page?.telemetry_rack,
    ];
    for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) continue;
        const value = `${candidate}`.trim();
        if (value) return value;
    }
    return '';
};

const slugify = (value) =>
    `${value || ''}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

const detectFieldErrors = (error) => {
    const errors = {};
    const payload = error?.payload;

    const pushFieldError = (field, message) => {
        if (!field || !message || errors[field]) return;
        errors[field] = message;
    };

    if (Array.isArray(payload?.errors)) {
        payload.errors.forEach((entry) => {
            if (!entry) return;
            const rawField = entry.field || entry.path || entry.key || entry.name;
            const message = entry.message || entry.error || entry.detail;
            const field =
                rawField === 'rack_id' || rawField === 'rack'
                    ? 'rackId'
                    : rawField === 'telemetry_rack_id' || rawField === 'telemetry_rack'
                      ? 'telemetryRackId'
                      : rawField === 'slug'
                        ? 'slug'
                        : rawField;
            pushFieldError(field, message);
        });
    }

    const message = `${payload?.message || error?.message || ''}`.toLowerCase();
    const hasDuplicateHint = message.includes('duplicate') || message.includes('unique') || message.includes('exists');

    if (hasDuplicateHint && message.includes('rack')) {
        pushFieldError('rackId', 'Each rack can only be assigned to one monitoring page.');
    }

    if (hasDuplicateHint && message.includes('slug')) {
        pushFieldError('slug', 'This slug is already in use. Pick a unique slug.');
    }

    return errors;
};

export default function AdminRackPages() {
    const { token } = useAuth();
    const [searchParams] = useSearchParams();
    const [pages, setPages] = useState([]);
    const [telemetryTargets, setTelemetryTargets] = useState([]);
    const [sites, setSites] = useState([]);
    const [selectedSite, setSelectedSite] = useState(() => (
        searchParams.get('system') || searchParams.get('site') || ''
    ));
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [listError, setListError] = useState('');
    const [targetsError, setTargetsError] = useState('');
    const [formError, setFormError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [selectedPage, setSelectedPage] = useState(null);
    const [formState, setFormState] = useState(emptyForm);
    const [slugTouched, setSlugTouched] = useState(false);
    const requestedSite = searchParams.get('system') || searchParams.get('site') || '';

    const isEditing = Boolean(selectedPage);

    const sortedPages = useMemo(
        () =>
            [...pages].sort((a, b) => {
                const orderA = Number(resolvePageField(a, ['sortOrder', 'order'], 0));
                const orderB = Number(resolvePageField(b, ['sortOrder', 'order'], 0));
                if (orderA !== orderB) return orderA - orderB;
                const titleA = `${resolvePageField(a, ['title', 'name'], '')}`.toLowerCase();
                const titleB = `${resolvePageField(b, ['title', 'name'], '')}`.toLowerCase();
                return titleA.localeCompare(titleB);
            }),
        [pages],
    );

    const resetForm = useCallback((page = null) => {
        if (!page) {
            setSelectedPage(null);
            setFormState(emptyForm);
            setSlugTouched(false);
            setFieldErrors({});
            setFormError('');
            return;
        }

        setSelectedPage(page);
        setFormState({
            title: resolvePageField(page, ['title', 'name', 'pageTitle'], ''),
            rackId: resolvePageRackId(page),
            telemetryRackId: resolvePageTelemetryRackId(page),
            slug: resolvePageField(page, ['slug', 'path'], ''),
            enabled: page?.enabled !== false,
            sortOrder: Number(resolvePageField(page, ['sortOrder', 'order'], 0)),
        });
        setSlugTouched(true);
        setFieldErrors({});
        setFormError('');
    }, []);

    const loadPages = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setListError('');
        try {
            const payload = await adminListMonitoringPages();
            setPages(normalizeMonitoringPages(payload));
        } catch (error) {
            console.error('Failed to load monitoring pages', error);
            setListError('Unable to load rack pages right now.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    const loadSites = useCallback(async () => {
        if (!token) return;
        if (requestedSite) {
            setSites([requestedSite]);
            return;
        }
        try {
            const payload = await listTelemetryTargets();
            const targets = normalizeTelemetryTargets(payload);
            const nextSites = Array.from(
                new Set(targets.map((target) => `${resolveTargetSystem(target)}`.trim()).filter(Boolean)),
            ).sort((a, b) => a.localeCompare(b));
            setSites(nextSites);
        } catch (error) {
            console.error('Failed to load telemetry sites', error);
        }
    }, [requestedSite, token]);

    const loadTelemetryTargets = useCallback(async () => {
        if (!token) return;
        if (!selectedSite) {
            setTelemetryTargets([]);
            setTargetsError('Select a site to load telemetry targets.');
            return;
        }
        setTargetsError('');
        try {
            const payload = await listTelemetryTargets(selectedSite);
            setTelemetryTargets(normalizeTelemetryTargets(payload));
        } catch (error) {
            console.error('Failed to load telemetry targets', error);
            setTargetsError('Unable to load telemetry targets right now.');
        }
    }, [selectedSite, token]);

    useEffect(() => {
        loadPages();
        loadSites();
    }, [loadPages, loadSites]);

    useEffect(() => {
        loadTelemetryTargets();
    }, [loadTelemetryTargets]);

    const rackOptions = useMemo(
        () =>
            [...telemetryTargets]
                .map((rack) => ({
                    id: resolveRackId(rack),
                    label: resolveRackLabel(rack),
                }))
                .filter((rack) => rack.id)
                .sort((a, b) => a.label.localeCompare(b.label)),
        [telemetryTargets],
    );

    const handleChange = (field) => (event) => {
        const value = field === 'enabled' ? event.target.checked : event.target.value;
        setFormState((prev) => {
            const next = { ...prev, [field]: value };
            if (field === 'title' && !slugTouched) {
                next.slug = slugify(value);
            }
            if (field === 'slug') {
                setSlugTouched(true);
            }
            if (field === 'rackId') {
                const selectedRack = telemetryTargets.find((rack) => resolveRackId(rack) === value);
                const telemetryId = resolveTargetTelemetryId(selectedRack);
                next.telemetryRackId = telemetryId ? `${telemetryId}`.trim() : '';
            }
            if (field === 'sortOrder') {
                const numeric = Number.isNaN(Number(value)) ? 0 : Number(value);
                next.sortOrder = numeric;
            }
            return next;
        });
        setFieldErrors((prev) => ({ ...prev, [field]: '' }));
        setFormError('');
    };

    const handleSelect = (page) => {
        resetForm(page);
    };

    const handleSiteChange = (event) => {
        const value = event.target.value;
        setSelectedSite(value);
        setTelemetryTargets([]);
        setFormState((prev) => ({
            ...prev,
            rackId: '',
            telemetryRackId: '',
        }));
        setFieldErrors((prev) => ({ ...prev, rackId: '', telemetryRackId: '' }));
        setFormError('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!token) return;
        setSaving(true);
        setFormError('');
        setFieldErrors({});

        const payload = {
            title: formState.title.trim(),
            rackId: formState.rackId,
            telemetryRackId: formState.telemetryRackId.trim(),
            slug: formState.slug.trim(),
            enabled: formState.enabled,
            sortOrder: Number(formState.sortOrder) || 0,
        };

        try {
            if (isEditing) {
                await adminUpdateMonitoringPage(selectedPage.id ?? selectedPage._id ?? selectedPage.slug, payload);
            } else {
                await adminCreateMonitoringPage(payload);
            }
            await loadPages();
            resetForm();
        } catch (error) {
            console.error('Failed to save monitoring page', error);
            const nextFieldErrors = detectFieldErrors(error);
            if (Object.keys(nextFieldErrors).length > 0) {
                setFieldErrors(nextFieldErrors);
            } else {
                setFormError(error?.message || 'Unable to save rack page.');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (page) => {
        if (!token || !page) return;
        const confirmed = window.confirm('Delete this rack page? This cannot be undone.');
        if (!confirmed) return;
        try {
            await adminDeleteMonitoringPage(page.id ?? page._id ?? page.slug);
            await loadPages();
            if (selectedPage && (selectedPage.id === page.id || selectedPage.slug === page.slug)) {
                resetForm();
            }
        } catch (error) {
            console.error('Failed to delete monitoring page', error);
            setListError('Unable to delete rack page.');
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Admin</p>
                    <h1 className={styles.title}>Rack Pages</h1>
                    <p className={styles.subtitle}>Create and manage monitoring pages tied to racks.</p>
                </div>
                <div className={styles.headerActions}>
                    <button type="button" className={styles.secondaryButton} onClick={loadPages}>
                        Refresh
                    </button>
                    <button type="button" className={styles.secondaryButton} onClick={() => resetForm()}>
                        New page
                    </button>
                </div>
            </header>

            <div className={styles.grid}>
                <section className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2>Rack pages</h2>
                        <span className={styles.meta}>{sortedPages.length} total</span>
                    </div>
                    {listError && <div className={styles.bannerError}>{listError}</div>}
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Telemetry target</th>
                                    <th>Slug</th>
                                    <th>Enabled</th>
                                    <th>Sort</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className={styles.emptyState}>Loading pages…</td>
                                    </tr>
                                ) : null}
                                {!loading && sortedPages.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className={styles.emptyState}>No rack pages yet.</td>
                                    </tr>
                                ) : null}
                                {!loading &&
                                    sortedPages.map((page) => {
                                        const isSelected = selectedPage?.id === page.id;
                                        return (
                                            <tr key={page.id || page.slug} className={isSelected ? styles.selectedRow : ''}>
                                                <td>
                                                    <div className={styles.primaryText}>
                                                        {resolvePageField(page, ['title', 'name'], 'Untitled')}
                                                    </div>
                                                    <div className={styles.meta}>ID: {page.id || page.slug}</div>
                                                </td>
                                                <td>{resolvePageRackId(page) || '—'}</td>
                                                <td>{resolvePageField(page, ['slug'], '—')}</td>
                                                <td>
                                                    {page?.enabled !== false ? (
                                                        <span className={styles.statusEnabled}>Enabled</span>
                                                    ) : (
                                                        <span className={styles.statusDisabled}>Disabled</span>
                                                    )}
                                                </td>
                                                <td>{resolvePageField(page, ['sortOrder', 'order'], 0)}</td>
                                                <td>
                                                    <div className={styles.rowActions}>
                                                        <button type="button" onClick={() => handleSelect(page)}>
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.dangerButton}
                                                            onClick={() => handleDelete(page)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2>{isEditing ? 'Edit rack page' : 'Create rack page'}</h2>
                        {isEditing ? (
                            <button type="button" className={styles.secondaryButton} onClick={() => resetForm()}>
                                Clear
                            </button>
                        ) : null}
                    </div>
                    <form onSubmit={handleSubmit}>
                        <label className={styles.label} htmlFor="rack-page-title">Title</label>
                        <input
                            id="rack-page-title"
                            className={styles.input}
                            value={formState.title}
                            onChange={handleChange('title')}
                            placeholder="Rack monitoring page"
                            required
                        />
                        {fieldErrors.title && <div className={styles.inlineError}>{fieldErrors.title}</div>}

                        <label className={styles.label} htmlFor="rack-page-site">Site</label>
                        <select
                            id="rack-page-site"
                            className={styles.input}
                            value={selectedSite}
                            onChange={handleSiteChange}
                            required
                            disabled={Boolean(requestedSite)}
                        >
                            <option value="">Select a site</option>
                            {sites.map((site) => (
                                <option key={site} value={site}>
                                    {site}
                                </option>
                            ))}
                        </select>

                        <label className={styles.label} htmlFor="rack-page-rack">Telemetry target</label>
                        {isEditing ? (
                            <input
                                id="rack-page-rack"
                                className={styles.input}
                                value={formState.rackId}
                                readOnly
                            />
                        ) : (
                            <select
                                id="rack-page-rack"
                                className={styles.input}
                                value={formState.rackId}
                                onChange={handleChange('rackId')}
                                required
                            >
                                <option value="">Select a rack</option>
                                {rackOptions.map((rack) => (
                                    <option key={rack.id} value={rack.id}>
                                        {rack.label}
                                    </option>
                                ))}
                            </select>
                        )}
                        {fieldErrors.rackId && <div className={styles.inlineError}>{fieldErrors.rackId}</div>}
                        {targetsError && <div className={styles.inlineError}>{targetsError}</div>}

                        <label className={styles.label} htmlFor="rack-page-telemetry-rack">
                            Telemetry rack identifier (device)
                        </label>
                        <input
                            id="rack-page-telemetry-rack"
                            className={styles.input}
                            value={formState.telemetryRackId}
                            onChange={handleChange('telemetryRackId')}
                            placeholder="Device telemetry rack ID"
                            required
                        />
                        {fieldErrors.telemetryRackId && (
                            <div className={styles.inlineError}>{fieldErrors.telemetryRackId}</div>
                        )}

                        <label className={styles.label} htmlFor="rack-page-slug">Slug</label>
                        <input
                            id="rack-page-slug"
                            className={styles.input}
                            value={formState.slug}
                            onChange={handleChange('slug')}
                            placeholder="rack-slug"
                            required
                        />
                        {fieldErrors.slug && <div className={styles.inlineError}>{fieldErrors.slug}</div>}

                        <label className={styles.checkboxRow} htmlFor="rack-page-enabled">
                            <input
                                id="rack-page-enabled"
                                type="checkbox"
                                checked={formState.enabled}
                                onChange={handleChange('enabled')}
                            />
                            <span>Enabled</span>
                        </label>

                        <label className={styles.label} htmlFor="rack-page-sort">Sort order</label>
                        <input
                            id="rack-page-sort"
                            className={styles.input}
                            type="number"
                            value={formState.sortOrder}
                            onChange={handleChange('sortOrder')}
                        />

                        {formError && <div className={styles.bannerError}>{formError}</div>}

                        <button type="submit" className={styles.primaryButton} disabled={saving}>
                            {saving ? 'Saving…' : 'Save page'}
                        </button>
                    </form>
                </section>
            </div>
        </div>
    );
}
