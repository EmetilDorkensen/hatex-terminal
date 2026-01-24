// Nan app/layout.tsx
import "./globals.css"; // Liy sa a te manke, se li ki pote tout style yo!

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ht">
      {/* Nou ajoute "antialiased" ak font si w genyen l, men globals.css se kle a */}
      <body className="antialiased bg-[#0a0b14] text-white">
        {children}
      </body>
    </html>
  );
}
