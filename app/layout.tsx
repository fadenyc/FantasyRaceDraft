import type { Metadata } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Fantasy Race Draft",
  description: "Live draft-order lottery for your fantasy league.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="flex flex-col items-center gap-2 py-4 text-center text-xs text-chalk-faint">
          <a
            href="https://buymeacoffee.com/fadenyc"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-turf-700 bg-turf-800/50 px-3 py-1.5 text-chalk-muted transition-colors hover:border-gold-500/50 hover:text-gold-500"
          >
            <span aria-hidden="true">☕</span>
            Buy me a coffee
          </a>
          <span>Design by FadeNYC</span>
        </footer>
      </body>
    </html>
  );
}
