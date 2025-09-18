import { describe, expect, it } from "vitest";
import {
    getCameraErrorMessage,
    DEFAULT_CAMERA_ERROR_MESSAGE,
    MIXED_CONTENT_MESSAGE,
} from "../src/pages/Cameras/errorMessages";

describe("getCameraErrorMessage", () => {
    it("returns the mixed content message when HTTPS page requests an HTTP stream", () => {
        const message = getCameraErrorMessage({
            streamUrl: "http://camera.local/stream.m3u8",
            pageProtocol: "https:",
        });

        expect(message).toBe(MIXED_CONTENT_MESSAGE);
    });

    it("uses provided error message when available", () => {
        const message = getCameraErrorMessage({
            errorMessage: "Custom error",
            errorCode: 2,
        });

        expect(message).toBe("Custom error");
    });

    it("maps media error codes to descriptive text", () => {
        const message = getCameraErrorMessage({ errorCode: 3 });

        expect(message).toBe("The browser could not decode the camera stream.");
    });

    it("falls back to default message when it cannot determine the cause", () => {
        const message = getCameraErrorMessage();

        expect(message).toBe(DEFAULT_CAMERA_ERROR_MESSAGE);
    });
});
