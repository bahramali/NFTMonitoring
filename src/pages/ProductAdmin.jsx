import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { listAdminProducts, createProduct, updateProduct, toggleProductActive, updateProductStock, deleteProduct } from '../api/products.js';
import { fetchPermissionDefinitions } from '../api/admins.js';
import { useAuth } from '../context/AuthContext.jsx';
import AccessDenied from '../components/AccessDenied.jsx';
import { formatCurrency } from '../utils/currency.js';
import { findPermissionLabel, hasStoreAdminAccess, STORE_PERMISSION_FALLBACK, STORE_PERMISSION_KEY } from '../utils/permissions.js';
import styles from './ProductAdmin.module.css';

const CATEGORY_OPTIONS = ['Basil', 'Packaging', 'Hydroponic gear'];

const emptyForm = {
    name: '',
    description: '',
    price: '',
    currency: 'SEK',
    stock: 0,
    category: CATEGORY_OPTIONS[0],
    imageUrl: '',
    sku: '',
    active: true,
};

const SORT_OPTIONS = [
    { value: 'updated_desc', label: 'Updated (newest)' },
    { value: 'price_desc', label: 'Price (high to low)' },
    { value: 'price_asc', label: 'Price (low to high)' },
];

const normalizeProducts = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.products)) return payload.products;
    return [];
};

const normalizePermissionDefinitions = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.permissions)) return payload.permissions;
    return [];
};

const normalizeNumber = (value, fallback = 0) => {
    if (value === '' || value === null || value === undefined) return fallback;
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return fallback;
    return numeric;
};

export default function ProductAdmin() {
    const { isAuthenticated, token, role, permissions } = useAuth();
    const [products, setProducts] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [formState, setFormState] = useState(emptyForm);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [listError, setListError] = useState(null);
    const [formError, setFormError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [sortBy, setSortBy] = useState('updated_desc');
    const [permissionDefinitions, setPermissionDefinitions] = useState([]);
    const [confirmingDelete, setConfirmingDelete] = useState(null);
    const [actioningId, setActioningId] = useState(null);

    const hasAccess = hasStoreAdminAccess(role, permissions);

    const storePermissionLabel = useMemo(() => {
        const labels = [
            findPermissionLabel(permissionDefinitions, STORE_PERMISSION_KEY),
            findPermissionLabel(permissionDefinitions, STORE_PERMISSION_FALLBACK),
        ].filter(Boolean);
        if (labels.length > 0) return labels[0];
        return 'store admin';
    }, [permissionDefinitions]);

    const showToast = useCallback((type, message) => {
        setToast({ type, message, id: Date.now() });
        window.setTimeout(() => setToast(null), 4000);
    }, []);

    const applySelection = useCallback((nextProducts, preferredId = null) => {
        const nextList = normalizeProducts(nextProducts);
        setProducts(nextList);

        const targetId = preferredId || selectedId;
        if (targetId) {
            const matched = nextList.find((item) => item?.id === targetId);
            if (matched) {
                setSelectedId(matched.id);
                setFormState({ ...emptyForm, ...matched, price: matched.price ?? '', stock: matched.stock ?? 0, active: matched.active !== false });
                return;
            }
        }

        setSelectedId(null);
        setFormState(emptyForm);
    }, [selectedId]);

    const loadProducts = useCallback(async (options = {}) => {
        if (!token) return;
        setLoading(true);
        setListError(null);
        try {
            const payload = await listAdminProducts(token);
            applySelection(payload, options.preferId);
        } catch (error) {
            console.error('Failed to load products', error);
            setListError('Unable to load products right now. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [applySelection, token]);

    const loadPermissionDefs = useCallback(async () => {
        if (!token) return;
        try {
            const defs = await fetchPermissionDefinitions(token);
            setPermissionDefinitions(normalizePermissionDefinitions(defs));
        } catch (error) {
            console.warn('Permission definitions unavailable; continuing with defaults.', error);
        }
    }, [token]);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    useEffect(() => {
        loadPermissionDefs();
    }, [loadPermissionDefs]);

    const filteredProducts = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        let list = [...products];

        if (query) {
            list = list.filter((product) => {
                const haystacks = [product.name, product.sku].map((value) => `${value || ''}`.toLowerCase());
                return haystacks.some((value) => value.includes(query));
            });
        }

        if (statusFilter !== 'all') {
            const shouldBeActive = statusFilter === 'active';
            list = list.filter((product) => (product.active ?? true) === shouldBeActive);
        }

        if (categoryFilter !== 'all') {
            list = list.filter((product) => product.category === categoryFilter);
        }

        list.sort((a, b) => {
            if (sortBy === 'price_desc') return (b.price ?? 0) - (a.price ?? 0);
            if (sortBy === 'price_asc') return (a.price ?? 0) - (b.price ?? 0);
            const aDate = new Date(a.updatedAt || a.updated || a.createdAt || 0).getTime();
            const bDate = new Date(b.updatedAt || b.updated || b.createdAt || 0).getTime();
            return bDate - aDate;
        });

        return list;
    }, [categoryFilter, products, searchTerm, sortBy, statusFilter]);

    const selectedProduct = useMemo(
        () => products.find((product) => product.id === selectedId) || null,
        [products, selectedId],
    );

    const handleEdit = useCallback((product) => {
        if (!product?.id) return;
        setSelectedId(product.id);
        setFormState({ ...emptyForm, ...product, price: product.price ?? '', stock: product.stock ?? 0, active: product.active !== false });
    }, []);

    const handleToggleActive = useCallback(async (product) => {
        if (!product?.id || saving) return;
        const nextActive = !(product.active ?? true);
        setActioningId(product.id);
        try {
            await toggleProductActive(product.id, nextActive, token);
            showToast('success', nextActive ? 'Product activated' : 'Product deactivated');
            loadProducts({ preferId: product.id });
        } catch (error) {
            console.error('Failed to toggle status', error);
            showToast('error', 'Could not update product status.');
        } finally {
            setActioningId(null);
        }
    }, [loadProducts, saving, showToast, token]);

    const handleAdjustStock = useCallback(async (product) => {
        if (!product?.id || saving) return;
        const response = window.prompt('Set stock quantity', product.stock ?? 0);
        if (response === null) return;
        const nextStock = normalizeNumber(response, product.stock ?? 0);
        if (nextStock < 0) {
            showToast('error', 'Stock must be zero or greater.');
            return;
        }

        setActioningId(product.id);
        try {
            await updateProductStock(product.id, nextStock, token);
            showToast('success', 'Stock updated');
            loadProducts({ preferId: product.id });
        } catch (error) {
            console.error('Failed to update stock', error);
            showToast('error', 'Could not update stock.');
        } finally {
            setActioningId(null);
        }
    }, [loadProducts, saving, showToast, token]);

    const handleDelete = useCallback(async () => {
        if (!confirmingDelete?.id) return;
        setSaving(true);
        try {
            await deleteProduct(confirmingDelete.id, token);
            showToast('success', 'Product removed');
            setConfirmingDelete(null);
            loadProducts();
        } catch (error) {
            console.error('Failed to delete product', error);
            showToast('error', 'Could not delete product.');
        } finally {
            setSaving(false);
        }
    }, [confirmingDelete, loadProducts, showToast, token]);

    const validateForm = () => {
        if (!formState.name || formState.name.trim().length < 2) return 'Name must be at least 2 characters.';
        const priceNumber = normalizeNumber(formState.price, -1);
        if (priceNumber < 0) return 'Price cannot be negative.';
        const stockNumber = normalizeNumber(formState.stock, 0);
        if (stockNumber < 0) return 'Stock cannot be negative.';
        return '';
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (saving) return;
        setFormError(null);
        const validationError = validateForm();
        if (validationError) {
            setFormError(validationError);
            showToast('error', validationError);
            return;
        }

        setSaving(true);
        const payload = {
            name: formState.name.trim(),
            description: formState.description?.trim() || '',
            price: normalizeNumber(formState.price, 0),
            currency: formState.currency || 'SEK',
            stock: normalizeNumber(formState.stock, 0),
            category: formState.category || CATEGORY_OPTIONS[0],
            imageUrl: formState.imageUrl?.trim() || '',
            sku: formState.sku?.trim() || '',
            active: formState.active !== false,
        };

        try {
            if (selectedProduct) {
                const updated = await updateProduct(selectedProduct.id, payload, token);
                showToast('success', 'Product updated');
                loadProducts({ preferId: updated?.id || selectedProduct.id });
            } else {
                const created = await createProduct(payload, token);
                showToast('success', 'Product created');
                loadProducts({ preferId: created?.id });
            }
        } catch (error) {
            console.error('Failed to save product', error);
            setFormError('Unable to save product right now.');
            showToast('error', 'Could not save product.');
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setSelectedId(null);
        setFormState({ ...emptyForm });
    };

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!hasAccess) {
        return (
            <AccessDenied
                message={`You need ${storePermissionLabel} permissions to manage products.`}
                actionHref="/monitoring"
                actionLabel="Back to monitoring"
                secondaryActionHref="/login"
            />
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Monitoring / Admin</p>
                    <h1 className={styles.title}>Product Admin</h1>
                    <p className={styles.subtitle}>Create, edit, and activate store products. Data is secured by backend permissions.</p>
                </div>
                <div className={styles.badges}>
                    <span className={styles.badge}>{storePermissionLabel}</span>
                    <span className={styles.badgeMuted}>Currency: SEK</span>
                </div>
            </header>

            <div className={styles.layout}>
                <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div>
                            <p className={styles.kickerSmall}>Catalog</p>
                            <h2>Products</h2>
                        </div>
                        <div className={styles.panelActions}>
                            <input
                                type="search"
                                placeholder="Search name or SKU"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                className={styles.input}
                                aria-label="Search products"
                            />
                            <select className={styles.input} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                                <option value="all">All statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                            <select className={styles.input} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                                <option value="all">All categories</option>
                                {CATEGORY_OPTIONS.map((category) => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                            <select className={styles.input} value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                                {SORT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <button type="button" className={styles.refreshButton} onClick={() => loadProducts({ preferId: selectedId })} disabled={loading}>
                                Refresh
                            </button>
                        </div>
                    </div>

                    {listError && <div className={styles.bannerError}>{listError}</div>}

                    <div className={styles.tableWrapper}>
                        {loading ? (
                            <p className={styles.muted}>Loading products…</p>
                        ) : filteredProducts.length === 0 ? (
                            <p className={styles.muted}>No products match your filters.</p>
                        ) : (
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>SKU</th>
                                        <th>Price</th>
                                        <th>Stock</th>
                                        <th>Status</th>
                                        <th>Updated</th>
                                        <th className={styles.actionsColumn}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProducts.map((product) => {
                                        const isActive = product.active ?? true;
                                        const isSelected = product.id === selectedId;
                                        return (
                                            <tr key={product.id} className={isSelected ? styles.selectedRow : ''}>
                                                <td>
                                                    <div className={styles.primary}>{product.name}</div>
                                                    <div className={styles.meta}>Category: {product.category || '—'}</div>
                                                </td>
                                                <td>{product.sku || '—'}</td>
                                                <td>{formatCurrency(product.price ?? 0, product.currency || 'SEK')}</td>
                                                <td>
                                                    <div className={styles.primary}>{product.stock ?? 0}</div>
                                                    <button
                                                        type="button"
                                                        className={styles.linkButton}
                                                        onClick={() => handleAdjustStock(product)}
                                                        disabled={actioningId === product.id}
                                                    >
                                                        Adjust
                                                    </button>
                                                </td>
                                                <td>
                                                    <span className={`${styles.status} ${isActive ? styles.active : styles.inactive}`}>
                                                        {isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td>{product.updatedAt ? new Date(product.updatedAt).toLocaleString() : '—'}</td>
                                                <td>
                                                    <div className={styles.rowActions}>
                                                        <button type="button" onClick={() => handleEdit(product)} className={styles.linkButton}>
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleActive(product)}
                                                            className={styles.linkButton}
                                                            disabled={actioningId === product.id}
                                                        >
                                                            {isActive ? 'Deactivate' : 'Activate'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.danger}
                                                            onClick={() => setConfirmingDelete(product)}
                                                            disabled={actioningId === product.id}
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
                        )}
                    </div>
                </section>

                <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div>
                            <p className={styles.kickerSmall}>Form</p>
                            <h2>{selectedProduct ? 'Edit product' : 'Create product'}</h2>
                            <p className={styles.muted}>Fill in the details. Validation happens before saving.</p>
                        </div>
                        <div className={styles.panelActions}>
                            <button type="button" className={styles.secondaryButton} onClick={resetForm} disabled={saving}>
                                New product
                            </button>
                        </div>
                    </div>

                    {formError && <div className={styles.bannerError}>{formError}</div>}

                    <form className={styles.form} onSubmit={handleSubmit}>
                        <label className={styles.label} htmlFor="product-name">Name *</label>
                        <input
                            id="product-name"
                            className={styles.input}
                            value={formState.name}
                            onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                            required
                            minLength={2}
                        />

                        <label className={styles.label} htmlFor="product-description">Description</label>
                        <textarea
                            id="product-description"
                            className={styles.textarea}
                            value={formState.description}
                            onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                            rows={3}
                        />

                        <div className={styles.twoCol}>
                            <div>
                                <label className={styles.label} htmlFor="product-price">Price (SEK) *</label>
                                <input
                                    id="product-price"
                                    type="number"
                                    className={styles.input}
                                    value={formState.price}
                                    onChange={(event) => setFormState((prev) => ({ ...prev, price: event.target.value }))}
                                    step="0.01"
                                    min="0"
                                    required
                                />
                            </div>
                            <div>
                                <label className={styles.label} htmlFor="product-stock">Stock *</label>
                                <input
                                    id="product-stock"
                                    type="number"
                                    className={styles.input}
                                    value={formState.stock}
                                    onChange={(event) => setFormState((prev) => ({ ...prev, stock: event.target.value }))}
                                    min="0"
                                    required
                                />
                            </div>
                        </div>

                        <div className={styles.twoCol}>
                            <div>
                                <label className={styles.label} htmlFor="product-sku">SKU</label>
                                <input
                                    id="product-sku"
                                    className={styles.input}
                                    value={formState.sku}
                                    onChange={(event) => setFormState((prev) => ({ ...prev, sku: event.target.value }))}
                                    placeholder="Optional"
                                />
                            </div>
                            <div>
                                <label className={styles.label} htmlFor="product-category">Category</label>
                                <select
                                    id="product-category"
                                    className={styles.input}
                                    value={formState.category}
                                    onChange={(event) => setFormState((prev) => ({ ...prev, category: event.target.value }))}
                                >
                                    {CATEGORY_OPTIONS.map((category) => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <label className={styles.label} htmlFor="product-image">Image URL</label>
                        <input
                            id="product-image"
                            className={styles.input}
                            value={formState.imageUrl}
                            onChange={(event) => setFormState((prev) => ({ ...prev, imageUrl: event.target.value }))}
                            placeholder="https://"
                        />

                        <div className={styles.toggleRow}>
                            <input
                                id="product-active"
                                type="checkbox"
                                checked={formState.active}
                                onChange={(event) => setFormState((prev) => ({ ...prev, active: event.target.checked }))}
                            />
                            <label htmlFor="product-active">Active</label>
                        </div>

                        <div className={styles.formActions}>
                            <button type="submit" className={styles.primaryButton} disabled={saving}>
                                {saving ? 'Saving…' : selectedProduct ? 'Save changes' : 'Create product'}
                            </button>
                            {selectedProduct && (
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => handleToggleActive(selectedProduct)}
                                    disabled={saving || actioningId === selectedId}
                                >
                                    {selectedProduct.active ? 'Deactivate' : 'Activate'}
                                </button>
                            )}
                        </div>
                    </form>
                </section>
            </div>

            {confirmingDelete && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modal} role="dialog" aria-modal="true">
                        <div className={styles.modalHeader}>
                            <div>
                                <p className={styles.kickerSmall}>Delete product</p>
                                <h3>{confirmingDelete.name}</h3>
                                <p className={styles.muted}>This action cannot be undone.</p>
                            </div>
                            <button type="button" className={styles.closeButton} onClick={() => setConfirmingDelete(null)}>
                                ✕
                            </button>
                        </div>
                        <div className={styles.modalActions}>
                            <button type="button" className={styles.secondaryButton} onClick={() => setConfirmingDelete(null)} disabled={saving}>
                                Cancel
                            </button>
                            <button type="button" className={styles.danger} onClick={handleDelete} disabled={saving}>
                                Delete
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
