/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        amber: {
          DEFAULT: 'rgb(var(--color-amber) / <alpha-value>)',
          light: '#F4D03F', // Keeping these static for now or can var them too
          dark: '#D4AC0D',
        },
        rust: 'rgb(var(--color-rust) / <alpha-value>)',
        sage: 'rgb(var(--color-sage) / <alpha-value>)',
        mist: 'rgb(var(--color-mist) / <alpha-value>)',
        cream: {
          DEFAULT: 'rgb(var(--color-cream) / <alpha-value>)',
          dark: 'rgb(var(--color-cream) / 0.9)', // Adjusted
        },
        white: 'rgb(var(--color-white) / <alpha-value>)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'score-fill': 'scoreFill 1s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scoreFill: {
          '0%': { width: '0%' },
          '100%': { width: 'var(--score-width)' },
        },
      },
    },
  },
  plugins: [],
}
