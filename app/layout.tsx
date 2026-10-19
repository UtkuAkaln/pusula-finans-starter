import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Pusula — Kişisel finans alanın",
  description:
    "Paranın yönünü bil. Kişisel gelir, harcama ve hedeflerini tek bir yerde yönet.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
