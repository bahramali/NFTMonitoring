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