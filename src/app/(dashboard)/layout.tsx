"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appName, setAppName] = useState("Docklet");

  useEffect(() => {
    fetch("/api/app-name")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.app_name) setAppName(data.app_name); })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <Sidebar
        userRole={user?.role}
        appName={appName}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          username={user?.username}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          onLogout={logout}
        />
        <main className="content-area nice-scrollbar">
          <div className="content-container">{children}</div>
        </main>
      </div>
    </div>
  );
}
