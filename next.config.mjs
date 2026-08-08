/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/configurador',
  // El deploy buildea a un dir aparte y hace swap atómico (scripts/deploy.sh):
  // buildear directo sobre .next en vivo tiraba 500 a los usuarios conectados.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
