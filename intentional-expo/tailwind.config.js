/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'bg-primary': '#0D0D0D',
        'bg-secondary': '#161616',
        'bg-tertiary': '#1A1A1A',
        'bg-overlay': '#0E0E0E',
        'bg-focus': '#0F0F14',

        // Text
        'text-primary': '#E8E4DC',
        'text-secondary': '#888888',
        'text-tertiary': '#555555',
        'text-inverse': '#080808',

        // Accent
        'accent-blue': '#E8E4DC',
        'accent-blue-light': '#D8D4CC',
        'accent-success': '#22C55E',
        'accent-warning': '#F59E0B',
        'accent-danger': '#DC2626',

        // Separator
        'separator': '#222222',

        // Goal Primary Colors
        'goal-physique': '#4A9EED',
        'goal-finances': '#22C55E',
        'goal-skills': '#8B5CF6',
        'goal-mind': '#F59E0B',

        // Goal Tint Colors (10% opacity backgrounds)
        'goal-physique-tint': 'rgba(74,158,237,0.10)',
        'goal-finances-tint': 'rgba(34,197,94,0.10)',
        'goal-skills-tint': 'rgba(139,92,246,0.10)',
        'goal-mind-tint': 'rgba(245,158,11,0.10)',
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        'full': '9999px',
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        'xxl': '32px',
      },
      fontSize: {
        'caption': ['12px', { lineHeight: '16px' }],
        'footnote': ['13px', { lineHeight: '18px' }],
        'subheadline': ['15px', { lineHeight: '20px' }],
        'callout': ['16px', { lineHeight: '21px' }],
        'body': ['17px', { lineHeight: '22px' }],
        'headline': ['17px', { lineHeight: '22px' }],
        'title3': ['20px', { lineHeight: '25px' }],
        'title2': ['22px', { lineHeight: '28px' }],
        'title1': ['28px', { lineHeight: '34px' }],
        'largeTitle': ['34px', { lineHeight: '41px' }],
        'score': ['48px', { lineHeight: '48px' }],
        'timer': ['72px', { lineHeight: '72px' }],
      },
    },
  },
  plugins: [],
};
