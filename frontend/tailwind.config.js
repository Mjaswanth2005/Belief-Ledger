/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
    theme: {
        extend: {
            fontFamily: {
                display: ['"Archivo Black"', 'Impact', 'system-ui', 'sans-serif'],
                sans: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
            },
            colors: {
                // Neutrals — driven by CSS variables so dark/light toggle works
                cream: {
                    DEFAULT: 'var(--c-bg)',
                    deep: 'var(--c-bg-deep)',
                    soft: 'var(--c-bg-soft)',
                },
                paper: 'var(--c-surface)',
                ink: {
                    DEFAULT: 'var(--c-ink)',
                    soft: 'var(--c-ink-soft)',
                },
                // Pastels — same in both themes (brutalist palette stays vivid)
                mint: { DEFAULT: '#A7E8B5', deep: '#7DD68F' },
                pinky: { DEFAULT: '#F5B5D1', deep: '#EC8CB8' },
                butter: { DEFAULT: '#F4D96B', deep: '#E8C744' },
                coral: { DEFAULT: '#F5A5A5', deep: '#E87878' },
                sky: { DEFAULT: '#A5D8F5', deep: '#78BFE8' },
                lavender: '#D6C7F0',
                // shadcn semantic
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
                popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
                primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
                secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
                muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
                accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
                destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
            },
            boxShadow: {
                'brutal': '4px 4px 0 0 var(--c-shadow)',
                'brutal-lg': '6px 6px 0 0 var(--c-shadow)',
                'brutal-xl': '8px 8px 0 0 var(--c-shadow)',
                'brutal-sm': '2px 2px 0 0 var(--c-shadow)',
            },
            borderRadius: { lg: '14px', md: '10px', sm: '8px' },
            keyframes: {
                wiggle: { '0%,100%': { transform: 'rotate(-2deg)' }, '50%': { transform: 'rotate(2deg)' } },
                'pop-in': { from: { transform: 'scale(0.96)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
                'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
                'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
            },
            animation: {
                wiggle: 'wiggle 0.4s ease-in-out',
                'pop-in': 'pop-in 0.25s ease-out',
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out'
            }
        }
    },
    plugins: [require("tailwindcss-animate")],
};
