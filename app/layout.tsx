import type { Metadata } from "next";
import {
  Anton,
  Geist,
  Geist_Mono,
  Instrument_Serif,
  Saira_Condensed,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

// Self-hosted via next/font so the video capturer can embed them —
// cross-origin Google Fonts stylesheets are unreadable to it and the
// recorded card falls back to wider system fonts, clipping the name.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});
const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});
const sairaCondensed = Saira_Condensed({
  weight: "800",
  subsets: ["latin"],
  variable: "--font-saira-condensed",
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://wccard.xyz";

const title = "Holo Card Studio";
const description =
  "Design your holographic World Cup 2026 trading card — upload a photo, pick your country, and download a free holo video.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: title,
  keywords: [
    "World Cup 2026",
    "holographic card",
    "trading card",
    "soccer",
    "football",
    "holo video",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: title,
    title,
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  appleWebApp: {
    title,
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

const fontVars = [
  geist.variable,
  geistMono.variable,
  anton.variable,
  instrumentSerif.variable,
  sairaCondensed.variable,
].join(" ");

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fontVars}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
