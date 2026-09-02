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
  // Header sekirite global (defans kont clickjacking, MIME-sniffing, ak
  // enjeksyon script). CSP la pèmèt Cloudflare Turnstile (CAPTCHA login) ak
  // 'unsafe-inline' pou style/script inline React/Next.js itilize deja.
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';

    // Nan localhost, CSP te kraze React (eval/HMR) — paj la afiche men anyen pa klikab.
    // Header sekirite yo rete pou production sèlman.
    if (isDev) {
      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()' },
          ],
        },
      ];
    }
    const scriptSrc = [
      "script-src 'self' 'unsafe-inline'",
      isDev ? "'unsafe-eval'" : '',
      'https://challenges.cloudflare.com',
      'https://static.cloudflareinsights.com',
    ]
      .filter(Boolean)
      .join(' ');

    const connectSrc = [
      "connect-src 'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://api.ipify.org',
      'https://api.telegram.org',
      'https://challenges.cloudflare.com',
      'https://cloudflareinsights.com',
      isDev ? 'ws://localhost:* http://localhost:*' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      connectSrc,
      "frame-src https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // camera=(self): obligatwa pou verifikasyon liveness KYC la
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig; // <-- SÈLMAN SA