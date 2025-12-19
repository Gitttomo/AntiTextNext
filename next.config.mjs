/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // 生成するサイズを制限（軽量化）
    deviceSizes: [640, 750, 828],
    imageSizes: [128, 256, 384],
    // フォーマットをWebPに限定（より軽量）
    formats: ['image/webp'],
  },
};

export default nextConfig;
