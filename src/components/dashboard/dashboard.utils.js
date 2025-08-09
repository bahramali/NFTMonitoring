export function toLocalInputValue(date) {
  const tz = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - tz);
  return local.toISOString().slice(0, 16);
}

export function formatTime(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
