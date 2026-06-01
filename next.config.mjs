/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["natural", "compromise"],
  },
};

export default nextConfig;
