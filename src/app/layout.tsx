import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Thread Autopsy 🔬 — Find out what a thread actually says",
  description:
    "Analyze Twitter/X threads to expose AI-generated slop, filler content, and unverified claims. See the real information density of any viral thread.",
  keywords: [
    "twitter",
    "thread",
    "analysis",
    "slop",
    "AI detection",
    "content analysis",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
