
import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://anjivo.online";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default:
      "ANJIVO - Online Shopping, Wholesale & Retail Marketplace",
    template: "%s | ANJIVO",
  },

  description:
    "Shop online at ANJIVO. Explore fashion, clothing, footwear, beauty, electronics, home essentials and more. Discover retail and wholesale products at ANJIVO.",

  applicationName: "ANJIVO",

  keywords: [
    "ANJIVO",
    "online shopping India",
    "online shopping marketplace",
    "wholesale marketplace India",
    "retail marketplace",
    "fashion online shopping",
    "clothing online",
    "wholesale clothing",
    "buy products online",
  ],

  authors: [
    {
      name: "ANJIVO",
      url: SITE_URL,
    },
  ],

  creator: "ANJIVO",
  publisher: "ANJIVO",

  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: "ANJIVO",
    title:
      "ANJIVO - Online Shopping, Wholesale & Retail Marketplace",
    description:
      "Discover fashion, clothing, electronics, beauty, home essentials and more on ANJIVO.",
    images: [
      {
        url: "/logo/anjivo-logo.png",
        width: 512,
        height: 512,
        alt: "ANJIVO Online Marketplace",
      },
    ],
  },

  twitter: {
    card: "summary",
    title: "ANJIVO - Online Shopping Marketplace",
    description:
      "Shop retail and wholesale products online at ANJIVO.",
    images: ["/logo/anjivo-logo.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
