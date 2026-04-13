/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['date-fns'],
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

module.exports = nextConfig;