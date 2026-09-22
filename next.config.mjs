/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pèmèt telefòn sou WiFi a (192.168.x) ak tinèl HTTPS (kamera KYC)
  allowedDevOrigins: [
    '127.0.0.1',
    '192.168.1.7',
    '*.trycloudflare.com',
    '*.ngrok-free.app',
    '*.ngrok.io',
    '*.loca.lt',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.imgur.com' },
      { protocol: 'https', hostname: '**.moncash.sh' },
      { protocol: 'https', hostname: '**.natcom.com.ht' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async redirects() {
    return [
      { source: '/deposit', destination: '/dashboard', permanent: false },
      { source: '/withdraw', destination: '/dashboard', permanent: false },
      { source: '/transfert', destination: '/dashboard', permanent: false },
      { source: '/kat', destination: '/dashboard', permanent: false },
      { source: '/kat/:path*', destination: '/dashboard', permanent: false },
      { source: '/agent', destination: '/dashboard', permanent: false },
      { source: '/dashboard/rechaj', destination: '/dashboard', permanent: false },
      { source: '/kyc', destination: '/kyc/v2', permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: '/api/v1/:path*',
      },
      // Pasrèl peman v2 — sa machann yo rele: https://hatexcard.com/v2/payments
      {
        source: '/v2/:path*',
        destination: '/api/v2/:path*',
      },
    ];
  },
  // CSP + HSTS + nonce kounye a nan proxy.ts (pa isit) —
  // antèt estatik isit la ta double / konflije ak nonce pa demann.
};

export default nextConfig;
