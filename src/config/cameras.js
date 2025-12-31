/**
 * @typedef {Object} CameraConfig
 * @property {string} id
 * @property {string} name
 * @property {string} webrtcUrl
 */

const MEDIAMTX_HOST = import.meta?.env?.VITE_MEDIAMTX_HOST || "100.124.203.1";

const buildWebrtcUrl = (path) => `http://${MEDIAMTX_HOST}:8889/${path}`;

/** @type {CameraConfig[]} */
export const CAMERA_CONFIG = [
    {
        id: "tapo-59",
        name: "Tapo 59",
        webrtcUrl: buildWebrtcUrl("tapo-59"),
    },
    {
        id: "tapo-38",
        name: "Tapo 38",
        webrtcUrl: buildWebrtcUrl("tapo-38"),
    },
    {
        id: "tapo-39",
        name: "Tapo 39",
        webrtcUrl: buildWebrtcUrl("tapo-39"),
    },
    {
        id: "tapo-40",
        name: "Tapo 40",
        webrtcUrl: buildWebrtcUrl("tapo-40"),
    },
    {
        id: "tapo-35",
        name: "Tapo 35",
        webrtcUrl: buildWebrtcUrl("tapo-35"),
    },
    {
        id: "tapo-37",
        name: "Tapo 37",
        webrtcUrl: buildWebrtcUrl("tapo-37"),
    },
];

export const getCameraById = (cameraId) =>
    CAMERA_CONFIG.find((camera) => camera.id === cameraId) || null;
