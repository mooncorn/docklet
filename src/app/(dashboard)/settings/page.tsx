"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [certMessage, setCertMessage] = useState("");
  const certRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } finally {
      setLoading(false);
    }
  }

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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* General Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">General</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Application Name
              </label>
              <input
                type="text"
                value={settings.app_name || ""}
                onChange={(e) =>
                  setSettings({ ...settings, app_name: e.target.value })
                }
                className="input-field max-w-md"
              />
            </div>

            {message && (
              <p className="text-sm text-green-400">{message}</p>
            )}

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </form>
        </div>

        {/* TLS Certificate Upload */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">TLS Certificates</h2>
          <p className="text-sm text-gray-400 mb-4">
            Upload TLS certificate and private key to enable HTTPS.
            A container restart is required after uploading new certificates.
          </p>

          {settings.tls_enabled === "true" && (
            <div className="bg-green-900/30 border border-green-700 text-green-300 px-4 py-2 rounded-lg text-sm mb-4">
              TLS is enabled. Certificates are configured.
            </div>
          )}

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

            {certMessage && (
              <p className="text-sm text-blue-400">{certMessage}</p>
            )}

            <button type="submit" className="btn-primary">
              Upload Certificates
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
