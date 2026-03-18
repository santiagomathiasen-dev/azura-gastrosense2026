/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lqktevnjfywrujdhetlo.supabase.co',
            }
        ],
    },
    // Allow cross-origin for Supabase
    async headers() {
        return [
            {
                source: '/api/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                ],
            },
        ];
    },

};

export default nextConfig;
