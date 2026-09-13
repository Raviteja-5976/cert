import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Claim your certificate | DevTrackAcademy",
    template: "%s | DevTrackAcademy",
  },
  description: "Claim, download and verify your DevTrackAcademy workshop certificate.",
  openGraph: {
    title: "Claim your certificate | DevTrackAcademy",
    description: "Claim, download and verify your DevTrackAcademy workshop certificate.",
    siteName: "DevTrackAcademy",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#FFF8F0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
