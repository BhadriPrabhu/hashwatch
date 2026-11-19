import { useState, useEffect } from "react";

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("hashwatch_key") || "");
  const [showConfig, setShowConfig] = useState(() => !localStorage.getItem("hashwatch_key"));
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState({ text: "", isError: false });
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);

  // Add target form state
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("body");
  const [topic, setTopic] = useState("general");
  const [keywords, setKeywords] = useState("");
  const [useProxy, setUseProxy] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTargets = async (key = apiKey) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    localStorage.setItem("hashwatch_key", trimmed);
    setLoading(true);
    try {
      const res = await fetch("/api/targets", {
        headers: { "x-api-key": trimmed },
      });
      if (!res.ok) throw new Error("Unauthorized — verify your PROXY_SECRET.");
      const data = await res.json();
      setTargets(data);
      setConnected(true);
      setShowConfig(false);
      setStatus({ text: "", isError: false });
    } catch (err) {
      setConnected(false);
      setShowConfig(true);
      setStatus({ text: err.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiKey) loadTargets(apiKey);
  }, []);

  const addTarget = async (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      setStatus({ text: "Target name and URL are required.", isError: true });
      return;
    }

    setSaving(true);
    setStatus({ text: "", isError: false });
    try {
      const res = await fetch("/api/targets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
        },
        body: JSON.stringify({
          name,
          url,
          selector,
          topic,
          keywords,
          use_proxy: useProxy,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to add target.");
      }

      setName("");
      setUrl("");
      setSelector("body");
      setTopic("general");
      setKeywords("");
      setUseProxy(true);
      setStatus({ text: "Target added. It will be checked on the next cron run.", isError: false });
      loadTargets(apiKey);
    } catch (err) {
      setStatus({ text: err.message, isError: true });
    } finally {
      setSaving(false);
    }
  };

  const deleteTarget = async (id) => {
    setTargets((prev) => prev.filter((t) => t.id !== id));
    await fetch("/api/targets", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
      },
      body: JSON.stringify({ id }),
    });
  };

  return (
    <div className="shell">
      <header className="header">
        <div className="brand">
          <h1>HashWatch</h1>
          <span className="badge">
            <span className={`dot ${connected ? "active" : ""}`} />
            {connected ? "connected" : "locked"}
          </span>
        </div>

        <div className="header-actions">
          <button className="btn" onClick={() => loadTargets()} disabled={loading || !apiKey}>
            {loading ? "Syncing..." : "Refresh"}
          </button>
          <button className="btn" onClick={() => setShowConfig((v) => !v)}>
            {showConfig ? "Close" : "Settings"}
          </button>
        </div>
      </header>

      {showConfig && (
        <section className="panel">
          <label className="panel-label" htmlFor="proxy-secret">
            Proxy Secret
          </label>
          <div className="input-row">
            <input
              id="proxy-secret"
              type="password"
              className="input"
              placeholder="Enter PROXY_SECRET"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button className="btn btn-primary" onClick={() => loadTargets()}>
              Connect
            </button>
          </div>
        </section>
      )}

      {connected && (
        <form className="composer" onSubmit={addTarget}>
          <span className="panel-label" style={{ marginBottom: 0 }}>
            Add Target
          </span>
          <div className="composer-row">
            <input
              type="text"
              className="input"
              placeholder="Name (e.g. SIH 2026)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="url"
              className="input"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <div className="composer-row">
            <input
              type="text"
              className="input"
              placeholder="CSS Selector (default: body)"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
            />
            <input
              type="text"
              className="input"
              placeholder="PingBox topic (e.g. sih-alert)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <input
            type="text"
            className="input"
            placeholder="Keywords (comma-separated, optional)"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
          <div className="composer-actions">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useProxy}
                onChange={(e) => setUseProxy(e.target.checked)}
              />
              Use Mumbai proxy (bom1)
            </label>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Add Target"}
            </button>
          </div>
        </form>
      )}

      {status.text && (
        <div className={`notice ${status.isError ? "error" : ""}`}>{status.text}</div>
      )}

      <div className="feed-header">
        <span className="feed-title">Monitored Targets ({targets.length})</span>
      </div>

      {targets.length === 0 ? (
        <div className="empty">No targets configured yet.</div>
      ) : (
        <div className="feed-list">
          {targets.map((t) => (
            <article key={t.id} className="feed-item">
              <div className="item-top">
                <span className="item-title">{t.name}</span>
                <button
                  className="btn-ghost-danger"
                  onClick={() => deleteTarget(t.id)}
                  title="Delete target"
                >
                  delete
                </button>
              </div>
              <a className="item-link" href={t.url} target="_blank" rel="noreferrer">
                {t.url.replace(/^https?:\/\//, "")}
              </a>
              <div className="meta-tags">
                <span className="tag">#{t.topic || "general"}</span>
                <span className="tag">selector: {t.selector || "body"}</span>
                <span className="tag">{t.use_proxy ? "proxy: bom1" : "direct"}</span>
                {t.keywords?.length > 0 && (
                  <span className="tag">kw: {t.keywords.join(", ")}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}