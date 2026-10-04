# Computer Networks Project 2

## Private DNS + HTTPS Reverse Proxy + Load Balancing

Four Macs on the same LAN work together. A private DNS server resolves custom
`.test` domains to an Nginx reverse proxy. Nginx terminates HTTPS and
load-balances requests across two Node.js/Express backends. If one backend
fails, Nginx fails over to the other.

## Team Members

| Enrollment No. | Name |
|----------------|------|
| 2401010182 | Harshit Kudhial |
| 2401010306 | Om Chimurkar |
| 2401010317 | Pankaj Upadhyay |
| 2401020045 | Prakhar Rawat |

---

## Architecture

```
            ┌──────────────────────┐
            │  Mac 1 – DNS Server  │
            │  dnsmasq (UDP :53)   │
            └──────────┬───────────┘
                       │  app.teamX.test → NGINX_IP
                       ▼
            Client (any Mac using Mac 1 as DNS)
                       │  HTTPS request
                       ▼
            ┌──────────────────────┐
            │  Mac 2 – Nginx       │
            │  :80  → 301 to HTTPS │
            │  :443 → TLS + proxy  │
            └──────┬────────┬──────┘
          round-robin       │
                   ▼        ▼
   ┌────────────────────┐  ┌────────────────────┐
   │ Mac 3 – Backend A  │  │ Mac 4 – Backend B  │
   │ Express :3001      │  │ Express :3002      │
   │ X-Backend: A       │  │ X-Backend: B       │
   └────────────────────┘  └────────────────────┘
```

**Request flow:** Client → DNS lookup on Mac 1 (dnsmasq) → HTTPS to Mac 2 Nginx → Backend A / Backend B

## Components

| Machine | Role | Software | Port(s) |
|---------|------|----------|---------|
| Mac 1 | Private DNS server for the team's `.test` domains | dnsmasq | 53 |
| Mac 2 | Reverse proxy / load balancer / TLS termination | Nginx | 80, 443 |
| Mac 3 | Backend A | Node.js + Express | 3001 |
| Mac 4 | Backend B | Node.js + Express | 3002 |

## Technologies

- macOS
- dnsmasq
- Nginx
- Node.js (v18+, required by Express 5)
- Express.js
- HTTPS (self-signed certificate via OpenSSL)
- curl / dig

## Repository Structure

```
CN_Project/
├── backend-a/            # Mac 3 – Express server on :3001
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── backend-b/            # Mac 4 – Express server on :3002
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── nginx/                # Mac 2 – reverse proxy config
│   ├── nginx.conf
│   └── README.md
├── dns/                  # Mac 1 – dnsmasq config
│   └── dnsmasq-project2.conf
├── screenshots/          # Test evidence
├── README.md
└── .gitignore
```

## Placeholders

Real LAN IPs and private keys are **not** committed. Replace these placeholders
with your own values before running anything:

| Placeholder | Replace with | Find it with |
|-------------|--------------|--------------|
| `MAC1_IP` | LAN IP of Mac 1 | `ipconfig getifaddr en0` on Mac 1 |
| `NGINX_IP` | LAN IP of Mac 2 | `ipconfig getifaddr en0` on Mac 2 |
| `BACKEND_A_IP` | LAN IP of Mac 3 | `ipconfig getifaddr en0` on Mac 3 |
| `BACKEND_B_IP` | LAN IP of Mac 4 | `ipconfig getifaddr en0` on Mac 4 |
| `teamX` | Your team name | — |

---

## 1. Install Dependencies

**Mac 3 and Mac 4 (backends):**

```bash
brew install node
```

**Mac 2 (Nginx):**

```bash
brew install nginx
```

**Mac 1 (DNS):**

```bash
brew install dnsmasq
```

## 2. Start Backend A (Mac 3)

```bash
cd backend-a
npm install
node server.js
```

Expected output:

```
Backend A running on port 3001
```

Verify locally:

```bash
curl -i http://localhost:3001/api/status
```

```
X-Backend: A
{"backend":"A","status":"healthy"}
```

## 3. Start Backend B (Mac 4)

```bash
cd backend-b
npm install
node server.js
```

Expected output:

```
Backend B running on port 3002
```

Verify locally:

```bash
curl -i http://localhost:3002/api/status
```

Both backends bind to `0.0.0.0` so Mac 2 can reach them over the LAN. If macOS
asks whether to allow incoming connections for `node`, click **Allow**.

### Backend endpoints

| Route | Response | Headers |
|-------|----------|---------|
| `GET /` | `Hello from Backend A` / `Hello from Backend B` | `X-Backend`, `Cache-Control` |
| `GET /api/status` | `{"backend":"A","status":"healthy"}` | `X-Backend`, `Cache-Control` |

## 4. Generate the SSL Certificate (Mac 2)

The private key is never committed. Generate a self-signed certificate valid
for both domains:

```bash
mkdir -p "$(brew --prefix)/etc/nginx/certs"
cd "$(brew --prefix)/etc/nginx/certs"

openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout teamX.key -out teamX.crt \
  -subj "/CN=app.teamX.test" \
  -addext "subjectAltName=DNS:app.teamX.test,DNS:api.teamX.test"
```

### Trust the certificate on every client Mac

`curl` must validate the certificate, so **never use `-k`**. Copy
`teamX.crt` (the certificate only, never the `.key`) to each client Mac and
add it to the System keychain as trusted:

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain teamX.crt
```

Now `curl https://app.teamX.test` succeeds without `-k`.

## 5. Configure Nginx (Mac 2)

Copy `nginx/nginx.conf` to Homebrew's Nginx config path and replace the
placeholders:

```bash
cp nginx/nginx.conf "$(brew --prefix)/etc/nginx/nginx.conf"
```

Key parts of the config:

```nginx
upstream backend_servers {
    # Round-robin by default. A backend that fails once is skipped for 5s.
    server BACKEND_A_IP:3001 max_fails=1 fail_timeout=5s;
    server BACKEND_B_IP:3002 max_fails=1 fail_timeout=5s;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name app.teamX.test api.teamX.test;
    return 301 https://$host$request_uri;
}

# HTTPS reverse proxy
server {
    listen 443 ssl;
    server_name app.teamX.test api.teamX.test;

    ssl_certificate     certs/teamX.crt;
    ssl_certificate_key certs/teamX.key;

    location / {
        proxy_pass http://backend_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Retry the other backend when one is down
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_connect_timeout 2s;
    }
}
```

Test and start (ports 80/443 need `sudo`):

```bash
sudo nginx -t
sudo nginx            # first start
sudo nginx -s reload  # after config changes
```

## 6. Configure dnsmasq (Mac 1)

`dns/dnsmasq-project2.conf`:

```
port=53
interface=en0
listen-address=127.0.0.1,MAC1_IP
bind-interfaces

address=/app.teamX.test/NGINX_IP
address=/api.teamX.test/NGINX_IP
```

`MAC1_IP` is Mac 1's LAN IP. dnsmasq must listen on the LAN interface;
with only `127.0.0.1` the other Macs could not reach it.

Install it on Mac 1:

```bash
cp dns/dnsmasq-project2.conf "$(brew --prefix)/etc/dnsmasq.d/"
echo "conf-dir=$(brew --prefix)/etc/dnsmasq.d/,*.conf" >> "$(brew --prefix)/etc/dnsmasq.conf"

sudo brew services restart dnsmasq
```

### Point the client Macs at Mac 1

On each client Mac (Mac 2, 3, 4), set the DNS server to `MAC1_IP`:
**System Settings → Network → Wi-Fi → Details → DNS → +** → `MAC1_IP`.

Or from the terminal:

```bash
sudo networksetup -setdnsservers Wi-Fi MAC1_IP
```

To undo it later: `sudo networksetup -setdnsservers Wi-Fi empty`

---

## Testing

All tests are run from a **client Mac** (Mac 2, 3 or 4) that uses Mac 1 as
its DNS server and trusts the certificate. **No test uses `-k`**, and every
request uses the domain name, never an IP.

### Test 1: DNS resolution

```bash
dig app.teamX.test
dig api.teamX.test
```

Expected: the ANSWER SECTION returns `NGINX_IP`, and the `SERVER:` line shows
`MAC1_IP#53`.

Prove the name is private (not a real public domain):

```bash
dig @8.8.8.8 app.teamX.test
```

Expected: `status: NXDOMAIN`.

![DNS resolution](screenshots/dns-resolution.png)

### Test 2: HTTP → HTTPS redirect

```bash
curl -I http://app.teamX.test
```

Expected:

```
HTTP/1.1 301 Moved Permanently
Location: https://app.teamX.test/
```

```bash
curl -v https://app.teamX.test
```

Expected: TLS handshake lines, the certificate subject/SAN matching
`app.teamX.test`, and `HTTP/1.1 200 OK`.

![HTTPS working](screenshots/https-working.png)

### Test 3: Load balancing

```bash
for i in 1 2 3 4 5 6; do
  curl -sI https://app.teamX.test | grep -i x-backend
done
```

Expected (round-robin):

```
X-Backend: A
X-Backend: B
X-Backend: A
X-Backend: B
...
```

![Load balancing](screenshots/load-balancing.png)

### Test 4: `/api/status`

```bash
curl -s https://api.teamX.test/api/status; echo
curl -s https://api.teamX.test/api/status; echo
```

Expected:

```
{"backend":"A","status":"healthy"}
{"backend":"B","status":"healthy"}
```

![API status](screenshots/api-status.png)

### Test 5: Failover (Backend A down → Backend B serves)

1. On **Mac 3**, stop Backend A with `Ctrl+C`.
2. On a **client Mac**, send requests through Nginx:

   ```bash
   for i in 1 2 3 4; do
     curl -sI https://app.teamX.test | grep -i x-backend
   done
   ```

   Expected: every response is served by B, and no request fails.

   ```
   X-Backend: B
   X-Backend: B
   X-Backend: B
   X-Backend: B
   ```

3. Restart Backend A on Mac 3 (`node server.js`). After `fail_timeout` (5s),
   responses alternate A/B again.

```
Backend A stopped
        ↓
Request through Nginx
        ↓
Nginx marks A as failed (max_fails=1), retries on B (proxy_next_upstream)
        ↓
X-Backend: B
```

![Failover](screenshots/failover.png)

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| `dig` returns nothing | `sudo brew services list` shows dnsmasq `started`; config has the right `NGINX_IP` |
| `curl` can't resolve the domain | Client DNS is set to `MAC1_IP` (`scutil --dns`); dnsmasq listens on `en0`, not only `127.0.0.1` |
| `502 Bad Gateway` | Backends running? `curl http://BACKEND_A_IP:3001` from Mac 2 works? macOS firewall allows `node`? |
| `nginx: bind() to 0.0.0.0:80 failed` | Start Nginx with `sudo` |
| `SSL certificate problem` in curl | The `.crt` is not trusted on that Mac; run the `security add-trusted-cert` step. Do not use `-k` |

## Security Notes

- Private keys (`*.key`, `*.pem`), `.env` files and `node_modules/` are
  excluded via `.gitignore`.
- Real LAN IPs are replaced with placeholders.
- The certificate is self-signed and for local testing only.
