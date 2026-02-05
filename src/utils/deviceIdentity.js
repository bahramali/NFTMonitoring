const REQUIRED_FIELDS = ["farmId", "unitType", "unitId", "deviceId"];

export const normalizeUnitType = (value) => {
  if (!value && value !== 0) return "";
  return String(value).trim().toLowerCase();
};

export const normalizeIdValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const buildDeviceKey = ({ farmId, unitType, unitId, layerId, deviceId } = {}) => {
  const normalizedFarm = normalizeIdValue(farmId);
  const normalizedType = normalizeUnitType(unitType);
  const normalizedUnit = normalizeIdValue(unitId);
  const normalizedDevice = normalizeIdValue(deviceId);
  if (!normalizedFarm || !normalizedType || !normalizedUnit || !normalizedDevice) {
    return null;
  }
  const normalizedLayer = layerId === null || layerId === undefined ? "" : normalizeIdValue(layerId);
  return `${normalizedFarm}|${normalizedType}|${normalizedUnit}|${normalizedLayer}|${normalizedDevice}`;
};

export const resolveIdentity = (payload = {}, envelope = {}) => {
  const farmId =
    payload.farmId ??
    payload.farm_id ??
    envelope.farmId ??
    envelope.farm_id ??
    null;
  const unitType =
    payload.unitType ??
    payload.unit_type ??
    envelope.unitType ??
    envelope.unit_type ??
    null;
  const unitId =
    payload.unitId ??
    payload.unit_id ??
    envelope.unitId ??
    envelope.unit_id ??
    null;
  const layerId =
    payload.layerId ??
    payload.layer_id ??
    envelope.layerId ??
    envelope.layer_id ??
    null;
  const deviceId =
    payload.deviceId ??
    payload.device_id ??
    envelope.deviceId ??
    envelope.device_id ??
    null;

  return {
    farmId,
    unitType,
    unitId,
    layerId,
    deviceId,
    kind: payload.kind ?? envelope.kind ?? null,
  };
};

export const isIdentityComplete = (identity = {}) =>
  REQUIRED_FIELDS.every((field) => normalizeIdValue(identity[field]));

export const matchesScope = (identity = {}, scope = {}) => {
  if (!scope) return true;
  const fields = ["farmId", "unitType", "unitId", "layerId"];
  for (const field of fields) {
    const scopeValue = scope[field];
    if (scopeValue === undefined || scopeValue === null || scopeValue === "") continue;
    if (normalizeIdValue(identity[field]) !== normalizeIdValue(scopeValue)) return false;
  }
  return true;
};

export const describeIdentity = (identity = {}) => ({
  farmId: normalizeIdValue(identity.farmId) || null,
  unitType: normalizeUnitType(identity.unitType) || null,
  unitId: normalizeIdValue(identity.unitId) || null,
  layerId: identity.layerId === null || identity.layerId === undefined ? null : normalizeIdValue(identity.layerId),
  deviceId: normalizeIdValue(identity.deviceId) || null,
  kind: identity.kind ?? null,
});
