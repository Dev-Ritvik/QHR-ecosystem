import type { Config } from 'tailwindcss';

// Deliberately NOT extending @estate/ui's preset. That preset carries Quality
// Homes Reality's palette (#0A1120 ground, cream/amber). Monolith's ground is
// #050505 and its type is Swiss/brutalist — inheriting would mean fighting the
// preset on every component. See MASTER_SPEC §4.1.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        void: '#050505',
        signal: '#FFFFFF',
        ash: '#8A8A8A',
        ember: '#C8642A',
        loss: '#FF2B2B',
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
};
export default config;
