import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portless Dashboard",
  description: "Live view of the portless daemon: routes, apps, and providers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
