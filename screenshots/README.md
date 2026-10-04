# Screenshots Directory

This directory contains visual verification evidence for Project 2 evaluation.

### Required Screenshots:

1. **`dns-resolution.png`**:
   - Evidence: Terminal showing DNS query resolution:
     ```bash
     dig app.teamX.test
     ```
     Demonstrating resolution to the Mac 2 (Nginx) IP address.

2. **`https-working.png`**:
   - Evidence: Terminal showing HTTP to HTTPS 301 redirection:
     ```bash
     curl -I http://app.teamX.test:8080/
     ```
     Showing `HTTP/1.1 301 Moved Permanently` and `Location: https://app.teamX.test:8443/`.

3. **`load-balancing.png`**:
   - Evidence: Alternating response headers and bodies demonstrating round-robin load distribution:
     - Request 1: `X-Backend: A` / `Hello from Backend A`
     - Request 2: `X-Backend: B` / `Hello from Backend B`

4. **`api-status.png`**:
   - Evidence: JSON responses from the `/api/status` route:
     - `{"backend":"A","status":"healthy"}`
     - `{"backend":"B","status":"healthy"}`

5. **`failover.png`**:
   - Evidence: Demonstration of high availability:
     - Backend A process stopped on Mac 3
     - Request sent to Nginx reverse proxy
     - Successful response returned from `X-Backend: B` without error
