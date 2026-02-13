import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
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
} from "../api/products.js";
import AccessDenied from "../components/AccessDenied.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS, hasPerm } from "../utils/permissions.js";
import {
  getVariantStock,
  getProductSortPrice,
  getVariantLabel,
} from "../utils/storeVariants.js";
import { resolveTierPrice } from "../utils/pricingTier.js";
import styles from "./ProductAdmin.module.css";

const CATEGORY_OPTIONS = ["Basil", "Packaging", "Hydroponic gear"];
const SORT_OPTIONS = [
  { value: "updated_desc", label: "Updated (newest)" },
  { value: "price_desc", label: "Price (high to low)" },
  { value: "price_asc", label: "Price (low to high)" },
];
const emptyForm = {
  name: "",
  description: "",
  currency: "SEK",
  category: CATEGORY_OPTIONS[0],
  imageUrl: "",
  sku: "",
  active: true,
};
const emptyVariant = () => ({
  id: null,
  localId: globalThis.crypto?.randomUUID?.() || `new-${Date.now()}`,
  weight: "",
  price: "",
  stock: "",
  sku: "",
  imageUrl: "",
  active: true,
  tierPrices: {},
});

const normalizeProducts = (payload) =>
  Array.isArray(payload) ? payload : payload?.products || [];
const normalizeVariants = (variants) =>
  Array.isArray(variants)
    ? variants
    : variants?.items || variants?.nodes || variants?.data || [];
const normalizeUrl = (value) => {
  const normalized = (value ?? "").trim();
  return normalized.length ? normalized : null;
};
const resolveEditorPrice = (variant) =>
  Number(variant?.priceSek ?? variant?.price ?? variant?.unitPrice ?? 0);
const normalizeTierPricesForEditor = (variant) => {
  const tiers = ["VIP", "SUPPORTER", "B2B"];
  return tiers.reduce((acc, tier) => {
    const value = resolveTierPrice(variant, tier);
    if (value !== null && value !== undefined) {
      acc[tier] = value;
    }
    return acc;
  }, {});
};

const DECIMAL_INPUT_PATTERN = /^\d*(?:[.,]\d*)?$/;
const INTEGER_INPUT_PATTERN = /^\d*$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const hasRealUuidId = (id) => UUID_PATTERN.test(`${id ?? ""}`.trim());

export const hasDuplicateVariantWeight = (rows = []) => {
  const seenWeights = new Set();

  for (const row of rows) {
    const rowKey = row?.id || row?.localId;
    if (!rowKey) continue;

    const weight = parseIntegerInput(row?.weight ?? row?.weightGrams);
    if (!Number.isFinite(weight)) continue;

    if (seenWeights.has(weight)) {
      return true;
    }
    seenWeights.add(weight);
  }

  return false;
};

const parseDecimalInput = (value) => {
  if (value === "" || value === null || value === undefined) return 0;
  return Number.parseFloat(`${value}`.replace(",", "."));
};

const parseIntegerInput = (value) => {
  if (value === "" || value === null || value === undefined) return 0;
  return Number.parseInt(`${value}`, 10);
};

const validateDraftVariant = (draft) => {
  const errors = {};

  if (!INTEGER_INPUT_PATTERN.test(`${draft.weight ?? ""}`)) {
    errors.weight = "Weight must be a whole number.";
  }
  if (!INTEGER_INPUT_PATTERN.test(`${draft.stock ?? ""}`)) {
    errors.stock = "Stock must be a whole number.";
  }

  if (!DECIMAL_INPUT_PATTERN.test(`${draft.price ?? ""}`)) {
    errors.price = "Use numbers like 29.90 or 29,9.";
  }

  ["VIP", "SUPPORTER", "B2B"].forEach((tier) => {
    const tierValue = `${draft.tierPrices?.[tier] ?? ""}`;
    if (tierValue && !DECIMAL_INPUT_PATTERN.test(tierValue)) {
      errors[tier] = "Use numbers like 29.90 or 29,9.";
    }
  });

  const weightNumber = parseIntegerInput(draft.weight);
  if (Number.isNaN(weightNumber) || weightNumber < 0) {
    errors.weight = "Weight must be 0 or greater.";
  }

  const stockNumber = parseIntegerInput(draft.stock);
  if (Number.isNaN(stockNumber) || stockNumber < 0) {
    errors.stock = "Stock must be 0 or greater.";
  }

  const priceNumber = parseDecimalInput(draft.price);
  if (Number.isNaN(priceNumber) || priceNumber < 0) {
    errors.price = "Price must be 0 or greater.";
  }

  ["VIP", "SUPPORTER", "B2B"].forEach((tier) => {
    const price = parseDecimalInput(draft.tierPrices?.[tier]);
    if (Number.isNaN(price) || price < 0) {
      errors[tier] = "Price must be 0 or greater.";
    }
  });

  return errors;
};

export default function ProductAdmin() {
  const { isAuthenticated, token, permissions } = useAuth();
  const navigate = useNavigate();
  const { productId } = useParams();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated_desc");

  const [activeTab, setActiveTab] = useState("overview");
  const [formState, setFormState] = useState(emptyForm);
  const [formSnapshot, setFormSnapshot] = useState("");
  const [variantRows, setVariantRows] = useState([]);
  const [variantSnapshot, setVariantSnapshot] = useState("");
  const [defaultVariantId, setDefaultVariantId] = useState(null);
  const [editingVariantIds, setEditingVariantIds] = useState({});
  const [draftVariantsById, setDraftVariantsById] = useState({});
  const [variantValidationById, setVariantValidationById] = useState({});

  const hasAccess = hasPerm({ permissions }, PERMISSIONS.PRODUCTS_MANAGE);
  const createMode = productId === "new";

  const loadProducts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setListError("");
    try {
      const payload = await listAdminProducts(token);
      setProducts(normalizeProducts(payload));
    } catch (error) {
      console.error(error);
      setListError("Unable to load products right now.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) || null,
    [productId, products],
  );

  useEffect(() => {
    if (createMode) {
      setFormState(emptyForm);
      setVariantRows([]);
      setDefaultVariantId(null);
      setFormSnapshot(JSON.stringify(emptyForm));
      setVariantSnapshot(
        JSON.stringify({ defaultVariantId: null, variants: [] }),
      );
      return;
    }
    if (!selectedProduct) return;
    const nextForm = {
      ...emptyForm,
      ...selectedProduct,
      active: selectedProduct.active !== false,
    };
    const nextVariants = normalizeVariants(selectedProduct.variants).map(
      (variant) => ({
        ...emptyVariant(),
        ...variant,
        localId: variant.id || globalThis.crypto?.randomUUID?.(),
        weight: variant.weight ?? variant.weightGrams ?? "",
        price: resolveEditorPrice(variant),
        stock: getVariantStock(variant) ?? "",
        imageUrl: variant.imageUrl ?? "",
        tierPrices: normalizeTierPricesForEditor(variant),
        active: variant.active !== false,
      }),
    );
    const nextDefault =
      selectedProduct.defaultVariantId ||
      nextVariants[0]?.id ||
      nextVariants[0]?.localId ||
      null;
    setFormState(nextForm);
    setVariantRows(nextVariants);
    setDefaultVariantId(nextDefault);
    setEditingVariantIds({});
    setDraftVariantsById({});
    setVariantValidationById({});
    setFormSnapshot(JSON.stringify(nextForm));
    setVariantSnapshot(
      JSON.stringify({ defaultVariantId: nextDefault, variants: nextVariants }),
    );
  }, [createMode, selectedProduct]);

  const setDraftField = useCallback((key, field, value) => {
    setDraftVariantsById((prev) => {
      const current = prev[key] || {};
      const next = { ...current, [field]: value };
      const errors = validateDraftVariant(next);
      setVariantValidationById((validation) => ({
        ...validation,
        [key]: errors,
      }));
      return { ...prev, [key]: next };
    });
  }, []);

  const setDraftTierPrice = useCallback((key, tier, value) => {
    setDraftVariantsById((prev) => {
      const current = prev[key] || {};
      const next = {
        ...current,
        tierPrices: { ...(current.tierPrices || {}), [tier]: value },
      };
      const errors = validateDraftVariant(next);
      setVariantValidationById((validation) => ({
        ...validation,
        [key]: errors,
      }));
      return { ...prev, [key]: next };
    });
  }, []);

  const startEditingRow = useCallback((variant) => {
    const key = variant.id || variant.localId;
    setEditingVariantIds((prev) => ({ ...prev, [key]: true }));
    setDraftVariantsById((prev) => ({
      ...prev,
      [key]: {
        ...variant,
        weight: variant.weight ?? variant.weightGrams ?? "",
        price: variant.price ?? variant.priceSek ?? "",
        stock: variant.stock ?? variant.stockQuantity ?? "",
        sku: variant.sku ?? "",
        imageUrl: variant.imageUrl ?? "",
        active: variant.active !== false,
        tierPrices: {
          VIP: variant.tierPrices?.VIP ?? 0,
          SUPPORTER: variant.tierPrices?.SUPPORTER ?? 0,
          B2B: variant.tierPrices?.B2B ?? 0,
        },
      },
    }));
    setVariantValidationById((prev) => ({ ...prev, [key]: {} }));
  }, []);

  const cancelEditingRow = useCallback((key) => {
    setEditingVariantIds((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDraftVariantsById((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setVariantValidationById((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const applyEditingRow = useCallback(
    (key) => {
      const draft = draftVariantsById[key];
      if (!draft) return;
      const errors = validateDraftVariant(draft);
      setVariantValidationById((prev) => ({ ...prev, [key]: errors }));
      if (Object.keys(errors).length > 0) return;

      setVariantRows((prev) =>
        prev.map((row) =>
          (row.id || row.localId) === key ? { ...draft } : row,
        ),
      );
      cancelEditingRow(key);
    },
    [cancelEditingRow, draftVariantsById],
  );

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return [...products]
      .filter((product) => {
        if (
          query &&
          ![product.name, product.sku].some((v) =>
            `${v || ""}`.toLowerCase().includes(query),
          )
        )
          return false;
        if (
          statusFilter !== "all" &&
          (product.active ?? true) !== (statusFilter === "active")
        )
          return false;
        if (categoryFilter !== "all" && product.category !== categoryFilter)
          return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price_desc")
          return getProductSortPrice(b) - getProductSortPrice(a);
        if (sortBy === "price_asc")
          return getProductSortPrice(a) - getProductSortPrice(b);
        return (
          new Date(b.updatedAt || b.updated || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.updated || a.createdAt || 0).getTime()
        );
      });
  }, [categoryFilter, products, searchTerm, sortBy, statusFilter]);

  const formDirty = JSON.stringify(formState) !== formSnapshot;
  const variantsDirty =
    JSON.stringify({ defaultVariantId, variants: variantRows }) !==
    variantSnapshot;
  const hasChanges = formDirty || variantsDirty;

  const detailId = createMode ? null : selectedProduct?.id;

  const saveAll = async () => {
    if (saving) return;
    if (variantsDirty && hasDuplicateVariantWeight(variantRows)) {
      setListError("A variant with this weight already exists.");
      setActiveTab("variants");
      return;
    }
    setListError("");
    setSaving(true);
    try {
      let id = detailId;
      if (formDirty) {
        const payload = {
          name: formState.name.trim(),
          description: formState.description?.trim() || "",
          currency: formState.currency || "SEK",
          category: formState.category,
          imageUrl: formState.imageUrl?.trim() || "",
          sku: formState.sku?.trim() || "",
          active: formState.active !== false,
        };
        const product = id
          ? await updateProduct(id, payload, token)
          : await createProduct(payload, token);
        id = product?.id || id;
      }

      if (id && variantsDirty) {
        for (const [index, row] of variantRows.entries()) {
          const parsedWeight = parseIntegerInput(row.weight);
          if (!parsedWeight || parsedWeight <= 0) {
            setListError("Weight must be greater than zero");
            setActiveTab("variants");
            return;
          }
          const payload = {
            weightGrams: parsedWeight,
            priceSek: parseDecimalInput(row.price),
            stockQuantity: parseIntegerInput(row.stock),
            sku: row.sku || "",
            imageUrl: normalizeUrl(row.imageUrl),
            active: row.active !== false,
            sortOrder: index,
          };
          const saved = hasRealUuidId(row.id)
            ? await updateProductVariant(id, row.id, payload, token)
            : await createProductVariant(id, payload, token);
          const savedId = saved?.id || row.id;
          if (savedId) {
            await updateVariantTierPrices(
              savedId,
              {
                DEFAULT: parseDecimalInput(row.price),
                VIP: parseDecimalInput(row.tierPrices?.VIP),
                SUPPORTER: parseDecimalInput(row.tierPrices?.SUPPORTER),
                B2B: parseDecimalInput(row.tierPrices?.B2B),
              },
              token,
            );
          }
          row.id = savedId;
        }
        await updateProduct(
          id,
          { defaultVariantId: defaultVariantId || variantRows[0]?.id || null },
          token,
        );
      }
      await loadProducts();
      if (!detailId && id)
        navigate(`/store/admin/products/${id}`, { replace: true });
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
    const nextForm = {
      ...emptyForm,
      ...selectedProduct,
      active: selectedProduct.active !== false,
    };
    setFormState(nextForm);
    const nextVariants = normalizeVariants(selectedProduct.variants).map(
      (variant) => ({
        ...emptyVariant(),
        ...variant,
        localId: variant.id || globalThis.crypto?.randomUUID?.(),
        weight: variant.weight ?? "",
        price: resolveEditorPrice(variant),
        stock: getVariantStock(variant) ?? "",
        imageUrl: variant.imageUrl ?? "",
        tierPrices: normalizeTierPricesForEditor(variant),
        active: variant.active !== false,
      }),
    );
    setVariantRows(nextVariants);
    setDefaultVariantId(
      selectedProduct.defaultVariantId || nextVariants[0]?.id || null,
    );
    setEditingVariantIds({});
    setDraftVariantsById({});
    setVariantValidationById({});
  };

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!hasAccess)
    return (
      <AccessDenied
        title="Product access required"
        message="You need products permission to access this page."
      />
    );

  return (
    <div className={styles.page}>
      {!productId ? (
        <>
          <div className={styles.listHeader}>
            <h1>Products</h1>
            <button
              className={styles.primaryButton}
              onClick={() => navigate("/store/admin/products/new")}
            >
              New product
            </button>
          </div>
          <div className={styles.filtersRow}>
            <input
              className={`${styles.input} ${styles.searchInput}`}
              placeholder="Search name or SKU"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className={`${styles.input} ${styles.statusSelect}`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              className={`${styles.input} ${styles.filterSelect}`}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className={`${styles.input} ${styles.filterSelect}`}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {listError && <p className={styles.error}>{listError}</p>}
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Variants</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  onClick={() =>
                    navigate(`/store/admin/products/${product.id}`)
                  }
                >
                  <td>{product.name}</td>
                  <td>{product.sku || "—"}</td>
                  <td>{product.category || "—"}</td>
                  <td>
                    <span
                      className={
                        product.active === false
                          ? styles.badgeOff
                          : styles.badgeOn
                      }
                    >
                      {product.active === false ? "Inactive" : "Active"}
                    </span>
                  </td>
                  <td>
                    {new Date(
                      product.updatedAt ||
                        product.updated ||
                        product.createdAt ||
                        Date.now(),
                    ).toLocaleDateString()}
                  </td>
                  <td>{normalizeVariants(product.variants).length}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/store/admin/products/${product.id}`);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await toggleProductActive(
                          product.id,
                          !(product.active ?? true),
                          token,
                        );
                        loadProducts();
                      }}
                    >
                      {product.active === false ? "Activate" : "Deactivate"}
                    </button>
                    <button
                      type="button"
                      className={styles.dangerLink}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete ${product.name}?`)) {
                          await deleteProduct(product.id, token);
                          loadProducts();
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p>Loading…</p>}
        </>
      ) : (
        <>
          <div className={styles.detailHeader}>
            <button
              className={styles.linkButton}
              onClick={() => navigate("/store/admin/products")}
            >
              ← Products
            </button>
            <h1>
              {createMode ? "New product" : selectedProduct?.name || "Product"}
            </h1>
            <span
              className={
                formState.active === false ? styles.badgeOff : styles.badgeOn
              }
            >
              {formState.active === false ? "Inactive" : "Active"}
            </span>
            <div className={styles.headerActions}>
              <button
                className={styles.secondaryButton}
                onClick={() =>
                  setFormState((prev) => ({ ...prev, active: !prev.active }))
                }
              >
                {formState.active ? "Deactivate" : "Activate"}
              </button>
              {detailId && (
                <button
                  className={styles.dangerLink}
                  onClick={async () => {
                    if (window.confirm("Delete this product?")) {
                      await deleteProduct(detailId, token);
                      navigate("/store/admin/products");
                    }
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
          <div className={styles.tabs}>
            <button
              className={
                activeTab === "overview" ? styles.activeTab : styles.tab
              }
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              className={
                activeTab === "details" ? styles.activeTab : styles.tab
              }
              onClick={() => setActiveTab("details")}
            >
              Product details
            </button>
            <button
              className={
                activeTab === "variants" ? styles.activeTab : styles.tab
              }
              disabled={!detailId}
              onClick={() => setActiveTab("variants")}
            >
              Variants & pricing
            </button>
          </div>
          {activeTab === "overview" && (
            <div className={styles.cards}>
              <article className={styles.card}>
                <h3>Default price</h3>
                <p>{variantRows[0]?.price || 0} SEK</p>
              </article>
              <article className={styles.card}>
                <h3>Total stock</h3>
                <p>
                  {variantRows.reduce(
                    (sum, row) => sum + Number(row.stock || 0),
                    0,
                  )}
                </p>
              </article>
              <article className={styles.card}>
                <h3>Variants</h3>
                <p>{variantRows.length}</p>
              </article>
            </div>
          )}
          {activeTab === "details" && (
            <div className={styles.formGrid}>
              <label>
                Name
                <input
                  className={styles.input}
                  value={formState.name}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </label>
              <label>
                SKU
                <input
                  className={styles.input}
                  value={formState.sku}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, sku: e.target.value }))
                  }
                />
              </label>
              <label>
                Category
                <select
                  className={styles.input}
                  value={formState.category}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, category: e.target.value }))
                  }
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Description
                <textarea
                  className={styles.input}
                  rows={4}
                  value={formState.description}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </label>
            </div>
          )}
          {activeTab === "variants" &&
            (detailId ? (
              <>
                <div className={styles.variantToolbar}>
                  <button
                    className={styles.secondaryButton}
                    onClick={() =>
                      setVariantRows((prev) => [...prev, emptyVariant()])
                    }
                  >
                    Add variant
                  </button>
                </div>
                <div className={styles.variantsTableScroll}>
                  <table className={`${styles.table} ${styles.variantsTable}`}>
                    <thead>
                      <tr>
                        <th>Default</th>
                        <th>Weight</th>
                        <th>Price (SEK)</th>
                        <th>VIP</th>
                        <th>Supporter</th>
                        <th>B2B</th>
                        <th>Stock</th>
                        <th className={styles.colSku}>SKU</th>
                        <th className={styles.colImageUrl}>Image URL</th>
                        <th>Active</th>
                        <th className={styles.actions}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                    {variantRows.map((variant) => {
                      const key = variant.id || variant.localId;
                      const isEditing = Boolean(editingVariantIds[key]);
                      const rowData = isEditing
                        ? draftVariantsById[key] || variant
                        : variant;
                      const rowErrors = variantValidationById[key] || {};
                      return (
                        <tr key={key}>
                          <td>
                            <input
                              type="radio"
                              name="default"
                              checked={
                                defaultVariantId === key ||
                                defaultVariantId === variant.id
                              }
                              onChange={() => setDefaultVariantId(key)}
                            />
                          </td>
                          <td>
                            {isEditing ? (
                              <div className={styles.cellEditor}>
                                <input
                                  className={`${styles.input} ${styles.variantCellInput}`}
                                  inputMode="numeric"
                                  value={
                                    draftVariantsById[key]?.weight ??
                                    variant.weight ??
                                    variant.weightGrams ??
                                    ""
                                  }
                                  onChange={(e) => {
                                    if (
                                      !INTEGER_INPUT_PATTERN.test(
                                        e.target.value,
                                      )
                                    )
                                      return;
                                    setDraftField(
                                      key,
                                      "weight",
                                      e.target.value,
                                    );
                                  }}
                                />
                                {rowErrors.weight && (
                                  <span className={styles.inlineError}>
                                    {rowErrors.weight}
                                  </span>
                                )}
                              </div>
                            ) : (
                              getVariantLabel(variant)
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <div className={styles.cellEditor}>
                                <input
                                  className={`${styles.input} ${styles.variantCellInput}`}
                                  inputMode="decimal"
                                  value={rowData.price ?? ""}
                                  onChange={(e) => {
                                    if (
                                      !DECIMAL_INPUT_PATTERN.test(
                                        e.target.value,
                                      )
                                    )
                                      return;
                                    setDraftField(key, "price", e.target.value);
                                  }}
                                />
                                {rowErrors.price && (
                                  <span className={styles.inlineError}>
                                    {rowErrors.price}
                                  </span>
                                )}
                              </div>
                            ) : (
                              (variant.priceSek ?? variant.price ?? 0)
                            )}
                          </td>
                          {[
                            ["VIP", "VIP"],
                            ["SUPPORTER", "Supporter"],
                            ["B2B", "B2B"],
                          ].map(([tier, label]) => (
                            <td key={tier}>
                              {isEditing ? (
                                <div className={styles.cellEditor}>
                                  <input
                                    className={`${styles.input} ${styles.variantCellInput}`}
                                    aria-label={label}
                                    inputMode="decimal"
                                    value={rowData.tierPrices?.[tier] ?? ""}
                                    onChange={(e) => {
                                      if (
                                        !DECIMAL_INPUT_PATTERN.test(
                                          e.target.value,
                                        )
                                      )
                                        return;
                                      setDraftTierPrice(
                                        key,
                                        tier,
                                        e.target.value,
                                      );
                                    }}
                                  />
                                  {rowErrors[tier] && (
                                    <span className={styles.inlineError}>
                                      {rowErrors[tier]}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                variant.tierPrices?.[tier] || 0
                              )}
                            </td>
                          ))}
                          <td>
                            {isEditing ? (
                              <div className={styles.cellEditor}>
                                <input
                                  className={`${styles.input} ${styles.variantCellInput}`}
                                  inputMode="numeric"
                                  value={rowData.stock ?? ""}
                                  onChange={(e) => {
                                    if (
                                      !INTEGER_INPUT_PATTERN.test(
                                        e.target.value,
                                      )
                                    )
                                      return;
                                    setDraftField(key, "stock", e.target.value);
                                  }}
                                />
                                {rowErrors.stock && (
                                  <span className={styles.inlineError}>
                                    {rowErrors.stock}
                                  </span>
                                )}
                              </div>
                            ) : (
                              variant.stock || 0
                            )}
                          </td>
                          <td className={styles.colSku}>
                            {isEditing ? (
                              <input
                                className={`${styles.input} ${styles.variantCellInput}`}
                                value={rowData.sku || ""}
                                onChange={(e) =>
                                  setDraftField(key, "sku", e.target.value)
                                }
                              />
                            ) : (
                              <span
                                className={styles.truncateCell}
                                title={variant.sku || ""}
                              >
                                {variant.sku || "—"}
                              </span>
                            )}
                          </td>
                          <td className={styles.colImageUrl}>
                            {isEditing ? (
                              <input
                                className={`${styles.input} ${styles.variantCellInput}`}
                                type="url"
                                placeholder="https://..."
                                value={rowData.imageUrl || ""}
                                onChange={(e) =>
                                  setDraftField(key, "imageUrl", e.target.value)
                                }
                              />
                            ) : (
                              <span
                                className={styles.truncateCell}
                                title={normalizeUrl(variant.imageUrl) || ""}
                              >
                                {normalizeUrl(variant.imageUrl) || "—"}
                              </span>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="checkbox"
                                checked={rowData.active !== false}
                                onChange={(e) =>
                                  setDraftField(key, "active", e.target.checked)
                                }
                              />
                            ) : variant.active === false ? (
                              "No"
                            ) : (
                              "Yes"
                            )}
                          </td>
                          <td className={styles.actions}>
                            {isEditing ? (
                              <>
                                <button
                                  className={styles.linkButton}
                                  onClick={() => cancelEditingRow(key)}
                                >
                                  Cancel
                                </button>
                                <button
                                  className={styles.linkButton}
                                  onClick={() => applyEditingRow(key)}
                                >
                                  Apply
                                </button>
                              </>
                            ) : (
                              <button
                                className={styles.linkButton}
                                onClick={() => startEditingRow(variant)}
                              >
                                Edit
                              </button>
                            )}
                            <button
                              className={styles.dangerLink}
                              onClick={async () => {
                                if (variant.id)
                                  await deleteProductVariant(
                                    detailId,
                                    variant.id,
                                    token,
                                  );
                                setVariantRows((prev) =>
                                  prev.filter(
                                    (row) => (row.id || row.localId) !== key,
                                  ),
                                );
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className={styles.notice}>
                Variants require saved product. Save product details first.
              </p>
            ))}
        </>
      )}

      {hasChanges && (
        <div className={styles.stickySaveBar}>
          <span>Unsaved changes</span>
          <div>
            <button className={styles.secondaryButton} onClick={discardChanges}>
              Discard
            </button>
            <button
              className={styles.primaryButton}
              onClick={saveAll}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
