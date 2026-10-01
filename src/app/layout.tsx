import { APP_NAME, APP_SHORT } from "@/lib/brand";
import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const notoThai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} — คำนวณกำไรแปรธาตุ/ทำอาหาร (Asia)`,
  description: "คำนวณต้นทุน กำไร และ ROI ของสูตร Life Skill จากราคาตลาดกลางเซิร์ฟเวอร์ Asia แบบสด ๆ",
  manifest: "/manifest.webmanifest",
  applicationName: APP_NAME,
  // members-only guild tool: keep it out of search engines
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: APP_SHORT },
  icons: {
    icon: [{ url: "/icons/app-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/app-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1115",
  // draw edge to edge on notched phones; globals.css pads the body and the tab bar by the safe areas
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // render every page per request (the pages already are; this also covers the built-in 404),
  // so each one carries the CSP nonce that src/proxy.ts puts on the request
  await connection();
  return (
    <html lang="th" className={`${notoThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
