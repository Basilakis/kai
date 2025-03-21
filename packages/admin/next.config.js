/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@kai/shared'],
  images: {
    domains: [
      'localhost',
      'kai-storage.s3.us-east-1.amazonaws.com',
      'kai-storage.s3.amazonaws.com'
    ],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: true,
      },
    ];
  },
  webpack(config) {
    // Allow importing SVG files as React components
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },
};

module.exports = nextConfig;