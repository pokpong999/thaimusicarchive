/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: 'img.youtube.com' }] },
  experimental: {
    serverComponentsExternalPackages: ['@resvg/resvg-js', 'satori', 'harfbuzzjs'],
    outputFileTracingIncludes: {
      '/songs/[id]/opengraph-image': ['./assets/*.ttf'],
      '/archive/[id]/opengraph-image': ['./assets/*.ttf'],
    },
  },
};

module.exports = nextConfig;
