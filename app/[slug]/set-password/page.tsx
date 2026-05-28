'use client'

import { useEffect } from 'react'

export default function SlugSetPasswordRedirect() {
  useEffect(() => {
    window.location.replace(`/set-password${window.location.hash || ''}`)
  }, [])

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#070b14',
      color: '#f8fafc',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      Redirecionando...
    </main>
  )
}
