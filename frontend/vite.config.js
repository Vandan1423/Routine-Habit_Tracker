import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `vite --mode sandbox` talks to the throwaway API started by backend/scripts/sandbox.js
// instead of the real one, and keeps its own cache so both can run side by side.
// `--mode sandbox-1` is the same for that script's slot 1, one port up.
const sandboxSlot = (mode) => {
  const match = /^sandbox(?:-(\d))?$/.exec(mode)
  return match ? Number(match[1] ?? 0) : null
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const slot = sandboxSlot(mode)

  return {
    plugins: [react()],
    cacheDir: slot === null ? 'node_modules/.vite' : `node_modules/.vite-sandbox${slot || ''}`,
    server: {
      proxy: {
        // Serve the API from the same origin as the app, so the refresh cookie is first-party
        '/api': slot === null ? 'http://localhost:4000' : `http://127.0.0.1:${4010 + slot}`,
      },
    },
  }
})
