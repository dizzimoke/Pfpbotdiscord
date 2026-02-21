// src/App.tsx
import { useMemo, useState } from "react";

export default function App() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [interval, setInterval] = useState(2);

  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const endpoint = import.meta.env.VITE_SETTINGS_ENDPOINT as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  const canSave = useMemo(() => {
    return Boolean(
      endpoint &&
        anonKey &&
        adminPassword.trim().length > 0 &&
        webhookUrl.trim().length > 0 &&
        interval >= 1
    );
  }, [endpoint, anonKey, adminPassword, webhookUrl, interval]);

  const handleSave = async () => {
    setStatus("");
    if (!endpoint) {
      setStatus("❌ Missing VITE_SETTINGS_ENDPOINT in Vercel env.");
      return;
    }
    if (!anonKey) {
      setStatus("❌ Missing VITE_SUPABASE_ANON_KEY in Vercel env.");
      return;
    }
    if (!adminPassword.trim()) {
      setStatus("❌ Admin password is required.");
      return;
    }

    setSaving(true);
    setStatus("Saving...");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          discord_webhook_url: webhookUrl,
          enabled,
          combo_interval_minutes: interval,
        }),
      });

      const raw = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(raw);
      } catch {
        // keep raw
      }

      if (res.ok) {
        setStatus("✅ Settings saved! Bot will run on next schedule.");
      } else {
        const msg =
          data?.error ||
          data?.message ||
          raw ||
          `Request failed (HTTP ${res.status})`;
        setStatus(`❌ ${msg}`);
      }
    } catch (err: any) {
      setStatus(`❌ Network error: ${err?.message || String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b12",
        color: "#eaeaf2",
        padding: 24,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontSize: 44, lineHeight: 1.05, margin: "10px 0 6px" }}>
          Anime Auto-Poster
        </h1>
        <p style={{ opacity: 0.7, marginTop: 0 }}>
          Automated Discord webhook bot for anime icons & banners
        </p>

        <div
          style={{
            marginTop: 18,
            padding: 18,
            borderRadius: 18,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, opacity: 0.7 }}>ADMIN PASSWORD</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Admin Password"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, opacity: 0.7 }}>
                DISCORD WEBHOOK URL
              </label>
              <input
                type="password"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                style={inputStyle}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingTop: 6,
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Bot Enabled</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>
                  Turn on/off posting
                </div>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ transform: "scale(1.3)" }}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Interval (Minutes)</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>
                  Must match your cron schedule
                </div>
              </div>
              <input
                type="number"
                min={1}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                style={{
                  ...inputStyle,
                  width: 90,
                  textAlign: "center",
                  padding: "10px 10px",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: !canSave || saving ? "rgba(120,90,255,0.25)" : "#5a3dff",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: !canSave || saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
              <button
                onClick={async () => {
                  setStatus("");
                  if (!endpoint || !anonKey || !adminPassword.trim()) {
                    setStatus("❌ Missing configuration or admin password.");
                    return;
                  }
                  setSaving(true);
                  setStatus("Stopping bot...");
                  try {
                    const res = await fetch(endpoint, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${anonKey}`,
                        apikey: anonKey,
                        "x-admin-password": adminPassword,
                      },
                      body: JSON.stringify({
                        discord_webhook_url: webhookUrl,
                        enabled: false,
                        combo_interval_minutes: interval,
                      }),
                    });
                    const raw = await res.text();
                    let data: any = {};
                    try { data = JSON.parse(raw); } catch {}
                    if (res.ok) {
                      setEnabled(false);
                      setStatus("✅ Bot stopped successfully");
                    } else {
                      const msg = data?.error || data?.message || raw || `Request failed (HTTP ${res.status})`;
                      setStatus(`❌ ${msg}`);
                    }
                  } catch (err: any) {
                    setStatus(`❌ Network error: ${err?.message || String(err)}`);
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={!canSave || saving}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: !canSave || saving ? "rgba(255,70,70,0.15)" : "rgba(255,70,70,0.3)",
                  color: "#ff9b9b",
                  fontWeight: 800,
                  cursor: !canSave || saving ? "not-allowed" : "pointer",
                }}
              >
                Stop Bot
              </button>
            </div>

            {status && (
              <div
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 12,
                  background:
                    status.startsWith("✅")
                      ? "rgba(0, 200, 120, 0.12)"
                      : "rgba(255, 70, 70, 0.12)",
                  border: status.startsWith("✅")
                    ? "1px solid rgba(0, 200, 120, 0.22)"
                    : "1px solid rgba(255, 70, 70, 0.22)",
                  color: status.startsWith("✅") ? "#6ff0b2" : "#ff9b9b",
                  fontWeight: 700,
                  whiteSpace: "pre-wrap",
                }}
              >
                {status}
              </div>
            )}

            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
              Tip: If you still get errors, open Supabase → Edge Functions → update-settings → Logs
              and paste the error text here.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18, fontSize: 12, opacity: 0.6 }}>
          <div>Using endpoint:</div>
          <div style={{ wordBreak: "break-all", opacity: 0.8 }}>
            {endpoint || "(missing VITE_SETTINGS_ENDPOINT)"}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "#fff",
  outline: "none",
};