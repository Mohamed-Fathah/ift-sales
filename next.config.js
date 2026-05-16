/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { allowedOrigins: ['localhost:3000'] } },
  images: { domains: ['iftchennai.in', 'supabase.co'] },
}
module.exports = nextConfig
