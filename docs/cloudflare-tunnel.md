# Cloudflare Tunnel & API Architecture (Beginner-Friendly Guide)

This document explains **why** we use Cloudflare Tunnel, **how** the API is exposed securely, and **how** everything is wired together—step by step, like a small technical book. No prior Cloudflare knowledge required.

---

## Problem Statement

We run our backend services inside Docker. That means:

- The backend is **not publicly accessible** by default.
- We still need the outside world (browsers, mobile apps) to reach our API.
- We want **HTTPS** and a **custom domain** (e.g., `api.hydroleaf.se`).

So the core challenge is:

> “How can the public internet reach a private Docker service *securely*, without opening risky inbound ports?”

---

## Backend Running in Docker

Our backend lives in Docker containers. A container is like a small isolated mini-computer. It listens on a port **inside** the Docker network, but:

- That port isn’t reachable from the internet.
- Docker doesn’t expose it unless we explicitly publish it.

This is good for safety—but it makes public access harder.

---

## Not Publicly Accessible (By Design)

By default, Docker services are **private**. If you don’t publish ports, the outside world can’t see them.

That’s actually what we want:

- Fewer exposed ports = fewer attack paths.
- Internal services stay internal.

But we still need a way in.

---

## Need HTTPS + Custom Domain

We want:

- **HTTPS** (secure encryption)
- **Custom domains** like:
  - `api.hydroleaf.se`
  - `cam.hydroleaf.se`

Doing this manually with SSL certificates, port forwarding, and firewall rules is hard and risky.

So instead of opening the server to the internet, we use **Cloudflare Tunnel**.

---

## Concept: Cloudflare Tunnel

### What a Tunnel Is

A tunnel is an **outbound connection** from your server to Cloudflare.

Think of it like calling Cloudflare and saying:

> “Hey, I’m here, and I can accept traffic. Send it to me through this private channel.”

Cloudflare then becomes the public front door.

### Why Outbound Connection Is Safer

- You **don’t open inbound ports** on your server.
- The server only connects **outward** to Cloudflare.
- That eliminates direct public exposure.

### No Open Ports

There are **zero** ports exposed to the internet on your server.

The only connection is:

```
cloudflared --> Cloudflare Edge (outbound only)
```

---

## System Architecture

Here’s the full flow of a request:

```
[Browser]
    |
    v
[Cloudflare Edge]
    |
    v
[cloudflared container]
    |
    v
[Backend service]
```

### Expanded View with Services

```
Browser
   |
   v
Cloudflare Edge
   |
   v
cloudflared (Docker container)
   |\
   | \
   |  +--> sensor-backend:8080 (api.hydroleaf.se)
   |
   +----> mediamtx:8888 (cam.hydroleaf.se)
```

---

## Ingress Routing

Cloudflare Tunnel uses an **ingress rule list** to map domains to services.

Example mappings:

- `api.hydroleaf.se` → `sensor-backend:8080`
- `cam.hydroleaf.se` → `mediamtx:8888`

And a **catch-all** rule for anything else:

- `*` → 404

### Why This Matters

It lets you route multiple subdomains to different internal services—without exposing them directly.

---

## `cloudflared/config.yml` (Full Explanation)

A typical config looks like this:

```yaml
tunnel: <tunnel-id>
credentials-file: /etc/cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.hydroleaf.se
    service: http://sensor-backend:8080
  - hostname: cam.hydroleaf.se
    service: http://mediamtx:8888
  - service: http_status:404
```

### Field-by-Field

- **`tunnel`**: The unique ID of your Cloudflare Tunnel.
- **`credentials-file`**: Where the secure token JSON file lives.
- **`ingress`**: A list of routing rules.
  - **`hostname`**: The domain the user visits.
  - **`service`**: Where traffic should go *inside Docker*.
  - The final `service: http_status:404` acts as a catch-all if no hostname matches.

### Why Container Names Work as Hostnames

Inside a Docker network, **container names become DNS hostnames**.

So:

- `sensor-backend` is a valid hostname
- `mediamtx` is a valid hostname

That’s why `http://sensor-backend:8080` works—Docker provides internal DNS.

---

## Token & Security

### What the Tunnel Token Is

The tunnel token (or JSON credentials file) proves to Cloudflare that your container is allowed to create the tunnel.

It’s like a private key.

### Why It Must Never Be in the Frontend

If the token is exposed:

- Anyone could impersonate your tunnel.
- They could route traffic to their own server.

So it **must never** be shipped to browsers or frontend code.

### Where It Is Stored and Used

- Stored in the **cloudflared container** only.
- Loaded by `cloudflared` at runtime.
- Not shared with any other service.

---

## Docker Networking

### Shared Docker Network

All containers are on the same Docker network, like a private LAN.

```
+-------------------- Docker Network --------------------+
|                                                        |
|  cloudflared   sensor-backend   mediamtx               |
|      |               |             |                   |
+--------------------------------------------------------+
```

### Why cloudflared Can Reach Backends Without Exposed Ports

Because everything is inside the same private network:

- `cloudflared` can connect to `sensor-backend:8080`
- No public port is needed

This keeps services private but still reachable *internally*.

---

## Common Errors & Fixes

### 523 Origin Unreachable

**Meaning:** Cloudflare can’t reach your service.

**Common causes:**

- Container name is wrong
- Service is down
- Port is incorrect

**Fix:**

- Verify container is running
- Check `service: http://<name>:<port>`

---

### Invalid Tunnel Token

**Meaning:** cloudflared rejected credentials.

**Common causes:**

- Wrong token file
- Expired or deleted tunnel

**Fix:**

- Recreate tunnel in Cloudflare dashboard
- Replace the credentials file

---

### DNS Record Conflicts

**Meaning:** Cloudflare has a DNS record that doesn’t match the tunnel.

**Common causes:**

- Old A/AAAA record still exists
- Manual DNS entry pointing elsewhere

**Fix:**

- Remove old DNS records
- Let Cloudflare manage DNS with the tunnel

---

## Final Mental Model (One-Page Summary)

### The Big Idea

1. Your backend stays private in Docker.
2. `cloudflared` creates an **outbound** tunnel to Cloudflare.
3. Cloudflare acts as the secure front door.
4. Ingress rules map domains to containers.
5. No public ports are opened.

### Request Flow Diagram

```
Browser
   |
   v
Cloudflare Edge (HTTPS + DNS)
   |
   v
cloudflared (tunnel client in Docker)
   |
   v
Internal Service (sensor-backend / mediamtx)
```

### Mental Model in One Sentence

> Cloudflare Tunnel is a safe bridge from the public internet to private Docker services—without ever opening inbound ports.

