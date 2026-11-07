import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false }
    }
    return config
  },
}

export default nextConfig
