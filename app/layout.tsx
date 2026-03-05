import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Seeknimbly HR — North America Compliance",
  description: "HR compliance chat assistant for North America (CA/US/NA)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen text-[15px] leading-[1.47] bg-[#000] text-[rgba(255,255,255,0.95)]">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
