import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  console.log('[DEBUG] mode:', mode)
  console.log('[DEBUG] process.env.VITE_API_BASE_URL:', JSON.stringify(process.env.VITE_API_BASE_URL))
  console.log('[DEBUG] loadEnv VITE_API_BASE_URL:', JSON.stringify(env.VITE_API_BASE_URL))
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
    },
  }
})
