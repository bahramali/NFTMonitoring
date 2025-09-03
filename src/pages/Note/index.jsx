import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080';

function Note() {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [notes, setNotes] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/notes`);
                if (res.ok) {
                    const data = await res.json();
                    setNotes(Array.isArray(data) ? data : []);
                }
            } catch (e) {
                console.error(e);
            }
        })();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newNote = { title, content, date: new Date().toISOString() };
        try {
            const res = await fetch(`${API_BASE}/api/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newNote)
            });
            if (res.ok) {
                const saved = await res.json().catch(() => newNote);
                setNotes(prev => [saved, ...prev]);
                setTitle('');
                setContent('');
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div style={{ padding: '1rem' }}>
            <h2>Daily Notes</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px' }}>
                <input
                    type="text"
                    placeholder="Title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                />
                <textarea
                    placeholder="Write your note..."
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={4}
                    required
                />
                <button type="submit">Save</button>
            </form>

            <div style={{ marginTop: '1rem' }}>
                {notes.map((note, idx) => (
                    <div key={note.id ?? idx} style={{ border: '1px solid #ccc', padding: '0.5rem', marginBottom: '0.5rem' }}>
                        <strong>{note.title}</strong>
                        <p>{note.content}</p>
                        <small>{new Date(note.date).toLocaleString()}</small>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Note;
