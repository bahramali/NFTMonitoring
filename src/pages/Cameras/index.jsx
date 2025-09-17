// pages/Cameras/index.jsx
import React, { useEffect, useRef } from "react";
import Hls from "hls.js";
import styles from "./Cameras.module.css";

// pick URL from env or fallback
const SRC =
    (import.meta?.env && import.meta.env.VITE_TAPO_HLS) ||
    "https://cam.hydroleaf.se/tapo/index.m3u8";

export default function Cameras() {
  const videoRef = useRef(null);
  const hlsRef = useRef(null); // keep instance for cleanup

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // clean any previous instance
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }

    // set attributes for autoplay policies
    video.crossOrigin = "anonymous";
    video.autoplay = true;
    video.muted = true;       // required for autoplay
    video.playsInline = true; // iOS inline
    video.preload = "auto";

    // Native HLS (Safari/iOS)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = SRC;
      video.load();
      const onLoaded = () => video.play().catch(() => {});
      video.addEventListener("loadedmetadata", onLoaded, { once: true });

      return () => {
        video.removeEventListener("loadedmetadata", onLoaded);
      };
    }

    // hls.js for other browsers
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,        // classic HLS; stable with MediaMTX mpegts
        liveSyncDuration: 2,
        liveMaxLatencyDuration: 6,
        maxLiveSyncPlaybackRate: 1.2,
      });
      hlsRef.current = hls;

      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(SRC);
      });

      // basic error recovery
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        console.error("HLS error:", data);
        if (!data?.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            try { hls.startLoad(); } catch {}
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            try { hls.recoverMediaError(); } catch {}
            break;
          default:
            try { hls.destroy(); } catch {}
            break;
        }
      });

      const onLoaded = () => video.play().catch(() => {});
      video.addEventListener("loadedmetadata", onLoaded, { once: true });

      return () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        try { hls.destroy(); } catch {}
        hlsRef.current = null;
      };
    }

    // ultimate fallback
    video.src = SRC;
    video.load();

    // no special cleanup for fallback
  }, []);

  return (
      <div className={styles.container}>
        <h2 className={styles.title}>Tapo Camera Stream</h2>
        <video
            ref={videoRef}
            className={styles.video}
            controls
            muted
            playsInline
        />
      </div>
  );
}
