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

export function getCameraErrorMessage({
    errorCode,
    errorMessage,
    streamUrl,
    pageProtocol,
} = {}) {
    if (pageProtocol === "https:" && typeof streamUrl === "string" && streamUrl.startsWith("http:")) {
        return MIXED_CONTENT_MESSAGE;
    }

    if (errorMessage) {
        return errorMessage;
    }

    if (errorCode && MEDIA_ERROR_MESSAGES[errorCode]) {
        return MEDIA_ERROR_MESSAGES[errorCode];
    }

    return DEFAULT_CAMERA_ERROR_MESSAGE;
}

