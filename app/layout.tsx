import type { Metadata } from "next";
import { Fraunces, Sofia_Sans } from "next/font/google";
import "./globals.css";

// Sofia Sans is the closest free Google Fonts analog to Wayfair's licensed Sofia Pro.
const sofia = Sofia_Sans({
  variable: "--font-sofia",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Wayfair Delivery Updates",
  description: "Your delivery coordinator, in your pocket.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sofia.variable} ${fraunces.variable} h-full antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
