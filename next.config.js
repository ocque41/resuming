/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    ppr: false,
    serverComponentsExternalPackages: ['pdf-parse']
  }
};

module.exports = nextConfig;
