import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LaunchNest — Build it. Deploy it. Own the web.",
  description: "Turn an idea into a live website in minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
