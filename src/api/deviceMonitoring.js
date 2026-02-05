import { authFetch, parseApiResponse } from "./http.js";
import { getApiBaseUrl } from "../config/apiBase.js";

const API_BASE = getApiBaseUrl();
const FARMS_URL = `${API_BASE}/api/farms`;
const DEVICES_URL = `${API_BASE}/api/devices`;

const requestJson = async (url, options, errorMessage) => {
  const response = await authFetch(url, options);
  return parseApiResponse(response, errorMessage);
};

export const listFarms = ({ signal } = {}) =>
  requestJson(FARMS_URL, { signal }, "Failed to load farms");

export const listFarmDevices = (farmId, { signal } = {}) => {
  const encodedFarmId = encodeURIComponent(farmId);
  return requestJson(
    `${FARMS_URL}/${encodedFarmId}/devices`,
    { signal },
    "Failed to load farm devices"
  );
};

export const getDeviceDetails = (deviceId, { signal } = {}) => {
  const encodedDeviceId = encodeURIComponent(deviceId);
  return requestJson(
    `${DEVICES_URL}/${encodedDeviceId}`,
    { signal },
    "Failed to load device details"
  );
};

export const listDevices = async ({ signal } = {}) => {
  try {
    return await requestJson(DEVICES_URL, { signal }, "Failed to load devices");
  } catch (error) {
    if (error?.status !== 404) throw error;
    return requestJson(`${DEVICES_URL}/all`, { signal }, "Failed to load devices");
  }
};

export const getDeviceEvents = (deviceId, { signal, cursor } = {}) => {
  const encodedDeviceId = encodeURIComponent(deviceId);
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  const suffix = query.toString() ? `?${query}` : "";
  return requestJson(
    `${DEVICES_URL}/${encodedDeviceId}/events${suffix}`,
    { signal },
    "Failed to load device events"
  );
};
