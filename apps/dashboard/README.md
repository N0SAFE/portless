# @portless/dashboard

Next.js dashboard over the portless daemon control plane.

Shows:

- daemon / proxy health
- registered routes
- running apps (status, url, provider)
- registered providers/plugins
- a **live SSE event stream** (`/api/v1/events`)

## Run

```bash
bun run dev           # http://localhost:3000
```

The server-side data layer reads `PORTLESS_DAEMON_URL` (default
`http://127.0.0.1:4711`); the browser SSE stream uses
`NEXT_PUBLIC_PORTLESS_DAEMON_URL` / `NEXT_PUBLIC_PORTLESS_DAEMON_PORT`.
Set `PORTLESS_DAEMON_URL=http://daemon:4711` when running in Docker.
