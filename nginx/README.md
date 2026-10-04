# Nginx Reverse Proxy & Load Balancer (Mac 2)

This directory contains the Nginx configuration for **Mac 2**, which acts as the Reverse Proxy and Load Balancer in the private network topology.

---

## Role of Mac 2

- **Reverse Proxy**: Accepts incoming client requests on behalf of internal backend services.
- **TLS Termination**: Handles HTTPS on port `443` (or `8443` for non-root) using a self-signed TLS certificate with SAN for `app.teamX.test` and `api.teamX.test`.
- **HTTP Redirection**: Automatically redirects all unencrypted HTTP traffic on port `80` (or `8080`) to secure HTTPS via HTTP `301 Moved Permanently`.
- **Round-Robin Load Balancing**: Balances traffic between Backend A (Mac 3, port `3001`) and Backend B (Mac 4, port `3002`).
- **Passive Health Check & Failover**: Configured with `max_fails=1 fail_timeout=5s` and `proxy_next_upstream` so that if Backend A is shut down or unresponsive, requests immediately and transparently fail over to Backend B.

---

## Prerequisites (macOS)

Install Nginx using Homebrew:
```bash
brew install nginx
```

Check installation:
```bash
nginx -v
```

Default Homebrew Nginx configuration path:
- Apple Silicon (M1/M2/M3/M4): `/opt/homebrew/etc/nginx/nginx.conf`
- Intel Mac: `/usr/local/etc/nginx/nginx.conf`

---

## 1. Generate SSL Certificates

Generate a self-signed RSA 2048-bit certificate with Subject Alternative Name (SAN) covering both required domains (`app.teamX.test` and `api.teamX.test`):

```bash
mkdir -p "$(brew --prefix)/etc/nginx/certs"
cd "$(brew --prefix)/etc/nginx/certs"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout teamX.key -out teamX.crt \
  -subj "/CN=app.teamX.test" \
  -addext "subjectAltName=DNS:app.teamX.test,DNS:api.teamX.test"
```

Verify certificate details:
```bash
openssl x509 -in teamX.crt -text -noout | grep -A 2 "Subject Alternative Name"
```

> **Security Note:** Private keys (`*.key`) and certificates (`*.crt`, `*.pem`) must never be committed to public Git repositories. `.gitignore` is already configured to exclude them.

---

## 2. Deploy Configuration on Mac 2

1. Copy `nginx/nginx.conf` to Homebrew's Nginx configuration directory (backup default first):
   ```bash
   cp "$(brew --prefix)/etc/nginx/nginx.conf" "$(brew --prefix)/etc/nginx/nginx.conf.backup"
   cp nginx/nginx.conf "$(brew --prefix)/etc/nginx/nginx.conf"
   ```

2. Edit `"$(brew --prefix)/etc/nginx/nginx.conf"` with your actual LAN settings:
   - Replace `BACKEND_A_IP` with the IP of Mac 3 (e.g. `10.7.16.172`).
   - Replace `BACKEND_B_IP` with the IP of Mac 4 (e.g. `10.7.19.210`).
   - Update `ssl_certificate` and `ssl_certificate_key` paths if stored outside `certs/`.

3. Test configuration syntax:
   ```bash
   sudo nginx -t
   ```

4. Start Nginx:
   ```bash
   sudo nginx
   ```
   Or reload after editing:
   ```bash
   sudo nginx -s reload
   ```

*(Note: If binding to ports 80/443, `sudo` is required by macOS. If running without root, adjust ports to `8080` and `8443` respectively.)*

---

## 3. Verification Commands

Run from Mac 1 (client) or locally on Mac 2:

### A. HTTP to HTTPS 301 Redirection
```bash
curl -I http://app.teamX.test
```
Expected output:
```http
HTTP/1.1 301 Moved Permanently
Location: https://app.teamX.test/
```

### B. HTTPS & Load Balancing (Alternating Backends)
```bash
for i in {1..4}; do
  curl -skI https://app.teamX.test | grep -i x-backend
done
```
Expected output:
```text
X-Backend: A
X-Backend: B
X-Backend: A
X-Backend: B
```

### C. API Status Endpoint
```bash
curl -sk https://api.teamX.test/api/status
```
Expected response:
```json
{"backend":"A","status":"healthy"}
```

### D. High-Availability Failover
1. Terminate Backend A on Mac 3 (`Ctrl + C`).
2. Send requests through Nginx:
   ```bash
   for i in {1..4}; do
     curl -skI https://app.teamX.test | grep -i x-backend
   done
   ```
3. Nginx detects Backend A is down and routes all requests to Backend B without errors:
   ```text
   X-Backend: B
   X-Backend: B
   X-Backend: B
   X-Backend: B
   ```
