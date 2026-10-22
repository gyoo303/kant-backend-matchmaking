import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    /* config options here */
    experimental: {
        agentFeedback: true,
    },
    cacheComponents: true,
    partialPrefetching: true,
    // 표지 이미지 주소 (AR-DB §6): Supabase Storage book-covers 공개 버킷, seed 표지(picsum.photos)
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/book-covers/**' },
            { protocol: 'https', hostname: 'picsum.photos' },
        ],
    },
    turbopack: {
        rules: {
            '*.css': {
                loaders: ['@tailwindcss/turbopack'],
                as: '*.css',
            },
        },
    },
};

export default nextConfig;
