// src/pages/sensor-config/SensorConfigPage.jsx
import React, { useMemo, useState } from "react";
import { useSensorConfig } from "../../context/SensorConfigContext.jsx";
import styles from "./SensorConfigPage.module.css";
import Header from "../common/Header";

export default function SensorConfigPage() {
    const { configs, error, createConfig, updateConfig, deleteConfig } = useSensorConfig();

    // --- form state for create/update (top card)
    const [form, setForm] = useState({ sensorType: "", topic: "", minValue: "", maxValue: "", description: "" });
    const [editing, setEditing] = useState(null); // config id of row being edited in the top form
    const [message, setMessage] = useState("");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState({ key: "sensorType", dir: "asc" }); // asc | desc

    // --- inline row edit state
    const [rowEdit, setRowEdit] = useState(null); // config id
    const [rowDraft, setRowDraft] = useState({ minValue: "", maxValue: "", description: "" });

    // Build array from map-like configs
    const rows = useMemo(() => {
        const list = Object.values(configs || {});
        const term = search.trim().toLowerCase();
        const filtered = term
            ? list.filter((r) => {
                const topic = r.topic || "";
                return (
                    r.sensorType?.toLowerCase().includes(term) ||
                    topic.toLowerCase().includes(term) ||
                    r.description?.toLowerCase().includes(term)
                );
            })
            : list;

        const dir = sort.dir === "asc" ? 1 : -1;
        return [...filtered].sort((a, b) => {
            const k = sort.key;
            if (k === "minValue" || k === "maxValue") {
                return ((Number(a[k]) || 0) - (Number(b[k]) || 0)) * dir;
            }
            if (k === "topic") {
                const av = (a.topic || "").toString().toLowerCase();
                const bv = (b.topic || "").toString().toLowerCase();
                return av.localeCompare(bv) * dir;
            }
            const av = (a?.[k] ?? "").toString().toLowerCase();
            const bv = (b?.[k] ?? "").toString().toLowerCase();
            return av.localeCompare(bv) * dir;
        });
    }, [configs, search, sort]);

    // --- helpers
    const setFormField = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    const resetForm = () => {
        setEditing(null);
        setForm({ sensorType: "", topic: "", minValue: "", maxValue: "", description: "" });
    };

    const validate = (minStr, maxStr) => {
        const minNum = Number(minStr);
        const maxNum = Number(maxStr);
        if (!Number.isFinite(minNum) || !Number.isFinite(maxNum)) return "Min/Max must be numbers";
        if (maxNum < minNum) return "Max must be greater than or equal to Min";
        return "";
    };

    // --- create/update via top form
    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");

        const sensorType = form.sensorType.trim();
        const err =
            (!editing && !sensorType) ||
            form.minValue === "" ||
            form.maxValue === "" ||
            validate(form.minValue, form.maxValue);

        if (err) {
            setMessage(typeof err === "string" ? err : "Please fill required fields correctly");
            return;
        }

        const minValue = Number(form.minValue);
        const maxValue = Number(form.maxValue);
        const payload = {
            minValue,
            maxValue,
            description: form.description?.trim() || "",
        };

        try {
            if (editing) {
                await updateConfig(editing, payload);
            } else {
                await createConfig({
                    sensorType,
                    topic: form.topic,
                    ...payload,
                });
            }
            setMessage("Saved");
            resetForm();
        } catch (ex) {
            setMessage(ex?.message || "Failed to save");
        }
    };

    // --- start edit in top form
    const startTopEdit = (id) => {
        const cfg = configs[id] || {};
        setEditing(id);
        setForm({
            sensorType: cfg.sensorType ?? "",
            topic: cfg.topic ?? "",
            minValue: cfg.minValue ?? "",
            maxValue: cfg.maxValue ?? "",
            description: cfg.description ?? "",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // --- delete
    const handleDelete = async (id) => {
        setMessage("");
        try {
            await deleteConfig(id);
            setMessage("Deleted");
            if (editing === id) resetForm();
        } catch (ex) {
            setMessage(ex?.message || "Failed to delete");
        }
    };

    // --- inline row edit handlers
    const startRowEdit = (cfg) => {
        setRowEdit(cfg.id);
        setRowDraft({
            minValue: cfg.minValue ?? "",
            maxValue: cfg.maxValue ?? "",
            description: cfg.description ?? "",
        });
    };

    const cancelRowEdit = () => {
        setRowEdit(null);
        setRowDraft({ minValue: "", maxValue: "", description: "" });
    };

    const saveRowEdit = async (id) => {
        const err = validate(rowDraft.minValue, rowDraft.maxValue);
        if (err) {
            setMessage(err);
            return;
        }
        try {
            await updateConfig(id, {
                minValue: Number(rowDraft.minValue),
                maxValue: Number(rowDraft.maxValue),
                description: rowDraft.description?.trim() || "",
            });
            setMessage("Updated");
            cancelRowEdit();
        } catch (ex) {
            setMessage(ex?.message || "Failed to update");
        }
    };

    const SortBtn = ({ id, children }) => (
        <button
            type="button"
            className={styles.sortBtn}
            onClick={() =>
                setSort((s) => ({
                    key: id,
                    dir: s.key === id && s.dir === "asc" ? "desc" : "asc",
                }))
            }
            aria-label={`Sort by ${id}`}
            title={`Sort by ${id}`}
        >
            {children}
            <span className={`${styles.sortArrow} ${sort.key === id ? styles.active : ""} ${sort.dir === "desc" ? styles.desc : ""}`} />
        </button>
    );

    return (
        <div className={styles.page}>
            <Header title="Sensor Config" />

            {error && <div role="alert" className={styles.alert}>{error}</div>}
            {message && <div role="status" className={styles.status}>{message}</div>}

            {/* Create / Update Card */}
            <section className={styles.card}>
                <header className={styles.cardHeader}>
                    <div className={styles.cardTitle}>{editing ? `Edit: ${editing}` : "Add New Sensor Config"}</div>
                </header>
                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.row}>
                        <label className={styles.label}>
                            <span>Sensor Type</span>
                            <input
                                name="sensorType"
                                value={form.sensorType}
                                onChange={setFormField}
                                disabled={Boolean(editing)}
                                placeholder="e.g. ph, temperature, lux"
                                className={styles.input}
                                required={!editing}
                            />
                        </label>

                        <label className={styles.label}>
                            <span>Topic</span>
                            <input
                                name="topic"
                                value={form.topic}
                                onChange={setFormField}
                                placeholder="e.g. /topic/growSensors (leave blank for all)"
                                className={styles.input}
                                disabled={Boolean(editing)}
                                list="topic-options"
                            />
                            <datalist id="topic-options">
                                <option value="/topic/growSensors" />
                                <option value="/topic/waterTank" />
                                <option value="/topic/germinationTopic" />
                            </datalist>
                        </label>

                        <label className={styles.label}>
                            <span>Min</span>
                            <input
                                name="minValue"
                                type="number"
                                value={form.minValue}
                                onChange={setFormField}
                                placeholder="e.g. 5.8"
                                className={styles.input}
                                required
                            />
                        </label>

                        <label className={styles.label}>
                            <span>Max</span>
                            <input
                                name="maxValue"
                                type="number"
                                value={form.maxValue}
                                onChange={setFormField}
                                placeholder="e.g. 6.5"
                                className={styles.input}
                                required
                            />
                        </label>
                    </div>

                    <label className={styles.label}>
                        <span>Description</span>
                        <textarea
                            name="description"
                            value={form.description}
                            onChange={setFormField}
                            placeholder="Short note about the ideal range"
                            className={`${styles.input} ${styles.textarea}`}
                            rows={2}
                        />
                    </label>

                    <div className={styles.actions}>
                        <button className={styles.primary} type="submit">
                            {editing ? "Update" : "Create"}
                        </button>
                        {editing && (
                            <button className={styles.ghost} type="button" onClick={resetForm}>
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </section>

            {/* Table Card */}
            <section className={styles.card}>
                <header className={styles.cardHeader}>
                    <div className={styles.cardTitle}>Configured Sensors</div>
                    <input
                        className={styles.search}
                        placeholder="Search sensor type..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </header>

                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                        <tr>
                            <th><SortBtn id="sensorType">Sensor Type</SortBtn></th>
                            <th><SortBtn id="topic">Topic</SortBtn></th>
                            <th className={styles.num}><SortBtn id="minValue">Min</SortBtn></th>
                            <th className={styles.num}><SortBtn id="maxValue">Max</SortBtn></th>
                            <th>Range</th>
                            <th>Description</th>
                            <th className={styles.actionsCol}>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((cfg) => {
                            const editingThis = rowEdit === cfg.id;
                            const topicLabel = cfg.topic ? cfg.topic : "All topics";
                            const minDisplay = cfg.minValue ?? "—";
                            const maxDisplay = cfg.maxValue ?? "—";
                            return (
                                <tr key={cfg.id}>
                                    <td className={styles.typeCell}>{cfg.sensorType}</td>
                                    <td>{topicLabel}</td>

                                    {/* Min */}
                                    <td className={styles.num}>
                                        {editingThis ? (
                                            <input
                                                className={styles.cellInput}
                                                type="number"
                                                value={rowDraft.minValue}
                                                onChange={(e) => setRowDraft((d) => ({ ...d, minValue: e.target.value }))}
                                            />
                                        ) : (
                                            minDisplay
                                        )}
                                    </td>

                                    {/* Max */}
                                    <td className={styles.num}>
                                        {editingThis ? (
                                            <input
                                                className={styles.cellInput}
                                                type="number"
                                                value={rowDraft.maxValue}
                                                onChange={(e) => setRowDraft((d) => ({ ...d, maxValue: e.target.value }))}
                                            />
                                        ) : (
                                            maxDisplay
                                        )}
                                    </td>

                                    {/* Range Bar */}
                                    <td>
                                        <div className={styles.rangeBar} title={`${minDisplay} – ${maxDisplay}`}>
                                            <div className={styles.rangeFill} />
                                            <div className={styles.rangeMarks}>
                                                <span>{minDisplay}</span>
                                                <span>{maxDisplay}</span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Description */}
                                    <td className={styles.descCell}>
                                        {editingThis ? (
                                            <input
                                                className={styles.cellInput}
                                                type="text"
                                                value={rowDraft.description}
                                                onChange={(e) => setRowDraft((d) => ({ ...d, description: e.target.value }))}
                                                placeholder="Description"
                                            />
                                        ) : (
                                            <span className={styles.ellipsis} title={cfg.description || ""}>
                          {cfg.description}
                        </span>
                                        )}
                                    </td>

                                    {/* Actions */}
                                    <td className={styles.actionsCol}>
                                        {editingThis ? (
                                            <>
                                                <button
                                                    className={styles.primarySm}
                                                    type="button"
                                                    onClick={() => saveRowEdit(cfg.id)}
                                                >
                                                    Save
                                                </button>
                                                <button className={styles.ghostSm} type="button" onClick={cancelRowEdit}>
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    className={styles.iconBtn}
                                                    type="button"
                                                    title="Inline edit"
                                                    onClick={() => startRowEdit(cfg)}
                                                >
                                                    ✎
                                                </button>
                                                <button
                                                    className={styles.iconBtnDanger}
                                                    type="button"
                                                    title="Delete"
                                                    onClick={() => handleDelete(cfg.id)}
                                                >
                                                    🗑
                                                </button>
                                                <button
                                                    className={styles.iconBtn}
                                                    type="button"
                                                    title="Edit in form"
                                                    onClick={() => startTopEdit(cfg.id)}
                                                >
                                                    ⤴
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {rows.length === 0 && (
                            <tr>
                                <td className={styles.empty} colSpan={6}>No configs</td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
