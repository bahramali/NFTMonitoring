/**
 * @typedef {Object} CameraConfig
 * @property {string} id
 * @property {string} name
 * @property {string} path
 */

import { PERMISSIONS, hasPerm } from "../utils/permissions.js";

const TIMELAPSE_BASE_URL = import.meta?.env?.VITE_TIMELAPSE_BASE_URL || "";
const LIVE_BASE_URL = import.meta?.env?.VITE_LIVE_BASE_URL || "";
const LIVE_BASE_URL_ADMIN_TS = import.meta?.env?.VITE_LIVE_BASE_URL_ADMIN_TS || "";
const LIVE_WEBRTC_URL_TEMPLATE =
    import.meta?.env?.VITE_LIVE_WEBRTC_URL_TEMPLATE ||
    "{baseUrl}/api/webrtc?path={cameraId}";

const normalizeBaseUrl = (value) => value?.replace(/\/$/, "") ?? "";

export const isAdminUser = (user) => {
    const roleList = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
    return (
        roleList.includes("SUPER_ADMIN") ||
        hasPerm(user, PERMISSIONS.ADMIN_OVERVIEW_VIEW)
    );
};

export const getLiveBaseUrl = (user) => {
    if (isAdminUser(user) && LIVE_BASE_URL_ADMIN_TS) {
        return normalizeBaseUrl(LIVE_BASE_URL_ADMIN_TS);
    }
    return normalizeBaseUrl(LIVE_BASE_URL);
};

export const getTimelapseBaseUrl = () => normalizeBaseUrl(TIMELAPSE_BASE_URL);

export const buildLiveWebrtcUrl = ({ cameraId, user }) => {
    const liveBaseUrl = getLiveBaseUrl(user);
    if (!liveBaseUrl) {
        throw new Error(
            "Missing live base URL. Set VITE_LIVE_BASE_URL or VITE_LIVE_BASE_URL_ADMIN_TS.",
        );
    }
    if (!cameraId) {
        throw new Error("Missing cameraId for live stream.");
    }
    return LIVE_WEBRTC_URL_TEMPLATE
        .replace("{baseUrl}", liveBaseUrl)
        .replace("{cameraId}", cameraId);
};

/** @type {CameraConfig[]} */
export const CAMERA_CONFIG = [
    {
        id: "tapo-59",
        name: "Tapo 59",
        path: "tapo-59",
    },
    {
        id: "tapo-38",
        name: "Tapo 38",
        path: "tapo-38",
    },
    {
        id: "tapo-39",
        name: "Tapo 39",
        path: "tapo-39",
    },
    {
        id: "tapo-40",
        name: "Tapo 40",
        path: "tapo-40",
    },
    {
        id: "tapo-35",
        name: "Tapo 35",
        path: "tapo-35",
    },
    {
        id: "tapo-37",
        name: "Tapo 37",
        path: "tapo-37",
    },
];

export const getCameraById = (cameraId) =>
    CAMERA_CONFIG.find((camera) => camera.id === cameraId) || null;
