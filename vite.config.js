import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function engineVersion() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return Date.now().toString(36)
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? (process.env.GITHUB_ACTIONS === 'true' ? '/gomoku/' : '/'),
  plugins: [react()],
  define: {
    __ENGINE_VERSION__: JSON.stringify(engineVersion()),
  },
})
