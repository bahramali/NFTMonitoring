# NFT Monitoring

This project is a React dashboard that subscribes to an MQTT broker and visualises spectral sensor data and temperature readings.

## Live and Reports

The application provides two main views in addition to the default dashboard:

- **Live** – displays real‑time sensor readings as they arrive. Open the "Live" link in the sidebar or navigate to `/live`.
- **Reports** – shows historical charts for a selected composite ID and time range. Access it from the sidebar or via `/reports`.

## Setup

1. Copy `.env.example` to `.env` and fill in your MQTT credentials and broker URL.
2. Install dependencies with `npm install` (requires internet access).
3. Run the development server with `npm run dev`.
4. Execute tests with `npm test`.

## Deploy test (Frontend)

Run a repeatable build + preview check before deploy:

```bash
npm run build
npm run preview
```

### Acceptance checklist

- No WebRTC requests are sent to `localhost`.
- WebRTC requests go to `https://cam.hydroleaf.se/v2/webrtc?path=...`.

## WebRTC behind Cloudflare (Infra note)

If signaling is ok but video never appears, the issue is likely ICE/UDP/TURN on the infrastructure side. Suggested fixes:

- Provide a TURN server that is reachable from clients.
- Or port-forward UDP to the media relay (when applicable).

## Environment variables

```
VITE_MQTT_BROKER_URL=
VITE_MQTT_USERNAME=
VITE_MQTT_PASSWORD=
VITE_API_BASE_URL=
VITE_BASE_PATH=
VITE_TURNSTILE_SITE_KEY=
```


Additionally, set `VITE_WS_HTTP_URL` to the WebSocket endpoint that provides the live
STOMP feed. If not defined, it defaults to `https://api.hydroleaf.se/ws`.
Set `VITE_API_BASE_URL` to the base URL for REST API requests. When omitted,
requests default to `https://api.hydroleaf.se`. For pages that communicate with
the backend (such as the Notes page), this should point to a running API
instance that exposes the expected endpoints.

Use `VITE_BASE_PATH` when deploying the app under a sub‑directory (for example,
`/super-admin/`). The build falls back to `/`, so set this variable when the app
is not served from the domain root to keep asset URLs valid on refresh.

The contact form uses Cloudflare Turnstile. Set `VITE_TURNSTILE_SITE_KEY` at build
time (Vite injects environment variables during the build step, not at runtime).
In CI/CD you should pass this value as a build environment variable or secret.

These variables are used to establish the MQTT connection.
Make sure the file is named `.env` and each variable starts with the `VITE_` prefix so that Vite exposes them to the frontend.
Do not commit `.env` files; inject environment values at build/deploy time instead.

The header at the top of the dashboard displays the current time, the MQTT topic,
the latest temperature, humidity and light intensity readings, and status
indicators for each sensor. A green dot means the sensor is responsive while a
red dot shows a problem reported in the incoming `health` object.

The dashboard shows a bar chart of the most recent spectral intensities and a temperature line chart. The bar chart is memoized so its labels stay stable as new data arrives. Historical band data can be explored in a separate section where you pick a time range.
The previous Daily Band chart has been removed; use the Historical Bands controls to inspect past readings.

## Shelly Control

Shelly smart sockets are managed via a Spring Boot backend located in `backend/`. The frontend never stores device IPs; it calls
the REST API exposed under `/api/shelly` for room/rack/socket listings, status polling, toggling, and automation scheduling. See
`docs/shelly-control.md` for the architecture, API examples, and instructions for adding new sockets.

Incoming MQTT messages are expected to contain a `timestamp` field and channel
values such as `ch415`, `ch445`, … `ch680` along with `temperature`, `humidity`
and `lux`. The dashboard normalizes these keys to bands `F1`–`F8` internally.

Sensor readings are saved to `localStorage` so that the charts
persist across page reloads. Entries older than 30 days are removed
automatically.

Extreme outliers are ignored to reduce noise in the graphs. Readings
with band values outside 0–10,000 PPFD or temperatures outside -50–60 °C
are discarded before being stored.

Both the temperature chart and the historical bands chart show the data for the

selected time range.

You can inspect past readings by selecting one of the preset periods in the
"Historical Bands" dropdown. Options include 6 h, 12 h, 24 h, 3 days, 7 days and
1 month. Selecting a period freezes the window so it does not keep advancing as
new readings arrive. The start and end timestamps of the chosen range are shown
below the dropdown.
### Spectral Bands

| Band | Center (nm) | Range (nm) | Color |
|------|-------------|------------|-------|
| F1   | 415         | 400–430   | Violet |
| F2   | 445         | 430–460   | Blue |
| F3   | 480         | 460–500   | Cyan |
| F4   | 515         | 500–530   | Green |
| F5   | 555         | 530–570   | Green/Yellow |
| F6   | 590         | 570–610   | Yellow/Orange |
| F7   | 630         | 610–650   | Orange/Red |
| F8   | 680         | 650–700   | Red |
| Clear| -           | full visible spectrum | All colors |
| NIR  | -           | >700       | Near Infrared |
