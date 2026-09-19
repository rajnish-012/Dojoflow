import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import ThemeProvider from "@/components/theme/ThemeProvider";

export const metadata: Metadata = {
  title: "DojoFlow | Karate Academy Management",
  description:
    "Manage students, plans, attendance, performance and belt progression.",

  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

const themeScript = `
(function () {
  try {
    const storedTheme = localStorage.getItem("dojoflow-theme");

    let theme;

    if (storedTheme === "light" || storedTheme === "dark") {
      theme = storedTheme;
    } else {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    const root = document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.setAttribute("data-theme", theme);
  } catch (error) {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: themeScript,
          }}
        />
      </head>

      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
