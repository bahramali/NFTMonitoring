import React, { useEffect, useRef, useState } from 'react';
import styles from './Cameras.module.css';

function Cameras() {
    const [devices, setDevices] = useState([]);
    const videoRefs = useRef([]);
    const streams = useRef([]);

    useEffect(() => {
        async function init() {
            try {
                await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                const deviceInfos = await navigator.mediaDevices.enumerateDevices();
                const cams = deviceInfos.filter(d => d.kind === 'videoinput');
                setDevices(cams);
            } catch (err) {
                console.error('Could not access cameras', err);
            }
        }
        init();

        const currentStreams = streams.current;
        return () => {
            currentStreams.forEach(stream => {
                stream.getTracks().forEach(t => t.stop());
            });
        };
    }, []);

    useEffect(() => {
        devices.forEach((device, idx) => {
            if (!videoRefs.current[idx] || streams.current[idx]) return;
            navigator.mediaDevices
                .getUserMedia({ video: { deviceId: { exact: device.deviceId } }, audio: false })
                .then(stream => {
                    streams.current[idx] = stream;
                    if (videoRefs.current[idx]) {
                        videoRefs.current[idx].srcObject = stream;
                    }
                })
                .catch(err => {
                    console.error('Could not start stream', device.label, err);
                });
        });
    }, [devices]);

    return (
        <div className={styles.grid}>
            {devices.map((device, idx) => (
                <div key={device.deviceId} className={styles.camera}>
                    <video
                        ref={el => (videoRefs.current[idx] = el)}
                        className={styles.cameraVideo}
                        autoPlay
                        playsInline
                        muted
                    />
                    <div className={styles.label}>{device.label || `Camera ${idx + 1}`}</div>
                </div>
            ))}
            {devices.length === 0 && <p>No cameras found.</p>}
        </div>
    );
}

export default Cameras;
