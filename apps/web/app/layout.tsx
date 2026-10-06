import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import type { ReactElement, ReactNode } from "react";
import { isClerkConfigured } from "../src/auth/clerk-config";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlgoCove | Deliberate DSA practice",
  icons: { icon: "/icon.svg" },
  description: "A calm workspace for learning data structures and algorithms.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): ReactElement {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const content =
    !isClerkConfigured() || publishableKey === undefined ? (
      children
    ) : (
      <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>
    );
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/instrument-sans-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body suppressHydrationWarning>{content}</body>
    </html>
  );
}
