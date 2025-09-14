import React, { useEffect, useRef, useState } from "react";
import styles from "./Cameras.module.css";

const DEFAULT_SRC =
  import.meta.env.VITE_TAPO_HLS || "https://cam.hydroleaf.se/tapo/index.m3u8";

export default function Cameras() {
  const videoRef = useRef(null);
  const [src, setSrc] = useState(DEFAULT_SRC);

  useEffect(() => {
    let hls;
    async function setup() {
      if (!videoRef.current) return;

      if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
        videoRef.current.src = src;
        return;
      }

      try {
        const Hls = (await import("hls.js")).default;
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.ERROR, (_, data) => {
            console.error("HLS error:", data);
          });
        }
      } catch (err) {
        console.error("Failed to load hls.js", err);
        videoRef.current.src = src;
      }
    }

    setup();

    return () => {
      if (hls) hls.destroy();
    };
  }, [src]);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Tapo Camera Stream</h2>
      <video
        ref={videoRef}
        className={styles.video}
        controls
        autoPlay
        muted
        playsInline
      />
      <div className={styles.controls}>
        <input
          type="text"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          className={styles.input}
        />
        <button onClick={() => setSrc(src)} className={styles.button}>
          Reload
        </button>
      </div>
    </div>
  );
}
