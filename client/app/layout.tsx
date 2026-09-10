import type { Metadata } from "next";

import "./globals.css";

import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "DojoFlow | Karate Academy Management",
  description:
    "Manage students, plans, attendance, performance and belt progression.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}