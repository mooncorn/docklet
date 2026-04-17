import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getSetting } from "@/lib/config";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const appName = getSetting("app_name") ?? "Docklet";
  return {
    title: appName,
    description: "Self-hosted Docker container & file management",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} h-full antialiased`}>
      <body className="h-full bg-gray-900">{children}</body>
    </html>
  );
}
