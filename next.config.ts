import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Filesystem reads are dynamic: retain WASM and approved data in server traces.
  outputFileTracingIncludes: {
    '/*': ['./node_modules/@fusionstrings/swiss-eph/wasm/swiss_eph.wasm', './data/ephemeris/*'],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    };
    return config;
  },
};

export default nextConfig;
