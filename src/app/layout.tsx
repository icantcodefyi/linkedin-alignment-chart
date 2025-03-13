import type React from "react";
import { Providers } from "./providers";
import "./globals.css";
import { Geist } from "next/font/google";

const font = Geist({
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  generator: "v0.dev",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={font.className}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
