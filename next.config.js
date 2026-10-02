/** @type {import('next').NextConfig} */

// Each demo is its own build, mounted on its own path.
//
// The plant a portal shows is fixed when the bundle is built — eighty-seven
// files read it from module scope, which has no request and therefore no URL.
// So several demos served at once means several builds, and `basePath` is what
// keeps them from colliding on one domain:
//
//   npm run build                                          -> /portal/oxmaint
//   NEXT_PUBLIC_OXMAINT_PACK=dhl-gse BASE_PATH=/dhl //     npm run build                                        -> /dhl/portal/oxmaint
//
// Unset, nothing changes — the default build keeps the root, so an existing
// deployment is unaffected by this being here.
// Validated rather than trusted. A build that quietly mounts on the wrong path
// is worse than one that refuses: it deploys, it serves, and every asset 404s
// for a reason nobody can see. The specific trap is Git Bash on Windows, which
// rewrites `BASE_PATH=/dhl` into `C:/Program Files/Git/dhl` before Node ever
// sees it — so a value carrying a drive letter is a mangled one, not a choice.
function readBasePath() {
  const raw = (process.env.BASE_PATH || '').trim()
  if (!raw) return ''
  const cleaned = raw.replace(/\/+$/, '')
  if (!cleaned.startsWith('/') || cleaned.includes(':') || cleaned.includes('\\')) {
    throw new Error(
      `BASE_PATH must be a URL path beginning with "/" — got ${JSON.stringify(raw)}.
`
      + 'On Git Bash for Windows, prefix the command with MSYS_NO_PATHCONV=1 to stop it '
      + 'rewriting the value into a filesystem path.',
    )
  }
  return cleaned
}

const basePath = readBasePath()

const nextConfig = {
  devIndicators: false,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // The browser needs the same value. `basePath` prefixes links and the router
  // but not `fetch`, so client code builds its API URLs from this (lib/apiPath)
  // — and it is derived here rather than set by hand, so a build cannot mount
  // on /hospital while its tab calls the root deployment's API.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Voice realtime opens an outbound ws to xAI; keep the native client external.
  serverExternalPackages: ['ws'],

  // The demo screens are prerendered and identical for everyone who opens them,
  // so a short shared cache in front of them is honest and saves a round trip
  // to this origin on every navigation. It is deliberately short: a deploy
  // replaces the content, and a minute is long enough to make a click-through
  // feel instant without anyone being shown yesterday's build for long.
  //
  // /admin is NOT in here. It is behind a cookie and must never be cached.
  async headers() {
    return [
      {
        source: '/portal/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
