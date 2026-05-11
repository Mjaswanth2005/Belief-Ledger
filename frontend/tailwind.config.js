/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
    theme: {
        extend: {
            fontFamily: {
                mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'Menlo', 'Consolas', 'monospace'],
                sans: ['"JetBrains Mono"', '"IBM Plex Mono"', 'Menlo', 'Consolas', 'monospace'],
            },
            colors: {
                void: {
                    DEFAULT: '#050505',
                    surface: '#111111',
                    hover: '#1A1A1A',
                },
                amber: {
                    glow: '#FFB000',
                    hover: '#E59E00',
                },
                ink: {
                    primary: '#E5E5E5',
                    secondary: '#888888',
                },
                edge: '#262626',
                conflict: '#EF4444',
                aligned: '#10B981',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))'
            },
            borderRadius: {
                lg: '0px',
                md: '0px',
                sm: '0px'
            },
            keyframes: {
                blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
                'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
                'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
            },
            animation: {
                blink: 'blink 1.1s steps(1) infinite',
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out'
            }
        }
    },
    plugins: [require("tailwindcss-animate")],
};
