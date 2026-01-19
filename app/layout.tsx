// Nan app/layout.tsx

export const metadata = {
  title: "HATEXCARD",
  description: "Tèminal Peman Pwofesyonèl",
  icons: {
    icon: [
      {
        url: "/logo.png", // Asire w foto a rele logo.png epi li nan folder public la
        href: "/logo.png",
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
      <body className="antialiased bg-[#0a0b14]">
        {children}
      </body>
    </html>
  );
}
