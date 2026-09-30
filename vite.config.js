import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const buildId = Date.now().toString()

function injectSwBuildId() {
  return {
    name: 'inject-sw-build-id',
    writeBundle() {
      const swPath = 'dist/firebase-messaging-sw.js'
      const content = fs.readFileSync(swPath, 'utf-8')
      fs.writeFileSync(swPath, `const BUILD_ID = '${buildId}';\n` + content)
    },
  }
}

export default defineConfig({
  plugins: [react(), injectSwBuildId()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/firebase')) return 'vendor-firebase';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) return 'vendor-react';
        },
      },
    },
  },
})
