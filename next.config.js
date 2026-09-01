/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['geoip-lite'],
  },
};

module.exports = nextConfig;
