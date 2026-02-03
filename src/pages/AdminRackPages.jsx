import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    adminCreateMonitoringPage,
    adminDeleteMonitoringPage,
    adminListMonitoringPages,
    adminUpdateMonitoringPage,
    listTelemetryTargets,
    listSystems,
} from '../api/monitoringPages.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSearchParams } from 'react-router-dom';
import styles from './AdminRackPages.module.css';

const emptyForm = {
    title: '',
    farm: '',
    unitType: '',
    unitId: '',
    subUnitType: '',
    subUnitId: '',
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
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.targets)) return payload.targets;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.items)) return payload.data.items;
    if (Array.isArray(payload?.data?.targets)) return payload.data.targets;
    return [];
};

const normalizeSites = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.systems)) return payload.systems;
    if (Array.isArray(payload?.sites)) return payload.sites;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.systems)) return payload.data.systems;
    if (Array.isArray(payload?.data?.sites)) return payload.data.sites;
    return [];
};

const resolveTargetValue = (target, candidates) => {
    if (!target) return '';
    for (const key of candidates) {
        const value = target?.[key];
        if (value !== undefined && value !== null && `${value}`.trim()) {
            return `${value}`.trim();
        }
    }
    return '';
};

const normalizeUnitType = (value) => `${value || ''}`.trim().toUpperCase();

const normalizeTarget = (target, farmFallback = '') => {
    if (!target || typeof target !== 'object') return null;
    const farm = resolveTargetValue(target, ['farm', 'system', 'site', 'farmId', 'systemId', 'siteId']) || farmFallback;
    const unitType = normalizeUnitType(
        resolveTargetValue(target, ['unitType', 'unit_type', 'type', 'unit', 'unit_type_name']),
    );
    const unitId = resolveTargetValue(target, ['unitId', 'unit_id', 'unit', 'unitKey', 'unit_key']);
    const subUnitType = normalizeUnitType(resolveTargetValue(target, ['subUnitType', 'sub_unit_type', 'subUnit']));
    const subUnitId = resolveTargetValue(target, ['subUnitId', 'sub_unit_id', 'subUnitId', 'sub_unit']);
    if (!unitType || !unitId) return null;
    return { farm, unitType, unitId, subUnitType, subUnitId };
};

const formatTargetLabel = (target) => {
    if (!target?.unitType || !target?.unitId) return '';
    const parts = [`${target.unitType} ${target.unitId}`];
    if (target.subUnitType && target.subUnitId) {
        parts.push(`${target.subUnitType} ${target.subUnitId}`);
    }
    return parts.join(' • ');
};

const resolveSiteId = (site) =>
    site?.system ??
    site?.systemId ??
    site?.system_id ??
    site?.site ??
    site?.siteId ??
    site?.site_id ??
    site?.id ??
    site?.value ??
    site?.key ??
    '';

const resolveSiteLabel = (site) => site?.label || site?.name || site?.title || resolveSiteId(site);

const resolvePageField = (page, candidates, fallback = '') => {
    for (const key of candidates) {
        const value = page?.[key];
        if (value !== undefined && value !== null && `${value}`.trim()) {
            return value;
        }
    }
    return fallback;
};

const resolvePageTargetField = (page, keys) => {
    const containers = [page, page?.target, page?.telemetryTarget, page?.telemetry_target];
    for (const container of containers) {
        if (!container) continue;
        const value = resolveTargetValue(container, keys);
        if (value) return value;
    }
    return '';
};

const resolvePageTarget = (page) => {
    const farm = resolvePageTargetField(page, ['farm', 'system', 'site', 'farmId', 'systemId', 'siteId']);
    const unitType = normalizeUnitType(resolvePageTargetField(page, ['unitType', 'unit_type', 'type', 'unit']));
    const unitId = resolvePageTargetField(page, ['unitId', 'unit_id', 'unit']);
    const subUnitType = normalizeUnitType(resolvePageTargetField(page, ['subUnitType', 'sub_unit_type', 'subUnit']));
    const subUnitId = resolvePageTargetField(page, ['subUnitId', 'sub_unit_id', 'subUnitId', 'sub_unit']);
    return { farm, unitType, unitId, subUnitType, subUnitId };
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
                rawField === 'unit_type' || rawField === 'unitType'
                    ? 'unitType'
                    : rawField === 'unit_id' || rawField === 'unitId'
                      ? 'unitId'
                      : rawField === 'sub_unit_type' || rawField === 'subUnitType'
                        ? 'subUnitType'
                        : rawField === 'sub_unit_id' || rawField === 'subUnitId'
                          ? 'subUnitId'
                          : rawField === 'farm' || rawField === 'system' || rawField === 'site'
                            ? 'farm'
                            : rawField === 'slug'
                              ? 'slug'
                              : rawField;
            pushFieldError(field, message);
        });
    }

    const message = `${payload?.message || error?.message || ''}`.toLowerCase();
    const hasDuplicateHint = message.includes('duplicate') || message.includes('unique') || message.includes('exists');

    if (hasDuplicateHint && (message.includes('unit') || message.includes('target'))) {
        pushFieldError('unitId', 'Each telemetry target can only be assigned to one monitoring page.');
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
    const [farms, setFarms] = useState([]);
    const [selectedFarm, setSelectedFarm] = useState(() => (
        searchParams.get('farm') || searchParams.get('system') || searchParams.get('site') || ''
    ));
    const [farmsLoading, setFarmsLoading] = useState(false);
    const [farmsError, setFarmsError] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [targetsLoading, setTargetsLoading] = useState(false);
    const [listError, setListError] = useState('');
    const [targetsError, setTargetsError] = useState('');
    const [formError, setFormError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [selectedPage, setSelectedPage] = useState(null);
    const [formState, setFormState] = useState(emptyForm);
    const [slugTouched, setSlugTouched] = useState(false);
    const requestedFarm = searchParams.get('farm') || searchParams.get('system') || searchParams.get('site') || '';

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
            setFormState({ ...emptyForm, farm: selectedFarm });
            setSlugTouched(false);
            setFieldErrors({});
            setFormError('');
            return;
        }

        const target = resolvePageTarget(page);
        setSelectedPage(page);
        setFormState({
            title: resolvePageField(page, ['title', 'name', 'pageTitle'], ''),
            farm: target.farm,
            unitType: target.unitType,
            unitId: target.unitId,
            subUnitType: target.subUnitType,
            subUnitId: target.subUnitId,
            slug: resolvePageField(page, ['slug', 'path'], ''),
            enabled: page?.enabled !== false,
            sortOrder: Number(resolvePageField(page, ['sortOrder', 'order'], 0)),
        });
        if (target.farm) {
            setSelectedFarm(target.farm);
        }
        setSlugTouched(true);
        setFieldErrors({});
        setFormError('');
    }, [selectedFarm]);

    const loadPages = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setListError('');
        try {
            const payload = await adminListMonitoringPages();
            setPages(normalizeMonitoringPages(payload));
        } catch (error) {
            console.error('Failed to load monitoring pages', error);
            setListError('Unable to load monitoring pages right now.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    const loadFarms = useCallback(async () => {
        if (!token) return;
        setFarmsLoading(true);
        setFarmsError('');
        try {
            const payload = await listSystems();
            const rawSites = normalizeSites(payload);
            const mapped = rawSites
                .map((site) => {
                    if (typeof site === 'string' || typeof site === 'number') {
                        const value = `${site}`.trim();
                        return value ? { id: value, label: value } : null;
                    }
                    if (!site) return null;
                    const id = `${resolveSiteId(site)}`.trim();
                    if (!id) return null;
                    const label = `${resolveSiteLabel(site)}`.trim() || id;
                    return { id, label };
                })
                .filter(Boolean)
                .sort((a, b) => a.label.localeCompare(b.label));
            if (selectedFarm && !mapped.find((site) => site.id === selectedFarm)) {
                mapped.unshift({ id: selectedFarm, label: selectedFarm });
            }
            setFarms(mapped);
        } catch (error) {
            console.error('Failed to load farms', error);
            setFarmsError('Unable to load farms right now.');
            if (requestedFarm) {
                setFarms([{ id: requestedFarm, label: requestedFarm }]);
            } else {
                setFarms([]);
            }
        } finally {
            setFarmsLoading(false);
        }
    }, [requestedFarm, selectedFarm, token]);

    const loadTelemetryTargets = useCallback(async () => {
        if (!token) return;
        if (!selectedFarm) {
            setTelemetryTargets([]);
            setTargetsError('Select a farm to load telemetry targets.');
            return;
        }
        setTargetsError('');
        setTargetsLoading(true);
        try {
            const payload = await listTelemetryTargets(selectedFarm);
            console.log('telemetryTargets response:', payload);
            const targets = normalizeTelemetryTargets(payload);
            console.log('parsed targets:', targets);
            setTelemetryTargets(targets);
        } catch (error) {
            console.error('Failed to load telemetry targets', error);
            setTargetsError('Unable to load telemetry targets right now.');
        } finally {
            setTargetsLoading(false);
        }
    }, [selectedFarm, token]);

    useEffect(() => {
        loadPages();
        loadFarms();
    }, [loadFarms, loadPages]);

    useEffect(() => {
        loadTelemetryTargets();
    }, [loadTelemetryTargets]);

    useEffect(() => {
        if (!selectedFarm || isEditing) return;
        setFormState((prev) => (prev.farm === selectedFarm ? prev : { ...prev, farm: selectedFarm }));
    }, [isEditing, selectedFarm]);

    const normalizedTargets = useMemo(
        () =>
            telemetryTargets
                .map((target) => normalizeTarget(target, selectedFarm))
                .filter(Boolean),
        [selectedFarm, telemetryTargets],
    );

    const unitTypeOptions = useMemo(() => {
        const values = Array.from(new Set(normalizedTargets.map((target) => target.unitType).filter(Boolean)));
        return values.sort((a, b) => a.localeCompare(b));
    }, [normalizedTargets]);

    const unitIdOptions = useMemo(() => {
        if (!formState.unitType) return [];
        const values = Array.from(
            new Set(
                normalizedTargets
                    .filter((target) => target.unitType === formState.unitType)
                    .map((target) => target.unitId)
                    .filter(Boolean),
            ),
        );
        return values.sort((a, b) => a.localeCompare(b));
    }, [formState.unitType, normalizedTargets]);

    const subUnitTypeOptions = useMemo(() => {
        if (formState.unitType !== 'RACK' || !formState.unitId) return [];
        const values = Array.from(
            new Set(
                normalizedTargets
                    .filter((target) => target.unitType === 'RACK' && target.unitId === formState.unitId)
                    .map((target) => target.subUnitType)
                    .filter(Boolean),
            ),
        );
        return values.sort((a, b) => a.localeCompare(b));
    }, [formState.unitId, formState.unitType, normalizedTargets]);

    const subUnitIdOptions = useMemo(() => {
        if (formState.unitType !== 'RACK' || !formState.unitId || !formState.subUnitType) return [];
        const values = Array.from(
            new Set(
                normalizedTargets
                    .filter(
                        (target) =>
                            target.unitType === 'RACK' &&
                            target.unitId === formState.unitId &&
                            target.subUnitType === formState.subUnitType,
                    )
                    .map((target) => target.subUnitId)
                    .filter(Boolean),
            ),
        );
        return values.sort((a, b) => a.localeCompare(b));
    }, [formState.subUnitType, formState.unitId, formState.unitType, normalizedTargets]);

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
            if (field === 'farm') {
                next.unitType = '';
                next.unitId = '';
                next.subUnitType = '';
                next.subUnitId = '';
            }
            if (field === 'unitType') {
                next.unitId = '';
                next.subUnitType = '';
                next.subUnitId = '';
            }
            if (field === 'unitId') {
                next.subUnitType = '';
                next.subUnitId = '';
            }
            if (field === 'subUnitType') {
                next.subUnitId = '';
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

    const handleFarmChange = (event) => {
        const value = event.target.value;
        setSelectedFarm(value);
        setTelemetryTargets([]);
        setFormState((prev) => ({
            ...prev,
            farm: value,
            unitType: '',
            unitId: '',
            subUnitType: '',
            subUnitId: '',
        }));
        setFieldErrors((prev) => ({
            ...prev,
            farm: '',
            unitType: '',
            unitId: '',
            subUnitType: '',
            subUnitId: '',
        }));
        setFormError('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!token) return;
        setSaving(true);
        setFormError('');
        setFieldErrors({});

        const nextFieldErrors = {};
        if (!formState.farm) {
            nextFieldErrors.farm = 'Select a farm.';
        }
        if (!formState.unitType) {
            nextFieldErrors.unitType = 'Select a unit type.';
        }
        if (!formState.unitId) {
            nextFieldErrors.unitId = 'Select a unit ID.';
        }
        if (formState.unitType === 'RACK') {
            if (formState.subUnitType && !formState.subUnitId) {
                nextFieldErrors.subUnitId = 'Select a sub-unit ID.';
            }
            if (!formState.subUnitType && formState.subUnitId) {
                nextFieldErrors.subUnitType = 'Select a sub-unit type.';
            }
        }
        if (Object.keys(nextFieldErrors).length > 0) {
            setFieldErrors(nextFieldErrors);
            setSaving(false);
            return;
        }

        const payload = {
            title: formState.title.trim(),
            farm: formState.farm,
            unitType: formState.unitType,
            unitId: formState.unitId,
            subUnitType: formState.subUnitType || undefined,
            subUnitId: formState.subUnitId || undefined,
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
                setFormError(error?.message || 'Unable to save monitoring page.');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (page) => {
        if (!token || !page) return;
        const confirmed = window.confirm('Delete this monitoring page? This cannot be undone.');
        if (!confirmed) return;
        try {
            await adminDeleteMonitoringPage(page.id ?? page._id ?? page.slug);
            await loadPages();
            if (selectedPage && (selectedPage.id === page.id || selectedPage.slug === page.slug)) {
                resetForm();
            }
        } catch (error) {
            console.error('Failed to delete monitoring page', error);
            setListError('Unable to delete monitoring page.');
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Admin</p>
                    <h1 className={styles.title}>Monitoring Pages</h1>
                    <p className={styles.subtitle}>Create and manage monitoring pages tied to telemetry targets.</p>
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
                        <h2>Monitoring pages</h2>
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
                                        <td colSpan={6} className={styles.emptyState}>No monitoring pages yet.</td>
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
                                                <td>{formatTargetLabel(resolvePageTarget(page)) || '—'}</td>
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
                        <h2>{isEditing ? 'Edit monitoring page' : 'Create monitoring page'}</h2>
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
                            placeholder="Monitoring page title"
                            required
                        />
                        {fieldErrors.title && <div className={styles.inlineError}>{fieldErrors.title}</div>}

                        <label className={styles.label} htmlFor="rack-page-site">Farm</label>
                        <select
                            id="rack-page-site"
                            className={styles.input}
                            value={selectedFarm}
                            onChange={handleFarmChange}
                            required
                            disabled={Boolean(requestedFarm) || farmsLoading}
                        >
                            <option value="">{farmsLoading ? 'Loading farms…' : 'Select a farm'}</option>
                            {farms.map((farm) => (
                                <option key={farm.id} value={farm.id}>
                                    {farm.label}
                                </option>
                            ))}
                        </select>
                        {fieldErrors.farm && <div className={styles.inlineError}>{fieldErrors.farm}</div>}
                        {farmsError && <div className={styles.inlineError}>{farmsError}</div>}

                        <label className={styles.label} htmlFor="rack-page-unit-type">Unit type</label>
                        <select
                            id="rack-page-unit-type"
                            className={styles.input}
                            value={formState.unitType}
                            onChange={handleChange('unitType')}
                            required
                            disabled={!selectedFarm || targetsLoading}
                        >
                            <option value="">
                                {targetsLoading ? 'Loading unit types…' : 'Select a unit type'}
                            </option>
                            {unitTypeOptions.map((unitType) => (
                                <option key={unitType} value={unitType}>
                                    {unitType}
                                </option>
                            ))}
                        </select>
                        {fieldErrors.unitType && <div className={styles.inlineError}>{fieldErrors.unitType}</div>}

                        <label className={styles.label} htmlFor="rack-page-unit-id">Unit ID</label>
                        <select
                            id="rack-page-unit-id"
                            className={styles.input}
                            value={formState.unitId}
                            onChange={handleChange('unitId')}
                            required
                            disabled={!formState.unitType}
                        >
                            <option value="">Select a unit ID</option>
                            {unitIdOptions.map((unitId) => (
                                <option key={unitId} value={unitId}>
                                    {unitId}
                                </option>
                            ))}
                        </select>
                        {fieldErrors.unitId && <div className={styles.inlineError}>{fieldErrors.unitId}</div>}
                        {targetsError && <div className={styles.inlineError}>{targetsError}</div>}
                        {selectedFarm && !targetsLoading && !targetsError && normalizedTargets.length === 0 ? (
                            <div className={styles.inlineNotice}>No telemetry targets found for this farm.</div>
                        ) : null}

                        {formState.unitType === 'RACK' ? (
                            <>
                                <label className={styles.label} htmlFor="rack-page-subunit-type">
                                    Sub-unit type (optional)
                                </label>
                                <select
                                    id="rack-page-subunit-type"
                                    className={styles.input}
                                    value={formState.subUnitType}
                                    onChange={handleChange('subUnitType')}
                                    disabled={!formState.unitId}
                                >
                                    <option value="">Select a sub-unit type</option>
                                    {subUnitTypeOptions.map((subUnitType) => (
                                        <option key={subUnitType} value={subUnitType}>
                                            {subUnitType}
                                        </option>
                                    ))}
                                </select>
                                {fieldErrors.subUnitType && (
                                    <div className={styles.inlineError}>{fieldErrors.subUnitType}</div>
                                )}

                                <label className={styles.label} htmlFor="rack-page-subunit-id">
                                    Sub-unit ID (optional)
                                </label>
                                <select
                                    id="rack-page-subunit-id"
                                    className={styles.input}
                                    value={formState.subUnitId}
                                    onChange={handleChange('subUnitId')}
                                    disabled={!formState.subUnitType}
                                >
                                    <option value="">Select a sub-unit ID</option>
                                    {subUnitIdOptions.map((subUnitId) => (
                                        <option key={subUnitId} value={subUnitId}>
                                            {subUnitId}
                                        </option>
                                    ))}
                                </select>
                                {fieldErrors.subUnitId && (
                                    <div className={styles.inlineError}>{fieldErrors.subUnitId}</div>
                                )}
                            </>
                        ) : null}

                        <label className={styles.label} htmlFor="rack-page-slug">Slug</label>
                        <input
                            id="rack-page-slug"
                            className={styles.input}
                            value={formState.slug}
                            onChange={handleChange('slug')}
                            placeholder="monitoring-page"
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
