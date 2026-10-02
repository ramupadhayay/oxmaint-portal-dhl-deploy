import jwt from 'jsonwebtoken'

// Set JWT_SECRET in .env.local. The fallback only exists so a fresh checkout
// runs before anyone has written one; it is public, so a deployment that keeps
// it is signing admin cookies with a key that is in the repository.
//
// proxy.js verifies these tokens on the edge runtime and must resolve the same
// secret — change one and change both.
const JWT_SECRET = process.env.JWT_SECRET || 'oxmaint-dev-secret-change-me'

export function generateAdminToken(email, jti) {
  return jwt.sign({ email, role: 'admin', ...(jti ? { jti } : {}) }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyAdminToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (decoded?.role !== 'admin') return null
    return decoded
  } catch {
    return null
  }
}
