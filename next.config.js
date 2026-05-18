/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  experimental: { serverActions: { allowedOrigins: ['localhost:3000'] } },
  images: { domains: ['iftchennai.in', 'supabase.co'] },
}
module.exports = nextConfig
