/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

export default nextConfig;