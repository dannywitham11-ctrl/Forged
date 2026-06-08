/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: '#0b0f17',
        panel: '#121826',
        panel2: '#1a2233',
        border: '#222b3d',
        muted: '#7b8aa8',
        text: '#e6ecf5',
        accent: '#6ee7b7',
        win: '#22c55e',
        loss: '#ef4444',
        warn: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
