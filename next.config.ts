import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/ink', destination: '/' },
      { source: '/metrics', destination: '/' },
      { source: '/ecosystem', destination: '/' },
      { source: '/explore', destination: '/' },
      { source: '/language', destination: '/' },
    ]
  },
}

export default nextConfig
