import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoThai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BDO LifeSkill Studio — คำนวณกำไรแปรธาตุ/ทำอาหาร (Asia)",
  description: "คำนวณต้นทุน กำไร และ ROI ของสูตร Life Skill จากราคาตลาดกลางเซิร์ฟเวอร์ Asia แบบสด ๆ",
  manifest: "/manifest.webmanifest",
  applicationName: "BDO LifeSkill Studio",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "LifeSkill" },
  icons: {
    icon: [{ url: "/icons/app-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/app-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1115",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${notoThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
