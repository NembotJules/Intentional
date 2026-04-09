/** @type {import('tailwindcss').Config} */
/** v1.1 addendum — surface hierarchy + text contrast */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Surfaces (semantic → Tailwind names)
        'bg-primary': '#131313',
        'bg-secondary': '#1f1f1f',
        'bg-tertiary': '#2a2a2a',
        'bg-overlay': '#1b1b1b',
        'bg-focus': '#0e0e0e',
        'bg-brutalist': '#0e0e0e',

        // Text v1.1
        'text-primary': '#e2e2e2',
        'text-secondary': '#c6c6c6',
        'text-tertiary': '#8a8a8a',
        'text-muted': '#8a8a8a',
        'text-label': '#6b6b6b',
        'text-dim': '#474747',
        'text-ghost': '#353535',
        'text-inverse': '#0e0e0e',

        // Accent
        'accent-blue': '#e2e2e2',
        'accent-blue-light': '#c6c6c6',
        'accent-success': '#22C55E',
        'accent-warning': '#F59E0B',
        'accent-danger': '#DC2626',

        'separator': 'rgba(255,255,255,0.15)',

        'goal-physique': '#4A9EED',
        'goal-finances': '#22C55E',
        'goal-skills': '#8B5CF6',
        'goal-mind': '#F59E0B',

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
        'cta': '6px',
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
