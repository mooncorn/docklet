"use client";

import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [certMessage, setCertMessage] = useState("");
  const certRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  // Restart state
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartMessage, setRestartMessage] = useState("");

  // Revert-to-self-signed state
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [reverting, setReverting] = useState(false);

  const fetchSettings = useCallback(async function () {
    try {
      const res = await fetch("/api/settings");
      if (res.status === 403) {
        router.replace("/containers");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setMessage("Settings saved successfully.");
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to save settings.");
      }
    } catch {
      setMessage("An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCertUpload(e: FormEvent) {
    e.preventDefault();
    setCertMessage("");

    const certFile = certRef.current?.files?.[0];
    const keyFile = keyRef.current?.files?.[0];

    if (!certFile || !keyFile) {
      setCertMessage("Both certificate and key files are required.");
      return;
    }

    const formData = new FormData();
    formData.append("cert", certFile);
    formData.append("key", keyFile);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setCertMessage(data.message);
        fetchSettings();
      } else {
        setCertMessage(data.error || "Upload failed.");
      }
    } catch {
      setCertMessage("An error occurred.");
    }
  }

  async function handleRevert() {
    setReverting(true);
    setCertMessage("");
    try {
      const res = await fetch("/api/settings", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setCertMessage(data.message);
        fetchSettings();
      } else {
        setCertMessage(data.error || "Failed to revert certificate.");
      }
    } catch {
      setCertMessage("An error occurred.");
    } finally {
      setReverting(false);
      setShowRevertConfirm(false);
    }
  }

  async function handleRestart() {
    setRestarting(true);
    setRestartMessage(`Restarting ${settings.app_name || "Docklet"}...`);
    setShowRestartConfirm(false);

    try {
      await fetch("/api/system/restart", { method: "POST" });
    } catch {
      // Expected: the process exits before the response fully arrives
    }

    // Poll /api/health until the server comes back up
    const deadline = Date.now() + 60_000;
    const poll = async () => {
      if (Date.now() > deadline) {
        setRestartMessage(
          `${settings.app_name || "Docklet"} did not restart within 60 seconds. Check that your Docker container has a restart policy set.`
        );
        setRestarting(false);
        return;
      }
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          window.location.reload();
          return;
        }
      } catch {
        // Server not yet back; keep polling
      }
      setTimeout(poll, 2000);
    };
    setTimeout(poll, 2000);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    );
  }

  const certType = settings.tls_cert_type;
  const isCustomCert = certType === "custom";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* General Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">General</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="app-name" className="block text-sm font-medium text-gray-300 mb-1">
                Application Name
              </label>
              <input
                id="app-name"
                type="text"
                value={settings.app_name || ""}
                onChange={(e) =>
                  setSettings({ ...settings, app_name: e.target.value })
                }
                className="input-field max-w-md"
              />
            </div>

            {message && (
              <p data-testid="success-message" className="text-sm text-green-400">{message}</p>
            )}

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </form>
        </div>

        {/* TLS Certificates */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">TLS Certificates</h2>
          <p className="text-sm text-gray-400 mb-4">
            Upload a custom TLS certificate and private key for your domain.
            A self-signed certificate is generated automatically on first run.
            A container restart is required after uploading new certificates.
          </p>

          {/* Current cert status */}
          {isCustomCert ? (
            <div className="bg-green-900/30 border border-green-700 text-green-300 px-4 py-2 rounded-lg text-sm mb-4">
              Custom TLS certificate is configured.
            </div>
          ) : null}

          <form onSubmit={handleCertUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Certificate File (cert.pem)
              </label>
              <input
                ref={certRef}
                type="file"
                accept=".pem,.crt,.cert"
                className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-700 file:text-white hover:file:bg-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Private Key File (key.pem)
              </label>
              <input
                ref={keyRef}
                type="file"
                accept=".pem,.key"
                className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-700 file:text-white hover:file:bg-gray-600"
              />
            </div>

            <button type="submit" className="btn-primary">
              Upload Certificate
            </button>
          </form>

          {/* Revert to self-signed (only shown when a custom cert is active) */}
          {isCustomCert && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <h3 className="text-sm font-semibold text-gray-200 mb-1">Revert to Self-Signed Certificate</h3>
              <p className="text-sm text-gray-400 mb-3">
                Remove the custom certificate and return to the auto-generated self-signed certificate.
              </p>
              <button
                className="btn-secondary"
                onClick={() => setShowRevertConfirm(true)}
                disabled={reverting}
              >
                {reverting ? "Reverting..." : "Revert to Self-Signed"}
              </button>
            </div>
          )}

          {certMessage && (
            <p className="text-sm text-blue-400 mt-4">{certMessage}</p>
          )}
        </div>

        {/* System */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">System</h2>
          <p className="text-sm text-gray-400 mb-4">
            Restart {settings.app_name || "Docklet"} to apply certificate changes or configuration updates.
            Requires Docker restart policy{" "}
            <code className="bg-gray-700 px-1 rounded text-xs">--restart=unless-stopped</code>.
          </p>

          {restarting ? (
            <div className="flex items-center gap-3">
              <div className="spinner" />
              <span className="text-sm text-gray-300">{restartMessage}</span>
            </div>
          ) : (
            <>
              {restartMessage && (
                <p className="text-sm text-yellow-400 mb-3">{restartMessage}</p>
              )}
              <button
                className="btn-danger"
                onClick={() => setShowRestartConfirm(true)}
              >
                Restart {settings.app_name || "Docklet"}
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showRevertConfirm}
        onClose={() => setShowRevertConfirm(false)}
        onConfirm={handleRevert}
        title="Revert to Self-Signed Certificate"
        message={`This will remove your custom certificate and regenerate a self-signed one. Restart ${settings.app_name || "Docklet"} to apply.`}
        confirmText="Revert"
        loading={reverting}
      />

      <ConfirmDialog
        open={showRestartConfirm}
        onClose={() => setShowRestartConfirm(false)}
        onConfirm={handleRestart}
        title={`Restart ${settings.app_name || "Docklet"}`}
        message={`${settings.app_name || "Docklet"} will restart immediately. You will be reconnected automatically once it comes back up. Make sure your Docker container has a restart policy set.`}
        confirmText="Restart"
      />
    </div>
  );
}
