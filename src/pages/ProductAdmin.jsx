import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
    createProduct,
    createProductVariant,
    deleteProduct,
    deleteProductVariant,
    listAdminProducts,
    toggleProductActive,
    updateProduct,
    updateProductVariant,
    updateVariantTierPrices,
} from '../api/products.js';
import AccessDenied from '../components/AccessDenied.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { PERMISSIONS, hasPerm } from '../utils/permissions.js';
import { getVariantPrice, getVariantStock, getProductSortPrice, getVariantLabel } from '../utils/storeVariants.js';
import styles from './ProductAdmin.module.css';

const CATEGORY_OPTIONS = ['Basil', 'Packaging', 'Hydroponic gear'];
const SORT_OPTIONS = [
    { value: 'updated_desc', label: 'Updated (newest)' },
    { value: 'price_desc', label: 'Price (high to low)' },
    { value: 'price_asc', label: 'Price (low to high)' },
];
const emptyForm = { name: '', description: '', currency: 'SEK', category: CATEGORY_OPTIONS[0], imageUrl: '', sku: '', active: true };
const emptyVariant = () => ({ id: null, localId: globalThis.crypto?.randomUUID?.() || `new-${Date.now()}`, weight: '', price: '', stock: '', sku: '', active: true, tierPrices: {} });

const normalizeProducts = (payload) => (Array.isArray(payload) ? payload : payload?.products || []);
const normalizeVariants = (variants) => (Array.isArray(variants) ? variants : variants?.items || variants?.nodes || variants?.data || []);

export default function ProductAdmin() {
    const { isAuthenticated, token, permissions } = useAuth();
    const navigate = useNavigate();
    const { productId } = useParams();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [listError, setListError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [sortBy, setSortBy] = useState('updated_desc');

    const [activeTab, setActiveTab] = useState('overview');
    const [formState, setFormState] = useState(emptyForm);
    const [formSnapshot, setFormSnapshot] = useState('');
    const [variantRows, setVariantRows] = useState([]);
    const [variantSnapshot, setVariantSnapshot] = useState('');
    const [defaultVariantId, setDefaultVariantId] = useState(null);
    const [variantEditorId, setVariantEditorId] = useState(null);

    const hasAccess = hasPerm({ permissions }, PERMISSIONS.PRODUCTS_MANAGE);
    const createMode = productId === 'new';

    const loadProducts = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setListError('');
        try {
            const payload = await listAdminProducts(token);
            setProducts(normalizeProducts(payload));
        } catch (error) {
            console.error(error);
            setListError('Unable to load products right now.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { loadProducts(); }, [loadProducts]);

    const selectedProduct = useMemo(() => products.find((product) => product.id === productId) || null, [productId, products]);

    useEffect(() => {
        if (createMode) {
            setFormState(emptyForm);
            setVariantRows([]);
            setDefaultVariantId(null);
            setFormSnapshot(JSON.stringify(emptyForm));
            setVariantSnapshot(JSON.stringify({ defaultVariantId: null, variants: [] }));
            return;
        }
        if (!selectedProduct) return;
        const nextForm = { ...emptyForm, ...selectedProduct, active: selectedProduct.active !== false };
        const nextVariants = normalizeVariants(selectedProduct.variants).map((variant) => ({
            ...emptyVariant(),
            ...variant,
            localId: variant.id || globalThis.crypto?.randomUUID?.(),
            weight: variant.weight ?? '',
            price: getVariantPrice(variant) ?? '',
            stock: getVariantStock(variant) ?? '',
            tierPrices: variant.priceByTier || variant.tierPrices || {},
            active: variant.active !== false,
        }));
        const nextDefault = selectedProduct.defaultVariantId || nextVariants[0]?.id || nextVariants[0]?.localId || null;
        setFormState(nextForm);
        setVariantRows(nextVariants);
        setDefaultVariantId(nextDefault);
        setFormSnapshot(JSON.stringify(nextForm));
        setVariantSnapshot(JSON.stringify({ defaultVariantId: nextDefault, variants: nextVariants }));
    }, [createMode, selectedProduct]);

    const filteredProducts = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return [...products]
            .filter((product) => {
                if (query && ![product.name, product.sku].some((v) => `${v || ''}`.toLowerCase().includes(query))) return false;
                if (statusFilter !== 'all' && (product.active ?? true) !== (statusFilter === 'active')) return false;
                if (categoryFilter !== 'all' && product.category !== categoryFilter) return false;
                return true;
            })
            .sort((a, b) => {
                if (sortBy === 'price_desc') return getProductSortPrice(b) - getProductSortPrice(a);
                if (sortBy === 'price_asc') return getProductSortPrice(a) - getProductSortPrice(b);
                return new Date(b.updatedAt || b.updated || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.updated || a.createdAt || 0).getTime();
            });
    }, [categoryFilter, products, searchTerm, sortBy, statusFilter]);

    const formDirty = JSON.stringify(formState) !== formSnapshot;
    const variantsDirty = JSON.stringify({ defaultVariantId, variants: variantRows }) !== variantSnapshot;
    const hasChanges = formDirty || variantsDirty;

    const detailId = createMode ? null : selectedProduct?.id;

    const saveAll = async () => {
        if (saving) return;
        setSaving(true);
        try {
            let id = detailId;
            if (formDirty) {
                const payload = {
                    name: formState.name.trim(),
                    description: formState.description?.trim() || '',
                    currency: formState.currency || 'SEK',
                    category: formState.category,
                    imageUrl: formState.imageUrl?.trim() || '',
                    sku: formState.sku?.trim() || '',
                    active: formState.active !== false,
                };
                const product = id ? await updateProduct(id, payload, token) : await createProduct(payload, token);
                id = product?.id || id;
            }

            if (id && variantsDirty) {
                for (const [index, row] of variantRows.entries()) {
                    const payload = {
                        weightGrams: Number(row.weight || 0),
                        priceSek: Number(row.price || 0),
                        stockQuantity: Number(row.stock || 0),
                        sku: row.sku || '',
                        active: row.active !== false,
                        sortOrder: index,
                    };
                    const saved = row.id ? await updateProductVariant(id, row.id, payload, token) : await createProductVariant(id, payload, token);
                    const savedId = saved?.id || row.id;
                    if (savedId) {
                        await updateVariantTierPrices(savedId, {
                            DEFAULT: Math.round(Number(row.price || 0) * 100),
                            VIP: Math.round(Number(row.tierPrices?.VIP || 0) * 100),
                            SUPPORTER: Math.round(Number(row.tierPrices?.SUPPORTER || 0) * 100),
                            B2B: Math.round(Number(row.tierPrices?.B2B || 0) * 100),
                        }, token);
                    }
                    row.id = savedId;
                }
                await updateProduct(id, { defaultVariantId: defaultVariantId || variantRows[0]?.id || null }, token);
            }
            await loadProducts();
            if (!detailId && id) navigate(`/store/admin/products/${id}`, { replace: true });
        } finally {
            setSaving(false);
        }
    };

    const discardChanges = () => {
        if (createMode) {
            setFormState(emptyForm);
            setVariantRows([]);
            setDefaultVariantId(null);
            return;
        }
        if (!selectedProduct) return;
        const nextForm = { ...emptyForm, ...selectedProduct, active: selectedProduct.active !== false };
        setFormState(nextForm);
        const nextVariants = normalizeVariants(selectedProduct.variants).map((variant) => ({ ...emptyVariant(), ...variant, localId: variant.id || globalThis.crypto?.randomUUID?.() }));
        setVariantRows(nextVariants);
        setDefaultVariantId(selectedProduct.defaultVariantId || nextVariants[0]?.id || null);
    };

    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!hasAccess) return <AccessDenied title="Product access required" message="You need products permission to access this page." />;

    const activeEditorVariant = variantRows.find((row) => (row.id || row.localId) === variantEditorId);

    return (
        <div className={styles.page}>
            {!productId ? (
                <>
                    <div className={styles.listHeader}><h1>Products</h1><button className={styles.primaryButton} onClick={() => navigate('/store/admin/products/new')}>New product</button></div>
                    <div className={styles.filters}><input className={styles.input} placeholder="Search name or SKU" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><select className={styles.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All status</option><option value="active">Active</option><option value="inactive">Inactive</option></select><select className={styles.input} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">All categories</option>{CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select><select className={styles.input} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>{SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                    {listError && <p className={styles.error}>{listError}</p>}
                    <table className={styles.table}><thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Status</th><th>Updated</th><th>Variants</th><th>Actions</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id} onClick={() => navigate(`/store/admin/products/${product.id}`)}><td>{product.name}</td><td>{product.sku || '—'}</td><td>{product.category || '—'}</td><td><span className={product.active === false ? styles.badgeOff : styles.badgeOn}>{product.active === false ? 'Inactive' : 'Active'}</span></td><td>{new Date(product.updatedAt || product.updated || product.createdAt || Date.now()).toLocaleDateString()}</td><td>{normalizeVariants(product.variants).length}</td><td><button type="button" className={styles.linkButton} onClick={(e) => { e.stopPropagation(); navigate(`/store/admin/products/${product.id}`); }}>Edit</button><button type="button" className={styles.linkButton} onClick={async (e) => { e.stopPropagation(); await toggleProductActive(product.id, !(product.active ?? true), token); loadProducts(); }}>{product.active === false ? 'Activate' : 'Deactivate'}</button><button type="button" className={styles.dangerLink} onClick={async (e) => { e.stopPropagation(); if (window.confirm(`Delete ${product.name}?`)) { await deleteProduct(product.id, token); loadProducts(); } }}>Delete</button></td></tr>)}</tbody></table>
                    {loading && <p>Loading…</p>}
                </>
            ) : (
                <>
                    <div className={styles.detailHeader}><button className={styles.linkButton} onClick={() => navigate('/store/admin/products')}>← Products</button><h1>{createMode ? 'New product' : (selectedProduct?.name || 'Product')}</h1><span className={formState.active === false ? styles.badgeOff : styles.badgeOn}>{formState.active === false ? 'Inactive' : 'Active'}</span><div className={styles.headerActions}><button className={styles.secondaryButton} onClick={() => setFormState((prev) => ({ ...prev, active: !prev.active }))}>{formState.active ? 'Deactivate' : 'Activate'}</button>{detailId && <button className={styles.dangerLink} onClick={async () => { if (window.confirm('Delete this product?')) { await deleteProduct(detailId, token); navigate('/store/admin/products'); } }}>Delete</button>}</div></div>
                    <div className={styles.tabs}><button className={activeTab === 'overview' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('overview')}>Overview</button><button className={activeTab === 'details' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('details')}>Product details</button><button className={activeTab === 'variants' ? styles.activeTab : styles.tab} disabled={!detailId} onClick={() => setActiveTab('variants')}>Variants & pricing</button></div>
                    {activeTab === 'overview' && <div className={styles.cards}><article className={styles.card}><h3>Default price</h3><p>{variantRows[0]?.price || 0} SEK</p></article><article className={styles.card}><h3>Total stock</h3><p>{variantRows.reduce((sum, row) => sum + Number(row.stock || 0), 0)}</p></article><article className={styles.card}><h3>Variants</h3><p>{variantRows.length}</p></article></div>}
                    {activeTab === 'details' && <div className={styles.formGrid}><label>Name<input className={styles.input} value={formState.name} onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))} /></label><label>SKU<input className={styles.input} value={formState.sku} onChange={(e) => setFormState((p) => ({ ...p, sku: e.target.value }))} /></label><label>Category<select className={styles.input} value={formState.category} onChange={(e) => setFormState((p) => ({ ...p, category: e.target.value }))}>{CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label><label>Description<textarea className={styles.input} rows={4} value={formState.description} onChange={(e) => setFormState((p) => ({ ...p, description: e.target.value }))} /></label></div>}
                    {activeTab === 'variants' && (detailId ? <><div className={styles.variantToolbar}><button className={styles.secondaryButton} onClick={() => setVariantRows((prev) => [...prev, emptyVariant()])}>Add variant</button></div><table className={styles.table}><thead><tr><th>Default</th><th>Weight</th><th>Price (SEK)</th><th>VIP</th><th>Supporter</th><th>B2B</th><th>Stock</th><th>Active</th><th>Actions</th></tr></thead><tbody>{variantRows.map((variant) => { const key = variant.id || variant.localId; return <tr key={key}><td><input type="radio" name="default" checked={defaultVariantId === key || defaultVariantId === variant.id} onChange={() => setDefaultVariantId(key)} /></td><td>{getVariantLabel(variant)}</td><td>{variant.price || 0}</td><td>{variant.tierPrices?.VIP || 0}</td><td>{variant.tierPrices?.SUPPORTER || 0}</td><td>{variant.tierPrices?.B2B || 0}</td><td>{variant.stock || 0}</td><td>{variant.active === false ? 'No' : 'Yes'}</td><td><button className={styles.linkButton} onClick={() => setVariantEditorId(key)}>Edit</button><button className={styles.dangerLink} onClick={async () => { if (variant.id) await deleteProductVariant(detailId, variant.id, token); setVariantRows((prev) => prev.filter((row) => (row.id || row.localId) !== key)); }}>Delete</button></td></tr>; })}</tbody></table></> : <p className={styles.notice}>Variants require saved product. Save product details first.</p>)}
                </>
            )}

            {activeEditorVariant && <div className={styles.drawerBackdrop} onClick={() => setVariantEditorId(null)}><aside className={styles.drawer} onClick={(e) => e.stopPropagation()}><h3>Edit variant</h3><label>Weight<input className={styles.input} type="number" value={activeEditorVariant.weight} onChange={(e) => setVariantRows((prev) => prev.map((row) => (row.id || row.localId) === variantEditorId ? { ...row, weight: e.target.value } : row))} /></label><label>Price<input className={styles.input} type="number" value={activeEditorVariant.price} onChange={(e) => setVariantRows((prev) => prev.map((row) => (row.id || row.localId) === variantEditorId ? { ...row, price: e.target.value } : row))} /></label><label>VIP<input className={styles.input} type="number" value={activeEditorVariant.tierPrices?.VIP || ''} onChange={(e) => setVariantRows((prev) => prev.map((row) => (row.id || row.localId) === variantEditorId ? { ...row, tierPrices: { ...(row.tierPrices || {}), VIP: e.target.value } } : row))} /></label><label>Supporter<input className={styles.input} type="number" value={activeEditorVariant.tierPrices?.SUPPORTER || ''} onChange={(e) => setVariantRows((prev) => prev.map((row) => (row.id || row.localId) === variantEditorId ? { ...row, tierPrices: { ...(row.tierPrices || {}), SUPPORTER: e.target.value } } : row))} /></label><label>B2B<input className={styles.input} type="number" value={activeEditorVariant.tierPrices?.B2B || ''} onChange={(e) => setVariantRows((prev) => prev.map((row) => (row.id || row.localId) === variantEditorId ? { ...row, tierPrices: { ...(row.tierPrices || {}), B2B: e.target.value } } : row))} /></label><label>Stock<input className={styles.input} type="number" value={activeEditorVariant.stock} onChange={(e) => setVariantRows((prev) => prev.map((row) => (row.id || row.localId) === variantEditorId ? { ...row, stock: e.target.value } : row))} /></label><label>SKU<input className={styles.input} value={activeEditorVariant.sku || ''} onChange={(e) => setVariantRows((prev) => prev.map((row) => (row.id || row.localId) === variantEditorId ? { ...row, sku: e.target.value } : row))} /></label><label><input type="checkbox" checked={activeEditorVariant.active !== false} onChange={(e) => setVariantRows((prev) => prev.map((row) => (row.id || row.localId) === variantEditorId ? { ...row, active: e.target.checked } : row))} /> Active</label><div className={styles.drawerActions}><button className={styles.secondaryButton} onClick={() => setVariantEditorId(null)}>Cancel</button><button className={styles.primaryButton} onClick={() => setVariantEditorId(null)}>Save</button></div></aside></div>}

            {hasChanges && <div className={styles.stickySaveBar}><span>Unsaved changes</span><div><button className={styles.secondaryButton} onClick={discardChanges}>Discard</button><button className={styles.primaryButton} onClick={saveAll} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></div>}
        </div>
    );
}
