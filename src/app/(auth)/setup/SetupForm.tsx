"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Step = "account" | "complete";

export default function SetupForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("account");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [appName, setAppName] = useState("Docklet");

  useEffect(() => {
    fetch("/api/app-name")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.app_name) setAppName(data.app_name); })
      .catch(() => {});
  }, []);

  async function handleCreateAdmin(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Setup failed");
        return;
      }

      setStep("complete");
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "complete") {
    return (
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card text-center">
            <div className="text-4xl mb-4">&#10003;</div>
            <h2 className="text-xl font-bold text-white mb-2">Setup Complete</h2>
            <p className="text-gray-400 mb-6">
              Your {appName} instance is ready to use.
            </p>
            <button
              onClick={() => {
                router.push("/containers");
                router.refresh();
              }}
              className="btn-primary"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">Welcome to {appName}</h1>
            <p className="text-gray-400 mt-1">Create your admin account to get started</p>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <div className="flex-1 h-1 bg-blue-600 rounded" />
            <div className="flex-1 h-1 bg-gray-700 rounded" />
          </div>

          <form onSubmit={handleCreateAdmin} className="space-y-4">
            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                Admin Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                required
                autoFocus
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_-]+"
                title="Letters, numbers, hyphens, and underscores only"
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                required
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Admin Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
