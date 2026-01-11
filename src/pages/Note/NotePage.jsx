import React, { useEffect, useMemo, useState } from "react";
import Header from "../common/Header";
import styles from "./NotePage.module.css";

import { getApiBaseUrl } from '../../config/apiBase.js';

const API_BASE = getApiBaseUrl();

export default function NotePage() {
    const [notes, setNotes] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    // form state
    const [form, setForm] = useState({ title: "", content: "" });
    const [editingId, setEditingId] = useState(null);

    // ui helpers
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState({ key: "date", dir: "desc" }); // date | title

    // load notes
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/notes`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setNotes(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error(e);
                setError("Failed to load notes.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // filter + sort
    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = q
            ? notes.filter(
                (n) =>
                    n.title?.toLowerCase().includes(q) ||
                    n.content?.toLowerCase().includes(q)
            )
            : notes;

        const dir = sort.dir === "asc" ? 1 : -1;
        return [...list].sort((a, b) => {
            if (sort.key === "title") {
                return (a.title || "").localeCompare(b.title || "") * dir;
            }
            const ad = new Date(a.date || 0).getTime();
            const bd = new Date(b.date || 0).getTime();
            return (ad - bd) * dir;
        });
    }, [notes, search, sort]);

    // helpers
    const setField = (e) =>
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const resetForm = () => {
        setEditingId(null);
        setForm({ title: "", content: "" });
    };

    // create or update
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const payload = {
            title: form.title.trim(),
            content: form.content.trim(),
            date: editingId ? undefined : new Date().toISOString().split(".")[0],
        };

        try {
            if (editingId) {
                const res = await fetch(`${API_BASE}/api/notes/${editingId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const saved = await res.json().catch(() => ({ id: editingId, ...payload }));
                setNotes((prev) =>
                    prev.map((n) => (n.id === editingId ? { ...n, ...saved } : n))
                );
            } else {
                const res = await fetch(`${API_BASE}/api/notes`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const saved = await res.json().catch(() => payload);
                setNotes((prev) => [saved, ...prev]);
            }
            resetForm();
        } catch (err) {
            console.error(err);
            setError("Save failed.");
        }
    };

    const startEdit = (n) => {
        if (!n?.id) return;
        setEditingId(n.id);
        setForm({ title: n.title || "", content: n.content || "" });
        window.scrollTo?.({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (n) => {
        if (!n?.id) return;
        const confirmDelete = confirm("Delete this note?");
        if (!confirmDelete) return;
        try {
            const res = await fetch(`${API_BASE}/api/notes/${n.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setNotes((prev) => prev.filter((x) => x.id !== n.id));
            if (editingId === n.id) resetForm();
        } catch (e) {
            console.error(e);
            setError("Delete failed.");
        }
    };

    return (
        <div className={styles.page}>
            <Header title="Daily Notes" />
            {error && <div role="alert" className={styles.alert}>{error}</div>}

            {/* Form Card */}
            <section className={styles.card}>
                <header className={styles.cardHeader}>
                    <div className={styles.cardTitle}>
                        {editingId ? "Edit Note" : "Add Note"}
                    </div>
                </header>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.label}>
                        <span>Title:</span>
                        <input
                            className={styles.input}
                            name="title"
                            value={form.title}
                            onChange={setField}
                            placeholder="Note title"
                            required
                        />
                    </label>

                    <label className={styles.label}>
                        <span>Content:</span>
                        <textarea
                            className={`${styles.input} ${styles.textarea}`}
                            name="content"
                            value={form.content}
                            onChange={setField}
                            placeholder="Write your note..."
                            rows={4}
                            required
                        />
                    </label>

                    <div className={styles.actions}>
                        <button className={styles.primary} type="submit">
                            {editingId ? "Update" : "Save"}
                        </button>
                        {editingId && (
                            <button className={styles.ghost} type="button" onClick={resetForm}>
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </section>

            {/* List Card */}
            <section className={styles.card}>
                <header className={styles.cardHeader}>
                    <div className={styles.cardTitle}>Notes</div>
                    <div className={styles.toolbar}>
                        <input
                            className={styles.search}
                            placeholder="Search by title/content…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <select
                            className={styles.select}
                            value={`${sort.key}:${sort.dir}`}
                            onChange={(e) => {
                                const [key, dir] = e.target.value.split(":");
                                setSort({ key, dir });
                            }}
                        >
                            <option value="date:desc">Newest first</option>
                            <option value="date:asc">Oldest first</option>
                            <option value="title:asc">Title A→Z</option>
                            <option value="title:desc">Title Z→A</option>
                        </select>
                    </div>
                </header>

                {loading ? (
                    <div className={styles.empty}>Loading…</div>
                ) : rows.length === 0 ? (
                    <div className={styles.empty}>No notes found.</div>
                ) : (
                    <div className={styles.grid}>
                        {rows.map((n, i) => (
                            <article className={styles.noteCard} key={n.id ?? i}>
                                <div className={styles.noteHeader}>
                                    <h3 className={styles.noteTitle} title={n.title}>
                                        {n.title || "Untitled"}
                                    </h3>
                                    <time className={styles.noteDate}>
                                        {n.date ? new Date(n.date).toLocaleString() : "—"}
                                    </time>
                                </div>

                                <p className={styles.noteBody} title={n.content}>
                                    {n.content}
                                </p>

                                <div className={styles.noteActions}>
                                    {n.id && (
                                        <>
                                            <button
                                                className={styles.iconBtn}
                                                type="button"
                                                title="Edit"
                                                onClick={() => startEdit(n)}
                                            >
                                                ✎
                                            </button>
                                            <button
                                                className={styles.iconBtnDanger}
                                                type="button"
                                                title="Delete"
                                                onClick={() => handleDelete(n)}
                                            >
                                                🗑
                                            </button>
                                        </>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
