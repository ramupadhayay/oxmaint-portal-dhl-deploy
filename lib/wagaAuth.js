import jwt from 'jsonwebtoken'

// The token behind the WAGA portal's own sign-in, mirroring lib/adminAuth.js.
//
// The WAGA portal is handed to a client as their own — behind a per-user login
// rather than the open door the other portals keep. This signs the cookie that
// login sets; proxy.js verifies the same HS256 token with the same secret on the
// edge, so the pair is interchangeable (jsonwebtoken here on Node, jose there).
//
// The claim is `portal: 'waga'`, not a role — an account is scoped to a portal
// by the `portals` array on its User document, and this token only says which
// portal the bearer signed in to. Change JWT_SECRET and change adminAuth too;
// both must resolve the same key.
const JWT_SECRET = process.env.JWT_SECRET || 'oxmaint-dev-secret-change-me'

export function generateWagaToken(email) {
  return jwt.sign({ email, portal: 'waga' }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyWagaToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (decoded?.portal !== 'waga') return null
    return decoded
  } catch {
    return null
  }
}
