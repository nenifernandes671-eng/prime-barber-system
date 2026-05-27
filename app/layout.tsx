import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NexBarber",
  description: "Sistema SaaS para barbearias",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "NexBarber",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/nexbarber-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/nexbarber-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/nexbarber-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070A12",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
  {children}
</body>
    </html>
  );
}
