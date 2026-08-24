/** @type {import('tailwindcss').Config} */

/**
 * Barevná paleta musí odpovídat DEFAULT_THEME v src/default-content.js
 * (stejné hodnoty používal i původní web). Když tu některý token chybí,
 * Tailwind třídu vůbec nevygeneruje a text/pozadí zůstane neviditelné –
 * přesně takhle zmizely `bg-off-white`, `text-gray` a `to-copper`.
 */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0a1628',
          light: '#152238',
          medium: '#1a2d4a',
        },
        brass: {
          DEFAULT: '#c9a84c',
          light: '#dfc06a',
          dark: '#a8872e',
        },
        copper: '#b87333',
        // `off-white` (s pomlčkou) je název používaný v JSX – musí existovat,
        // jinak sekce O nás / Galerie / Kontakt zůstanou průhledné přes tmavé tělo stránky.
        'off-white': '#f8f6f1',
        offWhite: '#f8f6f1',
        gray: {
          // čitelný odstín pro texty na světlém pozadí (kontrast ~5.3:1 = WCAG AA)
          DEFAULT: '#6f6a64',
          // původní světlejší odstín palety (drobné popisky, oddělovače)
          soft: '#9a9590',
          light: '#e8e4dc',
        },
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up': 'slideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-left': 'slideInLeft 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slideInRight 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        float: 'float 9s ease-in-out infinite',
        'float-slow': 'float 14s ease-in-out infinite',
        morph: 'morph 18s ease-in-out infinite',
        'morph-alt': 'morphAlt 22s ease-in-out infinite',
        shimmer: 'shimmer 2.6s ease-in-out infinite',
        'glow-slow': 'glow 7s ease-in-out infinite',
        'grow-x': 'growX 0.9s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Animujeme jen transform/opacity – běží na GPU, nerozkládá layout.
        float: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -14px, 0)' },
        },
        morph: {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%', transform: 'rotate(0deg) scale(1)' },
          '50%': { borderRadius: '35% 65% 60% 40% / 45% 60% 40% 55%', transform: 'rotate(8deg) scale(1.05)' },
        },
        morphAlt: {
          '0%, 100%': { borderRadius: '40% 60% 70% 30% / 40% 70% 30% 60%', transform: 'rotate(0deg) scale(1)' },
          '50%': { borderRadius: '65% 35% 40% 60% / 55% 40% 60% 45%', transform: 'rotate(-6deg) scale(0.96)' },
        },
        shimmer: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        glow: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        growX: {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
      },
    },
  },
  plugins: [],
};
