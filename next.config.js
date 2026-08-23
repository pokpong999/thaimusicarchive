/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: 'img.youtube.com' }] },
  experimental: {
    serverComponentsExternalPackages: ['@resvg/resvg-js', 'satori', 'harfbuzzjs'],
  },
};

module.exports = nextConfig;
