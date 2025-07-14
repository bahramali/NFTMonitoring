# NFT Monitoring

This project is a React dashboard that subscribes to an MQTT broker and visualises spectral sensor data.

## Setup

1. Copy `.env.example` to `.env` and fill in your MQTT credentials and broker URL.
2. Install dependencies with `npm install` (requires internet access).
3. Run the development server with `npm run dev`.
4. Execute tests with `npm test`.

## Environment variables

```
VITE_MQTT_BROKER_URL=
VITE_MQTT_USERNAME=
VITE_MQTT_PASSWORD=
```

These variables are used to establish the MQTT connection.

Incoming MQTT messages are expected to provide channel values such as
`ch415`, `ch445`, … `ch680`. The dashboard normalizes these keys to
bands `F1`–`F8` internally.
