/**
 * @typedef {Object} CameraConfig
 * @property {string} id
 * @property {string} name
 * @property {string} [streamId]
 */

import { PERMISSIONS, hasPerm } from "../utils/permissions.js";

const TIMELAPSE_BASE_URL = import.meta?.env?.VITE_TIMELAPSE_BASE_URL || "";
const LIVE_HLS_BASE_URL =
    import.meta?.env?.VITE_LIVE_HLS_BASE_URL || "https://cam.hydroleaf.se:8443";

const normalizeBaseUrl = (value) => value?.replace(/\/$/, "") ?? "";

const ensureLiveHlsPort = (baseUrl) => {
    if (!baseUrl) return baseUrl;
    const hasPort = /:\d+$/.test(baseUrl);
    if (hasPort) return baseUrl;
    if (baseUrl.includes("cam.hydroleaf.se")) {
        return `${baseUrl}:8443`;
    }
    return baseUrl;
};

export const isAdminUser = (user) => {
    const roleList = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
    return (
        roleList.includes("SUPER_ADMIN") ||
        hasPerm(user, PERMISSIONS.ADMIN_OVERVIEW_VIEW)
    );
};

export const getTimelapseBaseUrl = () => normalizeBaseUrl(TIMELAPSE_BASE_URL);

export const buildLiveHlsUrl = ({ cameraId }) => {
    const liveBaseUrl = ensureLiveHlsPort(normalizeBaseUrl(LIVE_HLS_BASE_URL));
    if (!liveBaseUrl) {
        throw new Error("Missing live HLS base URL. Set VITE_LIVE_HLS_BASE_URL.");
    }
    if (!cameraId) {
        throw new Error("Missing cameraId for live stream.");
    }
    const camera = CAMERA_CONFIG.find((entry) => entry.id === cameraId);
    const streamId = camera?.streamId || cameraId;
    return `${liveBaseUrl}/${streamId}/index.m3u8`;
};

/** @type {CameraConfig[]} */
export const CAMERA_CONFIG = [
    {
        id: "tapo-59",
        name: "S2L1",
    },
    {
        id: "tapo-60",
        name: "S2L2",
    },
    {
        id: "tapo-61",
        name: "S2L3",
    },
    {
        id: "tapo-62",
        name: "S2L4",
    },
    {
        id: "tapo-63",
        name: "S1L2",
    },
    {
        id: "tapo-64",
        name: "S1L3",
    },
];

export const getCameraById = (cameraId) =>
    CAMERA_CONFIG.find((camera) => camera.id === cameraId) || null;
