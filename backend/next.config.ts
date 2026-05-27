import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.FIREBASE_BUILD === 'true' ? 'export' : undefined,
  serverExternalPackages: ['koffi'],
  images: {
    unoptimized: process.env.FIREBASE_BUILD === 'true', // Required for static export
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },
};

export default nextConfig;
