/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['geoip-lite'],
  },
  async headers() {
    return [
      {
        source: '/widget.js',
        headers: [
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
