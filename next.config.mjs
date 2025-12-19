/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    deviceSizes: [640, 750, 828],
    imageSizes: [128, 256, 384],
    formats: ['image/webp'],
  },
  // バンドル最適化
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{ kebabCase member }}',
    },
  },
  // 本番ビルド最適化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // 実験的機能
  experimental: {
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
  },
};

export default nextConfig;
