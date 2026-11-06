/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['geoip-lite'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        source: '/widget.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' }
        ],
      },
      {
        source: '/widget',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' }
        ],
      }
    ];
  },
  async redirects() {
    return [
      {
        source: '/livechat',
        destination: '/dashboard/chats',
        permanent: false,
      },
      {
        source: '/chats',
        destination: '/dashboard/chats',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
