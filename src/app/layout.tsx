import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "The Rebuild | 36 Weeks. One Complete Rebuild.",
    description: "A 36-week strength, nutrition, and discipline system built to create a powerful, athletic physique.",
    manifest: "/manifest.json",
    icons: { icon: "/icon.svg", apple: "/icon.svg" },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url: origin,
      title: "The Rebuild",
      description: "Build the frame. Earn the presence. A complete 36-week physical rebuild.",
      images: [{ url: `${origin}/og-v2.png`, width: 1728, height: 907, alt: "The Rebuild — 36 weeks. One complete rebuild." }],
    },
    twitter: { card: "summary_large_image", title: "The Rebuild", description: "Build the frame. Earn the presence.", images: [`${origin}/og-v2.png`] },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#07111C" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${inter.variable} ${anton.variable}`}><body>{children}</body></html>;
}
