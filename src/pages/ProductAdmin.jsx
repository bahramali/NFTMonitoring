import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
    listAdminProducts,
    createProduct,
    updateProduct,
    toggleProductActive,
    deleteProduct,
    createProductVariant,
    updateProductVariant,
    deleteProductVariant,
} from '../api/products.js';
import { fetchPermissionDefinitions } from '../api/admins.js';
import { useAuth } from '../context/AuthContext.jsx';
import AccessDenied from '../components/AccessDenied.jsx';
import { getActiveVariants, getVariantLabel, getVariantPrice, getVariantStock, getProductSortPrice } from '../utils/storeVariants.js';
import { PERMISSIONS, findPermissionLabel, hasPerm } from '../utils/permissions.js';
import styles from './ProductAdmin.module.css';

const CATEGORY_OPTIONS = ['Basil', 'Packaging', 'Hydroponic gear'];

const emptyForm = {
    name: '',
    description: '',
    currency: 'SEK',
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
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.permissions)) return payload.data.permissions;
    const groupedPermissions = payload?.permissions || payload?.permissionGroups || payload?.groups;
    if (groupedPermissions && typeof groupedPermissions === 'object' && !Array.isArray(groupedPermissions)) {
        return Object.entries(groupedPermissions).flatMap(([domain, permissions]) =>
            Array.isArray(permissions)
                ? permissions.map((permission) => ({ ...permission, domain }))
                : [],
        );
    }
    return [];
};

const digitToAscii = (char) => {
    const code = char.charCodeAt(0);
    const persianZero = 0x06f0; // Persian zero
    const persianNine = 0x06f9; // Persian nine
    const arabicZero = 0x0660; // Arabic-indic zero
    const arabicNine = 0x0669; // Arabic-indic nine

    if (code >= persianZero && code <= persianNine) return String(code - persianZero);
    if (code >= arabicZero && code <= arabicNine) return String(code - arabicZero);
    return char;
};

const normalizeNumber = (value, fallback = 0) => {
    if (value === '' || value === null || value === undefined) return fallback;

    const normalized = `${value}`
        .trim()
        .split('')
        .map(digitToAscii)
        .join('')
        // Remove grouping separators commonly used in Persian/Arabic numerals.
        .replace(/[\u066c\u060c,\s]/g, '')
        // Normalize Arabic decimal separator.
        .replace(/\u066b/g, '.');

    const numeric = Number(normalized);
    if (Number.isNaN(numeric)) return fallback;
    return numeric;
};

const normalizeVariants = (variants) => {
    if (!variants) return [];
    if (Array.isArray(variants)) return variants;
    if (Array.isArray(variants.items)) return variants.items;
    if (Array.isArray(variants.nodes)) return variants.nodes;
    if (Array.isArray(variants.data)) return variants.data;
    if (typeof variants === 'object') return Object.values(variants);
    return [];
};

export default function ProductAdmin() {
    const { isAuthenticated, token, permissions } = useAuth();
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
    const [confirmingStatus, setConfirmingStatus] = useState(null);
    const [actioningId, setActioningId] = useState(null);
    const [variantRows, setVariantRows] = useState([]);
    const [variantActionId, setVariantActionId] = useState(null);
    const [defaultVariantId, setDefaultVariantId] = useState(null);
    const [variantSnapshot, setVariantSnapshot] = useState('');
    const [editorMode, setEditorMode] = useState('edit');

    const hasAccess = hasPerm({ permissions }, PERMISSIONS.PRODUCTS_MANAGE);

    const storePermissionLabel = useMemo(() => {
        const labels = [
            findPermissionLabel(permissionDefinitions, PERMISSIONS.PRODUCTS_MANAGE),
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
                setEditorMode('edit');
                setSelectedId(matched.id);
                setFormState({ ...emptyForm, ...matched, active: matched.active !== false });
                return;
            }
        }

        setSelectedId(null);
        setFormState({ ...emptyForm });
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
            if (sortBy === 'price_desc') return getProductSortPrice(b) - getProductSortPrice(a);
            if (sortBy === 'price_asc') return getProductSortPrice(a) - getProductSortPrice(b);
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
        setEditorMode('edit');
        setSelectedId(product.id);
        setFormState({ ...emptyForm, ...product, active: product.active !== false });
    }, []);

    const handleToggleActive = useCallback(async (product, confirmed = false) => {
        if (!product?.id || saving) return;
        const nextActive = !(product.active ?? true);
        if (!confirmed && (product.active ?? true)) {
            setConfirmingStatus(product);
            return;
        }
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

    const confirmDeactivate = () => {
        if (!confirmingStatus) return;
        handleToggleActive(confirmingStatus, true);
        setConfirmingStatus(null);
    };

    const validateForm = () => {
        if (!formState.name || formState.name.trim().length < 2) return 'Name must be at least 2 characters.';
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
            currency: formState.currency || 'SEK',
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

    const startCreateProduct = () => {
        setEditorMode('create');
        setSelectedId(null);
        setFormState({ ...emptyForm });
    };

    const productSnapshot = useMemo(() => {
        if (!selectedProduct) return '';
        return JSON.stringify({
            name: selectedProduct.name || '',
            description: selectedProduct.description || '',
            currency: selectedProduct.currency || 'SEK',
            category: selectedProduct.category || CATEGORY_OPTIONS[0],
            imageUrl: selectedProduct.imageUrl || '',
            sku: selectedProduct.sku || '',
            active: selectedProduct.active !== false,
        });
    }, [selectedProduct]);

    const formSignature = useMemo(() => JSON.stringify({
        name: formState.name || '',
        description: formState.description || '',
        currency: formState.currency || 'SEK',
        category: formState.category || CATEGORY_OPTIONS[0],
        imageUrl: formState.imageUrl || '',
        sku: formState.sku || '',
        active: formState.active !== false,
    }), [formState]);

    const isCreateMode = editorMode === 'create';
    const hasUnsavedProductChanges = selectedProduct ? formSignature !== productSnapshot : isCreateMode && Boolean(formState.name?.trim() || formState.description?.trim() || formState.sku?.trim() || formState.imageUrl?.trim());

    useEffect(() => {
        if (!selectedProduct) {
            setVariantRows([]);
            setDefaultVariantId(null);
            setVariantSnapshot('');
            return;
        }
        const variants = normalizeVariants(selectedProduct.variants)
            .map((variant, index) => ({
                ...variant,
                id: variant.id ?? variant.variantId ?? variant._id ?? null,
                weight: variant.weight ?? variant.weightGrams ?? variant.weightInGrams ?? variant.grams ?? '',
                price: getVariantPrice(variant) ?? '',
                stock: getVariantStock(variant) ?? '',
                sku: variant.sku ?? '',
                imageUrl: variant.imageUrl ?? '',
                sortOrder: Number.isFinite(Number(variant.sortOrder)) ? Number(variant.sortOrder) : index,
                active: variant.active !== false && variant.isActive !== false,
                localId: variant.id ?? variant.variantId ?? variant._id ?? globalThis.crypto?.randomUUID?.(),
            }))
            .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
            .map((variant, index) => ({ ...variant, sortOrder: index }));

        const resolvedDefaultId = selectedProduct.defaultVariantId || variants[0]?.id || null;
        setVariantRows(variants);
        setDefaultVariantId(resolvedDefaultId);
        setVariantSnapshot(JSON.stringify({
            defaultVariantId: resolvedDefaultId,
            variants: variants.map((variant) => ({
                id: variant.id,
                localId: variant.localId,
                weight: `${variant.weight ?? ''}`,
                price: `${variant.price ?? ''}`,
                stock: `${variant.stock ?? ''}`,
                sku: variant.sku ?? '',
                imageUrl: variant.imageUrl ?? '',
                active: variant.active !== false,
                sortOrder: Number(variant.sortOrder ?? 0),
            })),
        }));
    }, [selectedProduct]);

    const handleVariantChange = (localId, field, value) => {
        setVariantRows((prev) =>
            prev.map((variant) => ((variant.localId || variant.id) === localId ? { ...variant, [field]: value } : variant)),
        );
    };

    const handleAddVariantRow = () => {
        const localId = globalThis.crypto?.randomUUID?.() || `new-${Date.now()}`;
        setVariantRows((prev) => [
            ...prev,
            {
                id: null,
                weight: '',
                price: '',
                stock: '',
                sku: '',
                imageUrl: '',
                sortOrder: prev.length,
                active: true,
                localId,
            },
        ]);
        setDefaultVariantId((prevDefault) => prevDefault || localId);
    };

    const moveVariant = (localId, direction) => {
        setVariantRows((prev) => {
            const currentIndex = prev.findIndex((variant) => (variant.localId || variant.id) === localId);
            if (currentIndex < 0) return prev;
            const nextIndex = currentIndex + direction;
            if (nextIndex < 0 || nextIndex >= prev.length) return prev;
            const reordered = [...prev];
            const [moved] = reordered.splice(currentIndex, 1);
            reordered.splice(nextIndex, 0, moved);
            return reordered.map((variant, index) => ({ ...variant, sortOrder: index }));
        });
    };

    const buildVariantPayload = (variant) => ({
        weightGrams: normalizeNumber(variant.weight, 0),
        priceSek: normalizeNumber(variant.price, 0),
        stockQuantity: normalizeNumber(variant.stock, 0),
        sku: variant.sku?.trim() || '',
        imageUrl: (variant.imageUrl || '').trim(),
        active: variant.active !== false,
        sortOrder: Number(variant.sortOrder ?? 0),
    });

    const variantValidation = useMemo(() => {
        const errorsByVariant = {};
        const weightMap = new Map();
        let hasBlockingError = false;

        variantRows.forEach((variant) => {
            const key = variant.localId || variant.id;
            const errors = [];
            const weight = normalizeNumber(variant.weight, -1);
            const price = normalizeNumber(variant.price, -1);
            const stock = normalizeNumber(variant.stock, -1);

            if (weight <= 0) {
                errors.push('Weight must be greater than zero.');
            } else {
                const existing = weightMap.get(weight) || [];
                existing.push(key);
                weightMap.set(weight, existing);
            }

            if (price < 0) errors.push('Price cannot be negative.');
            if (stock < 0) errors.push('Stock cannot be negative.');
            if (errors.length > 0) {
                hasBlockingError = true;
                errorsByVariant[key] = errors;
            }
        });

        weightMap.forEach((keys, weight) => {
            if (keys.length <= 1) return;
            hasBlockingError = true;
            keys.forEach((key) => {
                errorsByVariant[key] = [...(errorsByVariant[key] || []), `Duplicate weight: ${weight}g.`];
            });
        });

        if (variantRows.length > 0 && !defaultVariantId) {
            hasBlockingError = true;
        }

        return {
            hasBlockingError,
            errorsByVariant,
            defaultVariantError: variantRows.length > 0 && !defaultVariantId ? 'Please select a default variant.' : '',
        };
    }, [defaultVariantId, variantRows]);

    const variantDraftSignature = useMemo(() => JSON.stringify({
        defaultVariantId,
        variants: variantRows.map((variant) => ({
            id: variant.id,
            localId: variant.localId,
            weight: `${variant.weight ?? ''}`,
            price: `${variant.price ?? ''}`,
            stock: `${variant.stock ?? ''}`,
            sku: variant.sku ?? '',
            imageUrl: variant.imageUrl ?? '',
            active: variant.active !== false,
            sortOrder: Number(variant.sortOrder ?? 0),
        })),
    }), [defaultVariantId, variantRows]);

    const hasUnsavedVariantChanges = variantSnapshot !== '' && variantDraftSignature !== variantSnapshot;

    const saveAllVariants = async () => {
        if (!selectedProduct?.id || saving || variantValidation.hasBlockingError) return;
        setVariantActionId('all');
        try {
            const saveResults = [];
            for (let index = 0; index < variantRows.length; index += 1) {
                const variant = variantRows[index];
                const payload = buildVariantPayload({ ...variant, sortOrder: index });
                if (variant.id) {
                    const updated = await updateProductVariant(selectedProduct.id, variant.id, payload, token);
                    saveResults.push({
                        localId: variant.localId,
                        id: variant.id,
                        saved: { ...variant, ...updated, sortOrder: index },
                    });
                } else {
                    const created = await createProductVariant(selectedProduct.id, payload, token);
                    saveResults.push({
                        localId: variant.localId,
                        id: created?.id || variant.id,
                        saved: { ...variant, ...created, id: created?.id || variant.id, sortOrder: index },
                    });
                }
            }

            const idLookup = new Map();
            saveResults.forEach((item) => {
                if (item.localId) idLookup.set(item.localId, item.id || item.saved?.id);
                if (item.id) idLookup.set(item.id, item.id);
            });
            const resolvedDefaultVariantId = idLookup.get(defaultVariantId) || defaultVariantId;

            await updateProduct(selectedProduct.id, { defaultVariantId: resolvedDefaultVariantId }, token);

            setVariantRows((prev) => {
                const saveMap = new Map(saveResults.map((item) => [item.localId || item.id, item.saved]));
                return prev
                    .map((variant, index) => {
                        const key = variant.localId || variant.id;
                        const savedVariant = saveMap.get(key);
                        return savedVariant
                            ? { ...variant, ...savedVariant, localId: savedVariant.id || variant.localId, sortOrder: index }
                            : { ...variant, sortOrder: index };
                    });
            });
            setDefaultVariantId(resolvedDefaultVariantId);
            setVariantSnapshot(JSON.stringify({
                defaultVariantId: resolvedDefaultVariantId,
                variants: variantRows.map((variant, index) => ({
                    id: saveResults[index]?.id || variant.id,
                    localId: saveResults[index]?.id || variant.localId,
                    weight: `${variant.weight ?? ''}`,
                    price: `${variant.price ?? ''}`,
                    stock: `${variant.stock ?? ''}`,
                    sku: variant.sku ?? '',
                    imageUrl: variant.imageUrl ?? '',
                    active: variant.active !== false,
                    sortOrder: Number(index),
                })),
            }));
            showToast('success', 'Variants saved');
            loadProducts({ preferId: selectedProduct.id });
        } catch (error) {
            console.error('Failed to save variants', error);
            showToast('error', 'Could not save variants.');
        } finally {
            setVariantActionId(null);
        }
    };

    const removeVariantRow = async (index) => {
        if (!selectedProduct?.id) return;
        const variant = variantRows[index];
        if (!variant) return;
        if (!variant.id) {
            setVariantRows((prev) => {
                const remaining = prev
                    .filter((_, rowIndex) => rowIndex !== index)
                    .map((row, rowIndex) => ({ ...row, sortOrder: rowIndex }));

                if (defaultVariantId === (variant.localId || variant.id)) {
                    setDefaultVariantId(remaining[0]?.id || remaining[0]?.localId || null);
                }

                return remaining;
            });
            return;
        }
        setVariantActionId(variant.localId || variant.id);
        try {
            await deleteProductVariant(selectedProduct.id, variant.id, token);
            showToast('success', 'Variant removed');
            if (defaultVariantId === variant.id) {
                setDefaultVariantId((variantRows.find((item) => item.id !== variant.id)?.id) || null);
            }
            loadProducts({ preferId: selectedProduct.id });
        } catch (error) {
            console.error('Failed to delete variant', error);
            showToast('error', 'Could not remove variant.');
        } finally {
            setVariantActionId(null);
        }
    };

    const defaultVariantLabel = useMemo(() => {
        const selectedDefault = variantRows.find((variant) => variant.id === defaultVariantId || variant.localId === defaultVariantId);
        if (!selectedDefault) return '—';
        return `${normalizeNumber(selectedDefault.weight, 0)}g`;
    }, [defaultVariantId, variantRows]);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!hasAccess) {
        return (
            <AccessDenied
                message={`You need ${storePermissionLabel} permissions to manage products.`}
                actionHref="/monitoring/overview"
                actionLabel="Back to monitoring"
                secondaryActionHref="/login"
            />
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Store / Admin</p>
                    <h1 className={styles.title}>Product Admin</h1>
                    <p className={styles.subtitle}>Create, edit, and activate store products. Data is secured by backend permissions.</p>
                </div>
                <div className={styles.badges}>
                    <span className={styles.badge}>{storePermissionLabel}</span>
                    <span className={styles.badgeMuted}>Currency: SEK</span>
                </div>
            </header>

            <div className={styles.layout}>
                <section className={`${styles.panel} ${styles.catalogPanel}`}>
                    <div className={styles.panelHeader}>
                        <div>
                            <p className={styles.kickerSmall}>Catalog</p>
                            <h2>Products</h2>
                            <p className={styles.muted}>Select a product to edit</p>
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

                    <div className={styles.catalogListWrapper}>
                        {loading ? (
                            <p className={styles.muted}>Loading products…</p>
                        ) : filteredProducts.length === 0 ? (
                            <p className={styles.muted}>No products match your filters.</p>
                        ) : (
                            <div className={styles.catalogList}>
                                {filteredProducts.map((product) => {
                                    const isActive = product.active ?? true;
                                    const isSelected = product.id === selectedId;
                                    const activeVariants = getActiveVariants(product);
                                    const variantLabels = activeVariants.map(getVariantLabel).filter(Boolean);
                                    return (
                                        <article key={product.id} className={`${styles.productCard} ${isSelected ? styles.selectedProductCard : ''}`}>
                                            <button type="button" className={styles.productMain} onClick={() => handleEdit(product)}>
                                                <div className={styles.primary}>{product.name}</div>
                                                <div className={styles.meta}>SKU: {product.sku || '—'}</div>
                                                <div>
                                                    <span className={`${styles.status} ${isActive ? styles.active : styles.inactive}`}>
                                                        {isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                                <div className={styles.meta}>Updated: {product.updatedAt ? new Date(product.updatedAt).toLocaleString() : '—'}</div>
                                                {variantLabels.length > 0 && (
                                                    <div className={styles.meta}>Variants: {variantLabels.join(', ')}</div>
                                                )}
                                                {activeVariants.length === 0 && (
                                                    <span className={styles.warningBadge}>No variants — not sellable</span>
                                                )}
                                            </button>
                                            <div className={styles.productActions}>
                                                <button type="button" onClick={() => handleEdit(product)} className={styles.cardPrimaryAction}>
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleActive(product)}
                                                    className={styles.cardSecondaryAction}
                                                    disabled={actioningId === product.id}
                                                >
                                                    {isActive ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.cardDangerAction}
                                                    onClick={() => setConfirmingDelete(product)}
                                                    disabled={actioningId === product.id}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                <section className={`${styles.panel} ${styles.detailsPanel}`}>
                    <div className={styles.panelHeader}>
                        <div>
                            <p className={styles.kickerSmall}>Product details</p>
                            <h2>{selectedProduct && !isCreateMode ? `Edit product — ${selectedProduct.name || 'Untitled'}` : isCreateMode ? 'Create new product' : 'Select a product to edit'}</h2>
                            <p className={styles.muted}>{selectedProduct && !isCreateMode ? 'Update core product information.' : isCreateMode ? 'Start by entering basic product information.' : 'Choose a product from the catalog or start a new one.'}</p>
                        </div>
                        <div className={styles.panelActions}>
                            {!isCreateMode && <span className={styles.muted}>Select a product to edit</span>}
                            {hasUnsavedProductChanges && <span className={styles.warningBadge}>Unsaved changes</span>}
                            <button type="button" className={styles.secondaryButton} onClick={startCreateProduct} disabled={saving}>
                                New product
                            </button>
                        </div>
                    </div>

                    {formError && <div className={styles.bannerError}>{formError}</div>}

                    <form className={styles.form} onSubmit={handleSubmit}>
                        <div className={styles.formCard}>
                            <h3 className={styles.sectionTitle}>Basic info</h3>
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
                        </div>

                        <div className={styles.formCard}>
                            <h3 className={styles.sectionTitle}>Classification</h3>
                            <label className={styles.label} htmlFor="product-sku">SKU</label>
                            <input
                                id="product-sku"
                                className={styles.input}
                                value={formState.sku}
                                onChange={(event) => setFormState((prev) => ({ ...prev, sku: event.target.value }))}
                                placeholder="Optional"
                            />

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
                            <div className={styles.toggleRow}>
                                <input
                                    id="product-active"
                                    type="checkbox"
                                    checked={formState.active}
                                    onChange={(event) => setFormState((prev) => ({ ...prev, active: event.target.checked }))}
                                />
                                <label htmlFor="product-active">Active</label>
                            </div>
                        </div>

                        <div className={styles.formCard}>
                            <h3 className={styles.sectionTitle}>Media</h3>
                            <label className={styles.label} htmlFor="product-image">Image URL</label>
                            <input
                                id="product-image"
                                className={styles.input}
                                value={formState.imageUrl}
                                onChange={(event) => setFormState((prev) => ({ ...prev, imageUrl: event.target.value }))}
                                placeholder="https://"
                            />
                        </div>

                        <div className={styles.formActions}>
                            <button type="submit" className={styles.primaryButton} disabled={saving}>
                                {saving ? 'Saving…' : 'Save product'}
                            </button>
                            {selectedProduct && !isCreateMode && (
                                <button
                                    type="button"
                                    className={styles.linkButton}
                                    onClick={() => handleToggleActive(selectedProduct)}
                                    disabled={saving || actioningId === selectedId}
                                >
                                    {selectedProduct.active ? 'Deactivate' : 'Activate'}
                                </button>
                            )}
                        </div>
                    </form>
                </section>

                <section className={`${styles.panel} ${styles.variantsPanel}`}>
                    <div className={styles.variantsSection}>
                        <div className={styles.variantsHeader}>
                            <div>
                                <p className={styles.kickerSmall}>Variants (weights)</p>
                                <h3 className={styles.sectionTitle}>Variants</h3>
                                <p className={styles.muted}>Default: {defaultVariantLabel} · {variantRows.length} variants</p>
                                <p className={styles.muted}>Manage price and stock per weight. Variants require a saved product.</p>
                            </div>
                            <div className={styles.variantHeaderActions}>
                                {hasUnsavedVariantChanges && <span className={styles.warningBadge}>Unsaved changes</span>}
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={handleAddVariantRow}
                                    disabled={!selectedProduct || saving}
                                >
                                    + Add variant
                                </button>
                                <button
                                    type="button"
                                    className={styles.primaryButton}
                                    onClick={saveAllVariants}
                                    disabled={!selectedProduct || saving || variantActionId === 'all' || !hasUnsavedVariantChanges || variantValidation.hasBlockingError}
                                >
                                    {variantActionId === 'all' ? 'Saving…' : 'Save variants'}
                                </button>
                            </div>
                        </div>

                        {variantValidation.defaultVariantError && <div className={styles.bannerError}>{variantValidation.defaultVariantError}</div>}

                        {!selectedProduct ? (
                            <div className={styles.variantEmpty}>Create the product first to add weight variants.</div>
                        ) : variantRows.length === 0 ? (
                            <div className={styles.variantEmpty}>No variants yet. Add weights like 50g, 70g, 100g.</div>
                        ) : (
                            <div className={styles.variantList}>
                                {variantRows.map((variant, index) => {
                                    const variantKey = variant.id || variant.localId;
                                    const errors = variantValidation.errorsByVariant[variant.localId || variant.id] || [];
                                    return (
                                    <div key={variant.id || variant.localId} className={styles.variantRow}>
                                        <div className={styles.variantRowHeader}>
                                            <strong>{normalizeNumber(variant.weight, 0)}g</strong>
                                            <span className={styles.meta}>Price: {normalizeNumber(variant.price, 0)} | Stock: {normalizeNumber(variant.stock, 0)} | {variant.active ? 'Active' : 'Inactive'}</span>
                                        </div>
                                        <div className={styles.variantOrderControls}>
                                            <button type="button" className={styles.secondaryButton} onClick={() => moveVariant(variantKey, -1)} disabled={index === 0}>↑</button>
                                            <button type="button" className={styles.secondaryButton} onClick={() => moveVariant(variantKey, 1)} disabled={index === variantRows.length - 1}>↓</button>
                                        </div>
                                        <div className={styles.variantToggle}>
                                            <input
                                                id={`variant-default-${variant.localId}`}
                                                type="radio"
                                                name="defaultVariant"
                                                checked={defaultVariantId === variant.id || defaultVariantId === variant.localId}
                                                onChange={() => setDefaultVariantId(variant.id || variant.localId)}
                                            />
                                            <label htmlFor={`variant-default-${variant.localId}`}>Default</label>
                                        </div>
                                        <div className={styles.variantField}>
                                            <label className={styles.variantLabel} htmlFor={`variant-weight-${variant.localId}`}>Weight (grams)</label>
                                            <input
                                                id={`variant-weight-${variant.localId}`}
                                                type="number"
                                                className={`${styles.input} ${styles.variantInput}`}
                                                value={variant.weight}
                                                onChange={(event) => handleVariantChange(variantKey, 'weight', event.target.value)}
                                                min="0"
                                            />
                                        </div>
                                        <div className={styles.variantField}>
                                            <label className={styles.variantLabel} htmlFor={`variant-price-${variant.localId}`}>Price (SEK)</label>
                                            <input
                                                id={`variant-price-${variant.localId}`}
                                                type="number"
                                                className={`${styles.input} ${styles.variantInput}`}
                                                value={variant.price}
                                                onChange={(event) => handleVariantChange(variantKey, 'price', event.target.value)}
                                                step="0.01"
                                                min="0"
                                            />
                                        </div>
                                        <div className={styles.variantField}>
                                            <label className={styles.variantLabel} htmlFor={`variant-stock-${variant.localId}`}>Stock</label>
                                            <input
                                                id={`variant-stock-${variant.localId}`}
                                                type="number"
                                                className={`${styles.input} ${styles.variantInput}`}
                                                value={variant.stock}
                                                onChange={(event) => handleVariantChange(variantKey, 'stock', event.target.value)}
                                                min="0"
                                            />
                                        </div>
                                        <div className={styles.variantField}>
                                            <label className={styles.variantLabel} htmlFor={`variant-sku-${variant.localId}`}>SKU (optional)</label>
                                            <input
                                                id={`variant-sku-${variant.localId}`}
                                                className={`${styles.input} ${styles.variantInput}`}
                                                value={variant.sku}
                                                onChange={(event) => handleVariantChange(variantKey, 'sku', event.target.value)}
                                                placeholder="Optional"
                                            />
                                        </div>
                                        <div className={styles.variantField}>
                                            <details className={styles.variantDetails}>
                                                <summary className={styles.variantSummary}>Image URL (optional)</summary>
                                                <label className={styles.variantLabel} htmlFor={`variant-image-${variant.localId}`}>Image URL (optional)</label>
                                                <input
                                                    id={`variant-image-${variant.localId}`}
                                                    className={`${styles.input} ${styles.variantInput}`}
                                                    value={variant.imageUrl}
                                                    onChange={(event) => handleVariantChange(variantKey, 'imageUrl', event.target.value)}
                                                    placeholder="https://..."
                                                />
                                            </details>
                                        </div>
                                        <div className={styles.variantToggle}>
                                            <input
                                                id={`variant-active-${variant.localId}`}
                                                type="checkbox"
                                                checked={variant.active}
                                                onChange={(event) => handleVariantChange(variantKey, 'active', event.target.checked)}
                                            />
                                            <label htmlFor={`variant-active-${variant.localId}`}>Active</label>
                                        </div>
                                        <div className={styles.variantActions}>
                                            <button
                                                type="button"
                                                className={styles.danger}
                                                onClick={() => removeVariantRow(index)}
                                                disabled={variantActionId === (variant.localId || variant.id)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        {errors.length > 0 && <div className={styles.variantErrors}>{errors.join(' ')}</div>}
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {confirmingStatus && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modal} role="dialog" aria-modal="true">
                        <div className={styles.modalHeader}>
                            <div>
                                <p className={styles.kickerSmall}>Deactivate product</p>
                                <h3>{confirmingStatus.name}</h3>
                                <p className={styles.muted}>This removes the product from the storefront until reactivated.</p>
                            </div>
                            <button type="button" className={styles.closeButton} onClick={() => setConfirmingStatus(null)}>
                                ✕
                            </button>
                        </div>
                        <div className={styles.dangerZone}>
                            <span className={styles.dangerZoneLabel}>Danger zone</span>
                            <p className={styles.muted}>Confirm you want to deactivate this product.</p>
                        </div>
                        <div className={styles.modalActions}>
                            <button type="button" className={styles.secondaryButton} onClick={() => setConfirmingStatus(null)} disabled={saving}>
                                Cancel
                            </button>
                            <button type="button" className={styles.danger} onClick={confirmDeactivate} disabled={saving}>
                                Deactivate
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                        <div className={styles.dangerZone}>
                            <span className={styles.dangerZoneLabel}>Danger zone</span>
                            <p className={styles.muted}>Deleting products cannot be undone.</p>
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
