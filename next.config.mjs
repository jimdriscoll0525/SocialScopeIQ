/** @type {import('next').NextConfig} */
const nextConfig = {
  // Single static-generation worker: local builds were failing with
  // `spawn UNKNOWN` under memory pressure (Next defaults to many workers).
  // Vercel builds are unaffected either way.
  experimental: {
    cpus: 1
  }
};
export default nextConfig;
