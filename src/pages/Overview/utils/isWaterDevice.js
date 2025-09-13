export function isWaterDevice(compId) {
  const parts = String(compId || "").trim().toUpperCase().split("-");
  return parts[2]?.startsWith("T") || false;
}

export default isWaterDevice;
