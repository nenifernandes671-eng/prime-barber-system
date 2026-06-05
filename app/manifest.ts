import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KorteBarber',
    short_name: 'KorteBarber',
    description: 'Sistema SaaS para barbearias, clientes e barbeiros.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070A12',
    theme_color: '#2563EB',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/kortebarber-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/kortebarber-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/kortebarber-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
