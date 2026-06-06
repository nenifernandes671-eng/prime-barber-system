'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme-provider'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      className={`theme-toggle ${compact ? 'compact' : ''}`}
      onClick={toggleTheme}
      aria-label={isLight ? 'Ativar Dark Mode' : 'Ativar Light Mode'}
      title={isLight ? 'Dark Mode' : 'Light Mode'}
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-thumb">
          {isLight ? <Sun size={15} /> : <Moon size={15} />}
        </span>
      </span>
      {!compact && <span>{isLight ? 'Light Mode' : 'Dark Mode'}</span>}
    </button>
  )
}
