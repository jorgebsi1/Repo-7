import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Los paquetes del monorepo se compilan a dist/ antes (pnpm build); aquí solo se consumen.
  transpilePackages: ['@prolac/domain', '@prolac/ui-tokens'],
};
export default config;
