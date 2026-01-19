export default class MediaMTXWebRTCReader {
    constructor({ url, video, onStatusChange, onError }) {
        this.url = url;
        this.video = video;
        this.onStatusChange = onStatusChange;
        this.onError = onError;
        this.peerConnection = null;
        this.abortController = null;
        this.sessionUrl = null;
        this.mediaStream = new MediaStream();
        this.started = false;
        this.handleTrackEvent = this.handleTrackEvent.bind(this);
        this.handleConnectionState = this.handleConnectionState.bind(this);
        this.handleIceState = this.handleIceState.bind(this);
        this.handleVideoError = this.handleVideoError.bind(this);
    }

    notifyStatus(status) {
        this.onStatusChange?.(status);
    }

    notifyError(message, error) {
        if (error?.name !== "AbortError") {
            console.error("[MediaMTXWebRTCReader]", error);
        }
        this.onError?.(message);
        this.notifyStatus("error");
    }

    attachStream(stream) {
        if (!this.video || !stream) {
            return;
        }
        if (this.video.srcObject !== stream) {
            this.video.srcObject = stream;
        }
        const playPromise = this.video.play?.();
        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
        }
    }

    handleTrackEvent(event) {
        if (event.streams && event.streams[0]) {
            this.attachStream(event.streams[0]);
            this.notifyStatus("playing");
            return;
        }
        if (event.track) {
            this.mediaStream.addTrack(event.track);
            this.attachStream(this.mediaStream);
            this.notifyStatus("playing");
        }
    }

    handleConnectionState() {
        const state = this.peerConnection?.connectionState;
        if (state === "connected") {
            this.notifyStatus("playing");
            return;
        }
        if (state === "connecting" || state === "disconnected") {
            this.notifyStatus("loading");
            return;
        }
        if (state === "failed" || state === "closed") {
            this.notifyError("WebRTC connection failed. Please check the stream.");
        }
    }

    handleIceState() {
        const state = this.peerConnection?.iceConnectionState;
        if (state === "connected" || state === "completed") {
            this.notifyStatus("playing");
            return;
        }
        if (state === "checking" || state === "disconnected") {
            this.notifyStatus("loading");
            return;
        }
        if (state === "failed") {
            this.notifyError("ICE negotiation failed. Unable to play the stream.");
        }
    }

    handleVideoError() {
        this.notifyError("Media playback failed. Please try again.");
    }

    async start() {
        if (this.started) {
            return;
        }
        this.started = true;
        this.notifyStatus("loading");

        if (!this.url) {
            this.notifyError("Missing WHEP endpoint URL.");
            return;
        }
        if (!this.video) {
            this.notifyError("Unable to load the camera stream.");
            return;
        }

        this.peerConnection = new RTCPeerConnection();
        this.abortController = new AbortController();

        this.peerConnection.addTransceiver("video", { direction: "recvonly" });
        this.peerConnection.addEventListener("track", this.handleTrackEvent);
        this.peerConnection.addEventListener("connectionstatechange", this.handleConnectionState);
        this.peerConnection.addEventListener("iceconnectionstatechange", this.handleIceState);
        this.video.addEventListener("error", this.handleVideoError);
        this.video.muted = true;
        this.video.playsInline = true;

        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            const response = await fetch(this.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/sdp",
                },
                body: this.peerConnection.localDescription?.sdp || "",
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                throw new Error(
                    `WHEP request failed with status ${response.status} ${response.statusText}`,
                );
            }

            const answerSdp = await response.text();
            if (!answerSdp) {
                throw new Error("WHEP endpoint did not return an SDP answer.");
            }

            const locationHeader = response.headers.get("location");
            if (locationHeader) {
                try {
                    this.sessionUrl = new URL(locationHeader, this.url).toString();
                } catch {
                    this.sessionUrl = locationHeader;
                }
            }

            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription({ type: "answer", sdp: answerSdp }),
            );
        } catch (error) {
            if (error?.name === "AbortError") {
                return;
            }
            this.notifyError(error?.message || "Unable to load the camera stream.", error);
        }
    }

    async stop() {
        if (!this.started) {
            return;
        }
        this.started = false;
        this.abortController?.abort();

        if (this.video) {
            this.video.removeEventListener("error", this.handleVideoError);
        }

        if (this.peerConnection) {
            this.peerConnection.removeEventListener("track", this.handleTrackEvent);
            this.peerConnection.removeEventListener("connectionstatechange", this.handleConnectionState);
            this.peerConnection.removeEventListener("iceconnectionstatechange", this.handleIceState);
            this.peerConnection.getReceivers().forEach((receiver) => {
                receiver.track?.stop?.();
            });
            this.peerConnection.getSenders().forEach((sender) => {
                sender.track?.stop?.();
            });
            this.peerConnection.close();
        }

        this.mediaStream.getTracks().forEach((track) => track.stop());
        if (this.video) {
            this.video.srcObject = null;
        }

        if (this.sessionUrl) {
            try {
                await fetch(this.sessionUrl, { method: "DELETE" });
            } catch (error) {
                if (error?.name !== "AbortError") {
                    console.warn("[MediaMTXWebRTCReader] cleanup failed", error);
                }
            }
        }
    }
}
