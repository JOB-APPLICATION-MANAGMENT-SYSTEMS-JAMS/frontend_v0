import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "JAMS", template: "%s | JAMS" },
  description: "Personal, human-in-the-loop command centre for a high-volume job hunt: discovery, tracker, CV studio, cold email, streaks and honest analytics.",
  applicationName: "JAMS",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0e0d" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrains.variable} min-h-dvh bg-background font-sans text-foreground antialiased`}>
        <div className="mesh-bg" aria-hidden />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
