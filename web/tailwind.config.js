/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // shadcn/ui tokens (HSL CSS vars) so generated components work in Sprint 2.
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        // SPEC §13.1 brutalist palette (raw hex).
        ink: '#0A0A0A',
        paper: '#F5F5F0',
        steel: '#3D3D3D',
        concrete: '#8A8A8A',
        orange: '#FF6B00',
        hazard: '#FFD60A',
        clockedin: '#1F7A3A',
        absent: '#B91C1C',
        clockedout: '#1E40AF',
      },
      // No rounded corners, ever (SPEC §13.2). radius var is 0.
      borderRadius: { lg: 'var(--radius)', md: 'var(--radius)', sm: 'var(--radius)' },
      borderWidth: { DEFAULT: '2px' },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        hard: '4px 4px 0 #0A0A0A',
        'hard-sm': '2px 2px 0 #0A0A0A',
      },
    },
  },
  plugins: [],
};
