/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
      {
        source: '/health',
        destination: '/health',
      },
      {
        source: '/chat/:path*',
        destination: '/chat/:path*',
      }
    ];
  },
};

export default nextConfig;
