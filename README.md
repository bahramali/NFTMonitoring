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

## Environment variables

```
VITE_MQTT_BROKER_URL=
VITE_MQTT_USERNAME=
VITE_MQTT_PASSWORD=
VITE_API_BASE=
```

Additionally, set `VITE_WS_URL` to the WebSocket endpoint that provides the live
STOMP feed. If not defined, it defaults to `wss://api.hydroleaf.se/ws`.
Set `VITE_API_BASE` to the base URL for REST API requests. When omitted,
requests default to `https://api.hydroleaf.se`. For pages that communicate with
the backend (such as the Notes page), this should point to a running API
instance that exposes the expected endpoints.

These variables are used to establish the MQTT connection.
Make sure the file is named `.env` and each variable starts with the `VITE_` prefix so that Vite exposes them to the frontend.

The header at the top of the dashboard displays the current time, the MQTT topic,
the latest temperature, humidity and light intensity readings, and status
indicators for each sensor. A green dot means the sensor is responsive while a
red dot shows a problem reported in the incoming `health` object.

The dashboard shows a bar chart of the most recent spectral intensities and a temperature line chart. The bar chart is memoized so its labels stay stable as new data arrives. Historical band data can be explored in a separate section where you pick a time range.
The previous Daily Band chart has been removed; use the Historical Bands controls to inspect past readings.

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

## Backend SUPER_ADMIN provisioning

The backend provisions exactly one `SUPER_ADMIN` account on startup via an internal seed. The seed runs in the Spring Boot backend and uses the following configuration keys (environment variables or `application.yml`):

- `APP_SUPERADMIN_EMAIL` (required)
- `APP_SUPERADMIN_PASSWORD` (required, minimum 12 characters)
- `APP_SUPERADMIN_DISPLAY_NAME` (optional, defaults to `Super Admin`)
- `APP_SUPERADMIN_ACTIVE` (optional, defaults to `true`)

The seed only executes when no `SUPER_ADMIN` exists, trims and lowercases the email, hashes the password with the configured encoder, and skips seeding with a warning if required values are missing. `SUPER_ADMIN` cannot be created through public APIs; user management endpoints reject any attempt to assign the `SUPER_ADMIN` role via request payloads.
