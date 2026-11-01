import { fetchApps, fetchHealth, fetchProviders, fetchRoutes, daemonUrl } from "@/lib/daemon";
import { LiveEvents } from "@/components/LiveEvents";

export const dynamic = "force-dynamic";

function StatusBadge({ ok, text }: { ok: boolean; text: string }) {
  return <span className={`badge ${ok ? "ok" : "err"}`}>{text}</span>;
}

export default async function DashboardPage() {
  const [health, routes, apps, providers] = await Promise.all([
    fetchHealth(),
    fetchRoutes(),
    fetchApps(),
    fetchProviders(),
  ]);

  return (
    <main>
      <div className="row">
        <h1>Portless Dashboard</h1>
        <span className="muted mono">{daemonUrl}</span>
        <StatusBadge ok={health.ok} text={health.ok ? "daemon online" : "daemon offline"} />
        {health.proxy && (
          <StatusBadge
            ok={health.proxy.running}
            text={`proxy ${health.proxy.port ?? ""}${health.proxy.tls ? " (tls)" : ""}`}
          />
        )}
      </div>

      {!health.ok && (
        <div className="card">
          <p className="muted">
            The portless daemon is not reachable at <span className="mono">{daemonUrl}</span>. Start it with{" "}
            <span className="mono">portless daemon start</span>.
          </p>
        </div>
      )}

      <h2>Routes</h2>
      <div className="card">
        {routes && routes.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Host</th>
                <th>Target</th>
                <th>Source</th>
                <th>TLS</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.host}>
                  <td className="mono">{r.host}</td>
                  <td className="mono">{r.target}</td>
                  <td>{r.source}</td>
                  <td>{r.tls ? "✓" : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No routes registered yet.</p>
        )}
      </div>

      <h2>Apps</h2>
      <div className="card">
        {apps && apps.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>URL</th>
                <th>Provider</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>
                    <StatusBadge ok={a.status === "running"} text={a.status} />
                  </td>
                  <td className="mono">{a.url}</td>
                  <td>{a.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No apps running.</p>
        )}
      </div>

      <h2>Providers (plugins)</h2>
      <div className="card">
        {providers && providers.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Kind</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.id}</td>
                  <td>{p.kind}</td>
                  <td>
                    <StatusBadge
                      ok={p.available}
                      text={p.enabled ? (p.available ? "available" : "enabled") : "disabled"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No providers registered.</p>
        )}
      </div>

      <h2>Live events</h2>
      <div className="card">
        <LiveEvents />
      </div>
    </main>
  );
}
