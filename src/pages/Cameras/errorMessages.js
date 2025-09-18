// pages/Cameras/errorMessages.js

export const DEFAULT_CAMERA_ERROR_MESSAGE = "Unable to load the camera stream.";

const MEDIA_ERROR_MESSAGES = {
    1: "Playback was aborted before it could start.",
    2: "A network issue interrupted the camera stream.",
    3: "The browser could not decode the camera stream.",
    4: "The browser could not access the stream URL or format.",
};

export const MIXED_CONTENT_MESSAGE =
    "The dashboard is served over HTTPS but the camera stream uses HTTP. Browsers block this mixed content. Update the stream to HTTPS or open the dashboard over HTTP.";

const TECHNICAL_ERROR_MESSAGE_MAP = {
    DEMUXER_ERROR_DETECTED: MEDIA_ERROR_MESSAGES[3],
    DEMUXER_ERROR_DETECTED_HLS: MEDIA_ERROR_MESSAGES[3],
};

export function getCameraErrorMessage({
    errorCode,
    errorMessage,
    streamUrl,
    pageProtocol,
} = {}) {
    const normalizedStreamUrl =
        typeof streamUrl === "string" ? streamUrl.trim().toLowerCase() : undefined;

    if (pageProtocol === "https:" && normalizedStreamUrl && normalizedStreamUrl.startsWith("http:")) {
        return MIXED_CONTENT_MESSAGE;
    }

    if (errorMessage) {
        const normalizedMessage = typeof errorMessage === "string" ? errorMessage.trim() : errorMessage;
        if (typeof normalizedMessage === "string" && TECHNICAL_ERROR_MESSAGE_MAP[normalizedMessage]) {
            return TECHNICAL_ERROR_MESSAGE_MAP[normalizedMessage];
        }
        return errorMessage;
    }

    if (errorCode && MEDIA_ERROR_MESSAGES[errorCode]) {
        return MEDIA_ERROR_MESSAGES[errorCode];
    }

    return DEFAULT_CAMERA_ERROR_MESSAGE;
}

