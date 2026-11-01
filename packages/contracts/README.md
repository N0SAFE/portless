# @portless/contracts

Shared, framework-agnostic types for the portless **control-plane REST API**
(the daemon API consumed by the CLI, dashboard, and agents).

## Endpoints

| Resource | Methods |
| --- | --- |
| `/api/v1/health` | GET |
| `/api/v1/routes` | GET, POST (alias), DELETE |
| `/api/v1/apps` | GET, POST (start), POST `/:id/stop` |
| `/api/v1/projects` | GET |
| `/api/v1/hosts` | GET, POST `sync`, POST `clean` |
| `/api/v1/config` | GET, PUT |
| `/api/v1/plugins` | GET |
| `/api/v1/certs` | GET, POST `trust` |
| `/api/v1/proxy` | POST `start`, POST `stop` |
| `/api/v1/events` | SSE |

Depend on this from the CLI, dashboard, and daemon to stay in sync. `API_PATHS`
is an exported path table.
