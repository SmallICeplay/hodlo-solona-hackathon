/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0a0a',
          850: '#0a0e0d',
          800: '#0a0e0d',
          700: '#111a17',
          600: '#1a2420',
          500: '#222e2a',
        },
        accent: {
          green: '#00ff87',
          red: '#ff2d55',
          blue: '#00d4ff',
          yellow: '#ffe600',
          purple: '#bf5af2',
          cyan: '#00e5ff',
        }
      },
      fontFamily: {
        sans: ['"__Lato_06d0dd"', '"__Lato_Fallback_06d0dd"', 'sans-serif'],
        mono: ['ui-monospace', '"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    }
  },
  plugins: [],
}
