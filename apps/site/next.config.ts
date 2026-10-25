import type { NextConfig } from 'next';

const config: NextConfig = {
  // O @elaps/core é TypeScript puro do workspace (main aponta para src/index.ts).
  transpilePackages: ['@elaps/core'],
};

export default config;
