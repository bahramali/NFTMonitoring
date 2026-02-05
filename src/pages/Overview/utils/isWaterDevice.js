export function isWaterDevice(deviceId) {
  const normalized = String(deviceId || "").trim().toUpperCase();
  return normalized.startsWith("T");
}

export default isWaterDevice;
