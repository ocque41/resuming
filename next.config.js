/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    ppr: false
  },
  serverExternalPackages: [
    'pdf-parse', 
    'pg', 
    'pg-connection-string', 
    'dotenv', 
    'pgpass'
  ],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      crypto: false
    };
    return config;
  }
};

module.exports = nextConfig;
