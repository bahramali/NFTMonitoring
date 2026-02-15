import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    createAdminBanner,
    deleteAdminBanner,
    listAdminBanners,
    updateAdminBanner,
} from '../../api/adminBanners.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS, hasPerm } from '../../utils/permissions.js';
import styles from './AdminStoreBannersPage.module.css';

const TYPE_OPTIONS = ['HERO', 'PROMO', 'INFO', 'NEWS'];

const emptyForm = {
    id: null,
    type: 'PROMO',
    title: '',
    subtitle: '',
    description: '',
    imageUrl: '',
    buttonText: '',
    buttonUrl: '',
    position: 0,
    active: true,
    startAt: '',
    endAt: '',
};

const toDatetimeInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const tzOffset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

const fromDatetimeInput = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export default function AdminStoreBannersPage() {
    const { token, permissions } = useAuth();
    const hasAccess = hasPerm({ permissions }, PERMISSIONS.PRODUCTS_MANAGE);

    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [activeFilter, setActiveFilter] = useState('all');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const loadBanners = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError('');
        try {
            const payload = await listAdminBanners(token);
            setBanners(payload);
        } catch (err) {
            setError(err?.message || 'Unable to load banners.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadBanners();
    }, [loadBanners]);

    const filteredBanners = useMemo(() => {
        return banners
            .filter((banner) => {
                const title = banner?.title?.toLowerCase() || '';
                const searchMatch = !search.trim() || title.includes(search.trim().toLowerCase());
                const typeMatch = typeFilter === 'all' || banner.type === typeFilter;
                const activeMatch =
                    activeFilter === 'all'
                        || (activeFilter === 'active' && banner.active)
                        || (activeFilter === 'inactive' && !banner.active);

                return searchMatch && typeMatch && activeMatch;
            })
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }, [activeFilter, banners, search, typeFilter]);

    const openCreate = () => {
        setForm(emptyForm);
        setFormError('');
        setIsModalOpen(true);
    };

    const openEdit = (banner) => {
        setForm({
            id: banner.id,
            type: banner.type || 'PROMO',
            title: banner.title || '',
            subtitle: banner.subtitle || '',
            description: banner.description || '',
            imageUrl: banner.imageUrl || '',
            buttonText: banner.buttonText || '',
            buttonUrl: banner.buttonUrl || '',
            position: Number(banner.position || 0),
            active: banner.active !== false,
            startAt: toDatetimeInput(banner.startAt),
            endAt: toDatetimeInput(banner.endAt),
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const validateForm = () => {
        if (!form.title.trim()) return 'Title is required.';
        if (form.buttonText.trim() && !form.buttonUrl.trim()) return 'Button URL is required when button text is set.';

        if (form.startAt && form.endAt) {
            const start = new Date(form.startAt);
            const end = new Date(form.endAt);
            if (start > end) return 'Start date must be before end date.';
        }

        return '';
    };

    const handleSave = async (event) => {
        event.preventDefault();
        const validationError = validateForm();
        if (validationError) {
            setFormError(validationError);
            return;
        }

        setSaving(true);
        setFormError('');

        const payload = {
            type: form.type,
            title: form.title.trim(),
            subtitle: form.subtitle.trim() || null,
            description: form.description.trim() || null,
            imageUrl: form.imageUrl.trim() || null,
            buttonText: form.buttonText.trim() || null,
            buttonUrl: form.buttonUrl.trim() || null,
            position: Number(form.position || 0),
            active: Boolean(form.active),
            startAt: fromDatetimeInput(form.startAt),
            endAt: fromDatetimeInput(form.endAt),
        };

        try {
            if (form.id) {
                await updateAdminBanner(token, form.id, payload);
            } else {
                await createAdminBanner(token, payload);
            }
            setIsModalOpen(false);
            await loadBanners();
        } catch (err) {
            setFormError(err?.message || 'Unable to save banner.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (bannerId) => {
        if (!bannerId) return;
        const confirmed = window.confirm('Delete this banner?');
        if (!confirmed) return;

        try {
            await deleteAdminBanner(token, bannerId);
            await loadBanners();
        } catch (err) {
            setError(err?.message || 'Unable to delete banner.');
        }
    };

    if (!hasAccess) {
        return <div className={styles.noAccess}>You need Products Manage permission to view this page.</div>;
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p>Store → Banners</p>
                    <h1>Banners</h1>
                </div>
                <button type="button" onClick={openCreate}>Create banner</button>
            </header>

            <section className={styles.toolbar}>
                <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search title"
                />
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                    <option value="all">All types</option>
                    {TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </section>

            {error ? <div className={styles.alert}>{error}</div> : null}

            <section className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Preview</th>
                            <th>Title</th>
                            <th>Type</th>
                            <th>Active</th>
                            <th>Position</th>
                            <th>Date range</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} className={styles.empty}>Loading banners…</td>
                            </tr>
                        ) : filteredBanners.length === 0 ? (
                            <tr>
                                <td colSpan={7} className={styles.empty}>No banners found.</td>
                            </tr>
                        ) : filteredBanners.map((banner) => (
                            <tr key={banner.id}>
                                <td>
                                    {banner.imageUrl ? <img src={banner.imageUrl} alt={banner.title || 'Banner'} className={styles.thumb} /> : '—'}
                                </td>
                                <td>{banner.title}</td>
                                <td>{banner.type}</td>
                                <td>{banner.active ? 'Yes' : 'No'}</td>
                                <td>{banner.position ?? 0}</td>
                                <td>{banner.startAt || banner.endAt ? `${banner.startAt || '—'} → ${banner.endAt || '—'}` : 'Always'}</td>
                                <td>
                                    <div className={styles.actions}>
                                        <button type="button" onClick={() => openEdit(banner)}>Edit</button>
                                        <button type="button" className={styles.deleteBtn} onClick={() => handleDelete(banner.id)}>
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {isModalOpen ? (
                <div className={styles.backdrop}>
                    <form className={styles.modal} onSubmit={handleSave}>
                        <h2>{form.id ? 'Edit banner' : 'Create banner'}</h2>

                        <label>
                            Type
                            <select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}>
                                {TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </label>
                        <label>
                            Title
                            <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} required />
                        </label>
                        <label>
                            Subtitle
                            <input value={form.subtitle} onChange={(event) => setForm((prev) => ({ ...prev, subtitle: event.target.value }))} />
                        </label>
                        <label>
                            Description
                            <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} />
                        </label>
                        <label>
                            Image URL
                            <input value={form.imageUrl} onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))} />
                        </label>
                        <div className={styles.grid2}>
                            <label>
                                Button text
                                <input value={form.buttonText} onChange={(event) => setForm((prev) => ({ ...prev, buttonText: event.target.value }))} />
                            </label>
                            <label>
                                Button URL
                                <input value={form.buttonUrl} onChange={(event) => setForm((prev) => ({ ...prev, buttonUrl: event.target.value }))} />
                            </label>
                        </div>
                        <div className={styles.grid3}>
                            <label>
                                Position
                                <input
                                    type="number"
                                    value={form.position}
                                    onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))}
                                />
                            </label>
                            <label>
                                Start at
                                <input
                                    type="datetime-local"
                                    value={form.startAt}
                                    onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))}
                                />
                            </label>
                            <label>
                                End at
                                <input
                                    type="datetime-local"
                                    value={form.endAt}
                                    onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
                                />
                            </label>
                        </div>
                        <label className={styles.checkbox}>
                            <input
                                type="checkbox"
                                checked={form.active}
                                onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                            />
                            Active
                        </label>

                        {formError ? <div className={styles.alert}>{formError}</div> : null}

                        <div className={styles.modalActions}>
                            <button type="button" onClick={() => setIsModalOpen(false)}>Cancel</button>
                            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
}
