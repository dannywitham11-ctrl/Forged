/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: '#0A0E1A',
        panel: '#111625',
        panel2: '#1A203580',
        border: '#2A3441',
        muted: '#8B9BB4',
        text: '#F4F6F9',
        accent: '#00E5E5',
        win: '#00FF85',
        loss: '#FF0055',
        warn: '#FFB800',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
