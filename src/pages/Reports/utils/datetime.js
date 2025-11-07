export const toLocalInputValue = (date) => {
    const pad = (n) => `${n}`.padStart(2, "0");
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
};

export const toISOSeconds = (value) => (value ? new Date(value).toISOString() : "");

export const pickBucket = (fromLocal, toLocal) => {
    const hours = (new Date(toLocal) - new Date(fromLocal)) / 36e5;
    if (hours <= 6) return "1m";
    if (hours <= 24) return "5m";
    if (hours <= 72) return "15m";
    if (hours <= 168) return "30m"; // <= 7 days
    if (hours <= 720) return "1h";  // <= 30 days
    return "2h";
};
