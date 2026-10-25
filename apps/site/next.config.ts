import type { NextConfig } from 'next';

const config: NextConfig = {
  // O @elaps/core é TypeScript puro do workspace (main aponta para src/index.ts).
  transpilePackages: ['@elaps/core'],
  // As fontes da imagem de prévia são lidas do disco em tempo de execução.
  outputFileTracingIncludes: { '/s/[token]/*': ['./assets/og-fonts/**'] },
};

export default config;
