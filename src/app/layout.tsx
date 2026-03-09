import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "RecallRadar — Vehicle Recall Safety Database",
  description:
    "Search thousands of vehicle recalls from the NHTSA database. Get plain-English explanations of safety issues and find free dealer repairs.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://recallradar.com",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-white text-gray-900">
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
