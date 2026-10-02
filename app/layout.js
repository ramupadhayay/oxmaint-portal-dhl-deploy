// Root layout for the standalone Oxmaint portal.
//
// The iFactory original wrapped every page in a SessionWatch component that
// reported the browser session to a staff console. That console is not part of
// this extraction, so the wrapper is gone rather than left calling an endpoint
// that does not exist. Everything else — the html/body shell and the font — is
// unchanged, because the portal's own styles assume a zero-margin body.
//
// The title here is only a fallback: /portal/oxmaint has its own metadata and
// overrides it on every page anyone actually opens.

export const metadata = {
  title: 'Oxmaint AI',
  description: 'Oxmaint AI — maintenance management platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      >
        {children}
      </body>
    </html>
  )
}
