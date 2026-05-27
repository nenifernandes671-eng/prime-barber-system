import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NexBarber',
    short_name: 'NexBarber',
    description: 'Sistema SaaS para barbearias, clientes e barbeiros.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070A12',
    theme_color: '#D6B24A',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/nexbarber-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/nexbarber-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/nexbarber-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
