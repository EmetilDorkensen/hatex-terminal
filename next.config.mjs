/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'imgur.com' },
      { protocol: 'https', hostname: 'moncash.sh' },
      { protocol: 'https', hostname: 'natcom.com.ht' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb', // Sa ap ranje erè 413 "Body exceeded limit" la
    },
  },
};

export default nextConfig;