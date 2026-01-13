import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HATEXCARD - Tèminal Peman",
  description: "Sistèm tèminal peman HatexCard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ht">
      <body className="antialiased bg-[#0a0b14]">
        {children}
      </body>
    </html>
  );
}