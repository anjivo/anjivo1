import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ANJIVO | Wholesale & Retail",
  description:
    "ANJIVO is a wholesale and retail ecommerce marketplace."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
