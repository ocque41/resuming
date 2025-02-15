/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    ppr: false
  },
  serverExternalPackages: ['pdf-parse']
};

module.exports = nextConfig;
