/**
 * @file layout.tsx
 * @description Root layout for EyeJockey. Sets up Geist fonts, dark background,
 *              and application metadata.
 */

import type { Metadata } from "next";
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
  title: "EyeJockey — AI Teleprompter",
  description:
    "An AI-powered teleprompter that tracks your speech in real time using Deepgram, adapting scroll speed to your natural reading pace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        style={{ backgroundColor: '#0a0a0a' }}
      >
        {children}
      </body>
    </html>
  );
}
