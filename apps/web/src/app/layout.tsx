import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Regalvest 2.0 — One Platform. Borderless Possibilities.",
  description:
    "Explore the vision for Regalvest 2.0, a connected financial platform designed for African individuals and businesses. Join the pre-launch waitlist.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
