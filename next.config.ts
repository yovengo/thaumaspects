import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  outputFileTracingIncludes: {
    '/api/atlas-icons/[id]': ['./public/gt-icons/atlas-2.7.4.webp'],
  },
}

export default nextConfig
