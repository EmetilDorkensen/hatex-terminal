import { headers } from 'next/headers';
import "./globals.css";
import AutoLogout from "./components/AutoLogout";

export const metadata = {
  title: "HatexCard",
  description: "Tèminal Peman Pwofesyonèl",
  icons: {
    icon: [
      {
        url: "/logo-hatex.png",
        href: "/logo-hatex.png",
      },
    ],
  },
};

/**
 * Li x-nonce nan headers — fòse dynamic rendering pou Next.js kapab
 * mete nonce sou script framework yo (CSP san 'unsafe-inline' nan script-src).
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const nonce = headerStore.get('x-nonce') ?? undefined;

  return (
    <html lang="ht">
      <body className="antialiased bg-[#0a0b14] text-white" data-nonce={nonce || undefined}>
        <AutoLogout />
        {children}
      </body>
    </html>
  );
}
