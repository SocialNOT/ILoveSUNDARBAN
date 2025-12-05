import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env variables. The '' prefix loads all variables.
  // FIX: Use `process.cwd()` to allow loadEnv to use its default without causing a TypeScript type error.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // The define option allows us to make environment variables available on `import.meta.env`
    // This is necessary for variables that don't have the VITE_ prefix.
    define: {
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.API_KEY': JSON.stringify(env.API_KEY),
    }
  }
})