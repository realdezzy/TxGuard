import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'TxGuard',
    description: 'AI-Powered Wallet Safety Layer for Solana',
    permissions: ['activeTab', 'storage'],
    host_permissions: ['*://localhost/*', '*://127.0.0.1/*', 'https://api.txguard.com/*'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  },
});
