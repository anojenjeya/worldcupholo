import type { Metadata } from "next";
import {
  Anton,
  Geist,
  Geist_Mono,
  Instrument_Serif,
  Saira_Condensed,
} from "next/font/google";
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

export const metadata: Metadata = {
  title: "Holo Card Studio — World Cup 2026",
  description:
    "Design your holographic World Cup 2026 trading card, download a 10s holo video for $2, and support youth soccer through San Francisco Youth Soccer.",
  openGraph: {
    title: "Holo Card Studio — World Cup 2026",
    description:
      "Create a personalized holo card, download your video, and support youth soccer.",
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
      <body>{children}</body>
    </html>
  );
}
