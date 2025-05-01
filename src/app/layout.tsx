import type { Metadata } from "next";
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font'
import "./globals.css";


export const metadata: Metadata = {
  title: "Nupco Smart Consulting Advisor",
  description: "每个应用都应该有一个自己的Chat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
