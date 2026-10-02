'use client'

// Confirmation that a save happened, or that it did not.
//
// Optimistic writes put the row on screen before the request comes back, which
// is right for how the product should feel — but it means the screen looks the
// same whether the write succeeded or silently failed. This is the difference,
// and it is why a failure gets a red toast rather than nothing at all.

import { useStore } from '../lib/store'

export default function SaveToast() {
  const { toast } = useStore() || {}
  if (!toast) return null

  const bad = toast.tone === 'error'

  return (
    <div style={{
      position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 9, zIndex: 2000,
      padding: '10px 16px', borderRadius: 999,
      background: bad ? '#7f1d1d' : '#0f172a', color: '#fff',
      fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
      boxShadow: '0 8px 24px rgba(15,23,42,0.28)',
      animation: 'oxToastIn .18s ease',
    }}>
      <style>{`@keyframes oxToastIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {bad ? <><path d="M12 8v5M12 17h.01" /><circle cx="12" cy="12" r="9" /></> : <path d="m5 12 5 5L20 7" />}
      </svg>
      {toast.message}
    </div>
  )
}
