/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: '#0B0C10',
        panel: '#12141A',
        panel2: '#1A1D24',
        border: '#2A2E39',
        muted: '#8E9BAE',
        text: '#F1F5F9',
        accent: '#45A29E',
        win: '#10B981',
        loss: '#F43F5E',
        warn: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
