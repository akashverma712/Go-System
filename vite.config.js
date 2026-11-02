import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// base './' => works under https://<user>.github.io/<any-repo-name>/ without edits
export default defineConfig({ plugins: [react()], base: './' })
