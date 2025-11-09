const API_BASE = import.meta.env?.VITE_API_BASE ?? "https://api.hydroleaf.se";

export async function fetchTopicSensors({ signal } = {}) {
    const url = `${API_BASE}/api/topics/sensors`;
    try {
        const response = await fetch(url, { signal });
        if (!response.ok) {
            return { topics: [], error: new Error(`HTTP ${response.status}`) };
        }
        const data = await response.json();
        const topics = Array.isArray(data?.topics) ? data.topics : [];
        return { topics, version: data?.version ?? null, error: null };
    } catch (error) {
        if (error?.name === "AbortError") {
            throw error;
        }
        return { topics: [], error };
    }
}

export { API_BASE };
