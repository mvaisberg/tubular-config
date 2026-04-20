/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/configurador',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
