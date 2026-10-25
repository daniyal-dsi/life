/** @type {import('tailwindcss').Config} */
// Every colour is a CSS variable from src/styles.css, so light and dark themes
// switch by changing the variables, not the classes.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        line: v('line'),
        line2: v('line2'),
        chip: v('chip'),
        segbg: v('segbg'),
        ink: v('text'),
        muted: v('muted'),
        hero: v('hero'),
        'hero-muted': v('hero-muted'),
        'hero-line': v('hero-line'),
        coral: v('coral'),
        'coral-soft': v('coral-soft'),
        'coral-ink': v('coral-ink'),
        green: v('green'),
        'green-hi': v('green-hi'),
        'green-soft': v('green-soft'),
        'green-ink': v('green-ink'),
        sun: v('sun'),
        'sun-soft': v('sun-soft'),
        'sun-ink': v('sun-ink'),
        violet: v('violet'),
        'violet-hi': v('violet-hi'),
        'violet-soft': v('violet-soft'),
        'violet-ink': v('violet-ink'),
        rose: v('rose'),
        'rose-soft': v('rose-soft'),
        'rose-ink': v('rose-ink'),
        'p2-bg': v('p2-bg'),
        'p2-ink': v('p2-ink'),
        faith: v('faith'),
        'faith-ink': v('faith-ink'),
        'faith-soft': v('faith-soft'),
        gold: v('gold'),
        'gold-hi': v('gold-hi'),
        'gold-ink': v('gold-ink'),
        niche: v('niche')
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        arabic: ['Amiri', '"Noto Naskh Arabic"', 'serif']
      },
      borderRadius: {
        chip: '8px',
        ctl: '10px',
        btn: '12px',
        card: '16px',
        hero: '18px',
        dock: '20px'
      },
      maxWidth: { app: '460px' }
    }
  },
  plugins: []
};
