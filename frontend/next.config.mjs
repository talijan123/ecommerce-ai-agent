/** @type {import('next').NextConfig} */
const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy API routes in local dev or standalone deployments when backendUrl is defined
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
      ];
    }
    return [];
  },
};

export default nextConfig;
