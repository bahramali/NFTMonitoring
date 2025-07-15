# NFT Monitoring

This project is a React dashboard that subscribes to an MQTT broker and visualises spectral sensor data and temperature readings.

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
Make sure the file is named `.env` and each variable starts with the `VITE_` prefix so that Vite exposes them to the frontend.

The dashboard shows a bar chart of the most recent spectral intensities and two line charts plotting the selected band and temperature over the last 24 hours.

Incoming MQTT messages are expected to provide channel values such as
`ch415`, `ch445`, … `ch680`. The dashboard normalizes these keys to
bands `F1`–`F8` internally.

Sensor readings are saved to `localStorage` so that the daily charts
persist across page reloads. Entries older than 24 hours are removed
automatically.
