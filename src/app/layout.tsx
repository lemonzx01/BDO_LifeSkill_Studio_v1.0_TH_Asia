import { UsageBeacon } from "@/components/UsageBeacon";
import { APP_NAME, APP_SHORT } from "@/lib/brand";
import type { Metadata, Viewport } from "next";
import { Anuphan, Taviraj } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

// Taviraj: the serif for titles only (page h1, card titles; never under 16px or for numbers)
const display = Taviraj({
  variable: "--font-display",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

// Anuphan: everything people read and type (a variable font, so every weight comes in one file)
const body = Anuphan({
  variable: "--font-body",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} — คำนวณกำไรแปรธาตุ/ทำอาหาร (Asia)`,
  description: "คำนวณต้นทุน กำไร และ ROI ของสูตร Life Skill จากราคาตลาดกลางเซิร์ฟเวอร์ Asia แบบสด ๆ",
  manifest: "/manifest.webmanifest",
  applicationName: APP_NAME,
  // open to anyone with the link, but not meant to be found through search engines: keep it out of them
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: APP_SHORT },
  icons: {
    icon: [{ url: "/icons/app-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/app-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#12100D",
  // draw edge to edge on notched phones; globals.css pads the body and the tab bar by the safe areas
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // render every page per request (the pages already are; this also covers the 404, not-found.tsx),
  // so each one carries the CSP nonce that src/proxy.ts puts on the request
  await connection();
  return (
    <html lang="th" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        {/* counts visitors for /admin/stats (guests and members); renders nothing */}
        <UsageBeacon />
      </body>
    </html>
  );
}
