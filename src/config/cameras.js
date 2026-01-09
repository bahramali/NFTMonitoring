/**
 * @typedef {Object} CameraConfig
 * @property {string} id
 * @property {string} name
 * @property {string} path
 * @property {string} webrtcUrl
 */

const MEDIAMTX_HOST =
    import.meta?.env?.VITE_MEDIAMTX_HOST ||
    (typeof window !== "undefined" ? window.location.hostname : "localhost");
const MEDIAMTX_SCHEME =
    import.meta?.env?.VITE_MEDIAMTX_SCHEME ||
    (typeof window !== "undefined" ? window.location.protocol.replace(":", "") : "") ||
    "https";
const MEDIAMTX_PORT = import.meta?.env?.VITE_MEDIAMTX_PORT || "";

export const buildWebrtcUrl = (path) => {
    const portPart = MEDIAMTX_PORT ? `:${MEDIAMTX_PORT}` : "";
    return `${MEDIAMTX_SCHEME}://${MEDIAMTX_HOST}${portPart}/${path}`;
};

/** @type {CameraConfig[]} */
export const CAMERA_CONFIG = [
    {
        id: "tapo-59",
        name: "Tapo 59",
        path: "tapo-59",
        webrtcUrl: buildWebrtcUrl("tapo-59"),
    },
    {
        id: "tapo-38",
        name: "Tapo 38",
        path: "tapo-38",
        webrtcUrl: buildWebrtcUrl("tapo-38"),
    },
    {
        id: "tapo-39",
        name: "Tapo 39",
        path: "tapo-39",
        webrtcUrl: buildWebrtcUrl("tapo-39"),
    },
    {
        id: "tapo-40",
        name: "Tapo 40",
        path: "tapo-40",
        webrtcUrl: buildWebrtcUrl("tapo-40"),
    },
    {
        id: "tapo-35",
        name: "Tapo 35",
        path: "tapo-35",
        webrtcUrl: buildWebrtcUrl("tapo-35"),
    },
    {
        id: "tapo-37",
        name: "Tapo 37",
        path: "tapo-37",
        webrtcUrl: buildWebrtcUrl("tapo-37"),
    },
];

export const getCameraById = (cameraId) =>
    CAMERA_CONFIG.find((camera) => camera.id === cameraId) || null;
