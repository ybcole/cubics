"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { MultisessionAppSupport } from "@clerk/nextjs/internal";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.variable} font-sans bg-white text-zinc-900 antialiased`}>
          <MultisessionAppSupport>{children}</MultisessionAppSupport>
        </body>
      </html>
    </ClerkProvider>
  );
}
