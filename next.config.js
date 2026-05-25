/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',         value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co;" },
        ]
      }
    ]
  },
  env: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  // No allowedOrigins restriction — lets server actions work from any
  // deployment domain (localhost dev, Vercel preview, production).
  experimental: { serverActions: {} },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'iftchennai.in' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}
module.exports = nextConfig
