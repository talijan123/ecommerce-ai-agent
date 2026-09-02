/** @type {import('next').NextConfig} */
const rawBackendUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_URL ||
  '';
const backendUrl = rawBackendUrl.replace(/\/+$/, '');

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (backendUrl && backendUrl.startsWith('http')) {
      return [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
        {
          source: '/health',
          destination: `${backendUrl}/health`,
        },
        {
          source: '/chat/:path*',
          destination: `${backendUrl}/chat/:path*`,
        },
        {
          source: '/whatsapp/:path*',
          destination: `${backendUrl}/whatsapp/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
