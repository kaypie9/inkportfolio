import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@lifi/widget'],

  async rewrites() {
    return [
      { source: '/bridge', destination: '/' },
      { source: '/swap', destination: '/' },
      { source: '/ink', destination: '/' },
      { source: '/metrics', destination: '/' },
      { source: '/ecosystem', destination: '/' },
      { source: '/explore', destination: '/' },
      { source: '/language', destination: '/' },
    ]
  },
}

export default nextConfig
