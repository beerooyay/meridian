/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  headers: async () => [
    {
      source: '/meridian/flags/:path*',
      headers: [{ key: 'cache-control', value: 'public, max-age=31536000, immutable' }],
    },
    {
      source: '/meridian/fonts/:path*',
      headers: [{ key: 'cache-control', value: 'public, max-age=31536000, immutable' }],
    },
    {
      source: '/meridian/branding/:path*',
      headers: [{ key: 'cache-control', value: 'public, max-age=31536000, immutable' }],
    },
    {
      source: '/meridian/data/:path*',
      headers: [{ key: 'cache-control', value: 'public, max-age=86400' }],
    },
  ],
}

export default nextConfig
