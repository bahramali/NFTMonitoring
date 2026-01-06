# Shelly Control Architecture

HydroLeaf Shelly Control is split into a backend-only integration layer and a frontend dashboard. The frontend never sees or
stores Shelly IP addresses; it only calls REST endpoints exposed by the backend. Devices are organised as **Room → Rack →
Socket**. Sockets are configured on the backend with their IP addresses; adding a new socket only requires updating the backend
configuration and restarting the service.

## Backend (Spring Boot)
- Loads a Shelly registry from `application.yml` (`shelly.rooms[].racks[].sockets[]`). Each socket entry contains `id`, `name`,
  and `ip`.
- Provides a `ShellyClient` that talks to Shelly Gen3 devices via `/rpc/Switch.*` endpoints (status, set, toggle).
- `ShellyService` exposes safe operations (list rooms, batch status, toggle, set state) while keeping IPs hidden.
- `AutomationService` schedules automations in-memory:
  - `TIME_RANGE`: daily on/off between start/end times (optional days-of-week filter).
  - `INTERVAL_TOGGLE`: toggles every N minutes.
  - `AUTO_OFF`: turns on immediately, off after N minutes.
- REST API under `/api/shelly` with CORS enabled for browsers.

## Frontend (React)
- `ShellyControlPage` renders rooms, racks, and sockets with live status. Status polling uses the batch `/status` endpoint every
  few seconds.
- Toggle buttons call the backend to change socket power. Automations are created via a modal with three tabs that map to the
  backend automation types. Existing automations are listed with delete controls.
- No device IP addresses are ever stored or displayed.

## REST API
Base URL: `/api/shelly`

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/rooms` | Returns rooms with racks and sockets (IDs and names only). |
| `GET` | `/status?ids=SOCKET_1,SOCKET_2` | Batch status for the provided sockets, or all when `ids` is omitted. |
| `POST` | `/socket/{socketId}/state` | Body `{ "on": true }` to turn on/off. |
| `POST` | `/socket/{socketId}/toggle` | Toggles the current state. |
| `GET` | `/automation` | Lists configured automations. |
| `POST` | `/automation` | Creates automation; body depends on `type` (see below). |
| `DELETE` | `/automation/{id}` | Deletes an automation. |

### Automation payloads
- **TIME_RANGE**: `{ "socketId": "SOCKET_1", "type": "TIME_RANGE", "startTime": "06:00", "endTime": "22:00", "daysOfWeek": ["MON", "TUE"] }`
- **INTERVAL_TOGGLE**: `{ "socketId": "SOCKET_1", "type": "INTERVAL_TOGGLE", "intervalMinutes": 15 }`
- **AUTO_OFF**: `{ "socketId": "SOCKET_1", "type": "AUTO_OFF", "autoOffMinutes": 10 }`

Times use 24h `HH:mm` strings; days-of-week follow Java `DayOfWeek` names (e.g., `MON`, `SUN`).

## Adding a socket
1. Edit `backend/src/main/resources/application.yml` and add the socket under the correct rack with `id`, `name`, and `ip`.
2. Restart the Spring Boot backend (`mvn spring-boot:run` from the `backend` folder).
3. Open the Shelly Control page; the new socket appears automatically with live status and automation support.

## Running locally
- **Backend**: `cd backend && ./mvnw spring-boot:run` (or `mvn spring-boot:run` if Maven is installed). Ensure the host has
  network access to the Shelly devices.
- **Frontend**: `npm install` then `npm run dev` (uses `VITE_API_BASE_URL` to point to the backend).
