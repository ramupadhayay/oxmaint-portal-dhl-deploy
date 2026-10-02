// Tailwind v4 runs as a PostCSS plugin. It is here for the Oxmaint CMMS portal,
// which is being rebuilt against the real product's design system (Tailwind v4 +
// shadcn/ui). The other five portals in this app are written in inline styles and
// must not change, which is why the stylesheet that turns this on is imported by
// the oxmaint route segment alone and leaves Tailwind's preflight out — see
// app/portal/oxmaint/oxmaint.css.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
