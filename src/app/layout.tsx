import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Vitrine360 — Digital Display & Presentation Platform",
  description:
    "Create, distribute, play and control digital content across displays and interactive devices.",
};

const SMART_TV_GLOBAL_BOOT = `
(function(){
  try {
    var ua = navigator.userAgent || "";
    var isSmartTV = /Sraf|Web0S|Tizen|SmartTV|NetRange|HbbTV|Maple|Viera|Hisense|VIDAA/i.test(ua);
    var isForceTv = /[?&]tv=1(?:&|$)/.test(location.search);
    if (isSmartTV || isForceTv) {
      if (location.pathname === "/" || location.pathname === "") {
        location.replace("/home-lite.html");
      } else if (location.pathname.indexOf("/player") === 0) {
        location.replace("/tv.html?v=055");
      }
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt">
      <head>
        <script dangerouslySetInnerHTML={{ __html: SMART_TV_GLOBAL_BOOT }} />
      </head>
      <body className={`${sans.variable} ${display.variable} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
