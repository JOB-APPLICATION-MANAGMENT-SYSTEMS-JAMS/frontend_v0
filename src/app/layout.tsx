import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });
// Navigation voice: an italic text serif with calligraphic roots. Readable at 17px,
// distinct from the mono display face, and never used for body copy or data.
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-newsreader", display: "swap" });

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
  // data-scroll-behavior tells Next's router we opted into the CSS smooth scroll,
  // so it can suspend it during route transitions instead of warning about it
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrains.variable} ${newsreader.variable} min-h-dvh bg-background font-sans text-foreground antialiased`}>
        <div className="mesh-bg" aria-hidden />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
