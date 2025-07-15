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

The dashboard shows a bar chart of the most recent spectral intensities and a temperature line chart. Historical band data can be explored with a separate line chart.

Incoming MQTT messages are expected to provide channel values such as
`ch415`, `ch445`, … `ch680`. The dashboard normalizes these keys to
bands `F1`–`F8` internally.

Sensor readings are saved to `localStorage` so that the daily charts
persist across page reloads. Entries older than 24 hours are removed
automatically.

Extreme outliers are ignored to reduce noise in the graphs. Readings
with band values outside 0–10,000 PPFD or temperatures outside -50–60 °C
are discarded before being stored.

Both the temperature chart and the historical bands chart show the data for the
selected time range only. They remain static until you press **Apply** again to
refresh the view.

You can inspect past readings by selecting a time range with the
"Historical Bands" controls in the dashboard. After choosing start and
end times, press **Apply** to render a line chart of all bands for that
period. The chart does not refresh automatically, so you can examine
historical trends without incoming data shifting the view. You can also
specify minimum and maximum PPFD values to adjust the chart's Y axis
and zoom in on particular intensity ranges.
