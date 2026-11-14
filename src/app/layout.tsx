"use client";

import { ClerkProvider } from "@clerk/nextjs";
import DesktopBrowserAccountBoundary from "@/components/DesktopBrowserAccountBoundary";
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
        <body className={`${inter.variable} font-sans bg-canvas text-fg antialiased`}>
          <MultisessionAppSupport>
            <DesktopBrowserAccountBoundary />
            {children}
          </MultisessionAppSupport>
        </body>
      </html>
    </ClerkProvider>
  );
}
