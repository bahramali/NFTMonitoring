/**
 * @typedef {Object} CameraConfig
 * @property {string} id
 * @property {string} name
 * @property {string} streamId
 */

import { PERMISSIONS, hasPerm } from "../utils/permissions.js";

const TIMELAPSE_BASE_URL = import.meta?.env?.VITE_TIMELAPSE_BASE_URL || "";
const LIVE_HLS_BASE_URL =
    import.meta?.env?.VITE_LIVE_HLS_BASE_URL || "https://cam.hydroleaf.se:8443";

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
        name: "Tapo 59",
        streamId: "tapo-59",
    },
    {
        id: "tapo-38",
        name: "Tapo 38",
        streamId: "tapo-38",
    },
    {
        id: "tapo-39",
        name: "Tapo 39",
        streamId: "tapo-39",
    },
    {
        id: "S2L1",
        name: "S2L1",
        streamId: "S2L1-21",
    },
    {
        id: "tapo-35",
        name: "Tapo 35",
        streamId: "tapo-35",
    },
    {
        id: "tapo-37",
        name: "Tapo 37",
        streamId: "tapo-37",
    },
];

export const getCameraById = (cameraId) =>
    CAMERA_CONFIG.find((camera) => camera.id === cameraId) || null;
