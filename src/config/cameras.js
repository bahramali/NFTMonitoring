/**
 * @typedef {Object} CameraConfig
 * @property {string} id
 * @property {string} name
 * @property {string} [streamId]
 */

import { PERMISSIONS, hasPerm } from "../utils/permissions.js";

const TIMELAPSE_BASE_URL = import.meta?.env?.VITE_TIMELAPSE_BASE_URL || "";
const LIVE_HLS_BASE_URL =
    import.meta?.env?.VITE_LIVE_HLS_BASE_URL ??
    (import.meta?.env?.DEV ? import.meta?.env?.VITE_LIVE_HLS_BASE_URL_DEV : undefined) ??
    "";

const normalizeBaseUrl = (value) => value?.replace(/\/$/, "") ?? "";

export const isAdminUser = (user) => {
    const roleList = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
    return (
        roleList.includes("SUPER_ADMIN") ||
        hasPerm(user, PERMISSIONS.ADMIN_OVERVIEW_VIEW)
    );
};

export const getTimelapseBaseUrl = () => normalizeBaseUrl(TIMELAPSE_BASE_URL);

export const buildLiveHlsUrl = ({ cameraId }) => {
    const liveBaseUrl = normalizeBaseUrl(LIVE_HLS_BASE_URL);
    if (!liveBaseUrl) {
        throw new Error(
            "Missing live HLS base URL. Set VITE_LIVE_HLS_BASE_URL (or VITE_LIVE_HLS_BASE_URL_DEV in dev)."
        );
    }
    if (!cameraId) {
        throw new Error("Missing cameraId for live stream.");
    }
    const camera = CAMERA_CONFIG.find((entry) => entry.id === cameraId);
    if (!camera?.streamId) {
        console.error("[Cameras] Unknown cameraId", cameraId);
        return null;
    }
    return `${liveBaseUrl}/${camera.streamId}/index.m3u8`;
};

/** @type {CameraConfig[]} */
export const CAMERA_CONFIG = [
    {
        id: "S2L1",
        name: "S2L1",
        streamId: "S2L1",
    },
    {
        id: "S2L2",
        name: "S2L2",
        streamId: "S2L2",
    },
    {
        id: "S2L3",
        name: "S2L3",
        streamId: "S2L3",
    },
    {
        id: "S2L4",
        name: "S2L4",
        streamId: "S2L4",
    },
    {
        id: "S1L2",
        name: "S1L2",
        streamId: "S1L2",
    },
    {
        id: "S1L3",
        name: "S1L3",
        streamId: "S1L3",
    },
];

export const getCameraById = (cameraId) =>
    CAMERA_CONFIG.find((camera) => camera.id === cameraId) || null;
