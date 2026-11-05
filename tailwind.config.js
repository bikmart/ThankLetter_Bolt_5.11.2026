/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FBFBFA',
        pine: {
          DEFAULT: '#1E4638',
          50: '#F2F6F4',
          100: '#DCE7E2',
          600: '#1A3D31',
          700: '#163328',
        },
        olive: '#7C8A4E',
        amberx: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        days: ['"Days One"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)', maxHeight: '0' },
          '100%': { opacity: '1', transform: 'translateY(0)', maxHeight: '2000px' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        slideDown: 'slideDown 0.45s ease-out forwards',
        fadeIn: 'fadeIn 0.3s ease-out forwards',
        popIn: 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
      },
    },
  },
  plugins: [],
};
