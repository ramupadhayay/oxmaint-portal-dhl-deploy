'use client';

import { useState, useEffect, useRef } from 'react';
import { notify } from '../lib/notifyStore';

// ---------------------------------------------------------------------------
// Internal palette tokens (not exported — pages define their own from the
// shared palette). Navy accent per the semiconductor fab portal spec.
// ---------------------------------------------------------------------------
const ACCENT = '#15227a';
const ACCENT_LIGHT = '#e8ecff';
const INK = '#1e293b';
const SUB = '#64748b';
const MUTE = '#94a3b8';
const LINE = '#e8ecf1';
const BG = '#f8fafc';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const BLUE = '#3b82f6';
const CYAN = '#0891b2';
const PURPLE = '#7c3aed';

// Defect severity -> color (used by wafer overlays and defect chips).
function severityColor(sev) {
  if (sev === 'critical' || sev === 'killer') return RED;
  if (sev === 'major') return AMBER;
  if (sev === 'scratch') return PURPLE;
  return BLUE; // minor / particle / default
}

// ---------------------------------------------------------------------------
// sleep
// ---------------------------------------------------------------------------
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Spinner (internal)
// ---------------------------------------------------------------------------
function Spinner({ size = 16, color = '#fff' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ animation: 'sk-spin 0.8s linear infinite', flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Inject keyframes once (client only).
function useKeyframes() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('sk-keyframes')) return;
    const el = document.createElement('style');
    el.id = 'sk-keyframes';
    el.textContent = `
      @keyframes sk-spin { to { transform: rotate(360deg); } }
      @keyframes sk-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes sk-scale-in { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      @keyframes sk-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
      @keyframes sk-toast-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes sk-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.6); } }
      @keyframes sk-scan { 0% { top: 0%; } 100% { top: 100%; } }
    `;
    document.head.appendChild(el);
  }, []);
}

// ---------------------------------------------------------------------------
// ActionButton — async-aware (shows spinner while an async onClick resolves)
// ---------------------------------------------------------------------------
export function ActionButton({
  children,
  onClick,
  variant = 'primary',
  icon,
  disabled,
  size = 'md',
  full,
}) {
  useKeyframes();
  const [working, setWorking] = useState(false);

  const variants = {
    primary: { bg: ACCENT, color: '#fff', border: ACCENT },
    success: { bg: GREEN, color: '#fff', border: GREEN },
    danger: { bg: RED, color: '#fff', border: RED },
    ghost: { bg: '#fff', color: INK, border: LINE },
    subtle: { bg: ACCENT_LIGHT, color: ACCENT, border: ACCENT_LIGHT },
  };
  const v = variants[variant] || variants.primary;

  const sizes = {
    sm: { pad: '6px 12px', font: 12.5, gap: 6, icon: 15 },
    md: { pad: '9px 16px', font: 13.5, gap: 8, icon: 17 },
    lg: { pad: '12px 22px', font: 15, gap: 9, icon: 19 },
  };
  const s = sizes[size] || sizes.md;

  const spinnerColor = variant === 'ghost' || variant === 'subtle' ? ACCENT : '#fff';
  const isDisabled = disabled || working;

  async function handleClick(e) {
    if (isDisabled || !onClick) return;
    const result = onClick(e);
    if (result && typeof result.then === 'function') {
      setWorking(true);
      try {
        await result;
      } finally {
        setWorking(false);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      style={{
        display: full ? 'flex' : 'inline-flex',
        width: full ? '100%' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: s.pad,
        fontSize: s.font,
        fontWeight: 600,
        lineHeight: 1.1,
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: 8,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled && !working ? 0.55 : 1,
        transition: 'filter 0.15s ease, opacity 0.15s ease',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) e.currentTarget.style.filter = 'brightness(0.95)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = 'none';
      }}
    >
      {working ? (
        <Spinner size={s.icon} color={spinnerColor} />
      ) : icon ? (
        <svg
          width={s.icon}
          height={s.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke={v.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </svg>
      ) : null}
      <span>{working ? 'Working…' : children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Shared overlay header (Modal + Drawer)
// ---------------------------------------------------------------------------
function OverlayHeader({ icon, title, subtitle, onClose }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '18px 20px',
        borderBottom: `1px solid ${LINE}`,
      }}
    >
      {icon && (
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 9,
            background: ACCENT_LIGHT,
            color: ACCENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={ACCENT}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {icon}
          </svg>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: SUB, marginTop: 2 }}>{subtitle}</div>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: MUTE,
          padding: 4,
          lineHeight: 0,
          borderRadius: 6,
          flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function OverlayFooter({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
        padding: '14px 20px',
        borderTop: `1px solid ${LINE}`,
        background: BG,
      }}
    >
      {children}
    </div>
  );
}

function useEscClose(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
export function Modal({ open, onClose, title, subtitle, icon, children, footer, width = 560 }) {
  useKeyframes();
  useEscClose(open, onClose);
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'sk-fade-in 0.18s ease',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(15,23,42,0.28)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'sk-scale-in 0.2s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <OverlayHeader icon={icon} title={title} subtitle={subtitle} onClose={onClose} />
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, color: INK, fontSize: 13.5 }}>
          {children}
        </div>
        {footer && <OverlayFooter>{footer}</OverlayFooter>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------
export function Drawer({ open, onClose, title, subtitle, icon, children, footer, width = 440 }) {
  useKeyframes();
  useEscClose(open, onClose);
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'sk-fade-in 0.18s ease',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: width,
          height: '100%',
          background: '#fff',
          boxShadow: '-12px 0 40px rgba(15,23,42,0.22)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sk-slide-in 0.24s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <OverlayHeader icon={icon} title={title} subtitle={subtitle} onClose={onClose} />
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, color: INK, fontSize: 13.5 }}>
          {children}
        </div>
        {footer && <OverlayFooter>{footer}</OverlayFooter>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StepProgress — vertical staged flow indicator
// ---------------------------------------------------------------------------
export function StepProgress({ steps = [], current = 0 }) {
  useKeyframes();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === steps.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: done ? GREEN : active ? ACCENT_LIGHT : '#fff',
                  border: `2px solid ${done ? GREEN : active ? ACCENT : LINE}`,
                  color: done ? '#fff' : active ? ACCENT : MUTE,
                }}
              >
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : active ? (
                  <Spinner size={14} color={ACCENT} />
                ) : (
                  <span style={{ fontSize: 11.5, fontWeight: 700 }}>{i + 1}</span>
                )}
              </div>
              {!last && (
                <div style={{ width: 2, flex: 1, minHeight: 18, background: done ? GREEN : LINE }} />
              )}
            </div>
            <div style={{ paddingBottom: last ? 0 : 14, paddingTop: 2 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: active ? ACCENT : done ? INK : SUB }}>
                {step.label}
              </div>
              {step.sub && <div style={{ fontSize: 12, color: SUB, marginTop: 1 }}>{step.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pill
// ---------------------------------------------------------------------------
export function Pill({ children, color = ACCENT, bg = ACCENT_LIGHT }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        fontSize: 11.5,
        fontWeight: 700,
        lineHeight: 1.4,
        color,
        background: bg,
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusDot
// ---------------------------------------------------------------------------
export function StatusDot({ color = GREEN, pulse = false }) {
  useKeyframes();
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10, flexShrink: 0 }}>
      {pulse ? (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: color,
            animation: 'sk-pulse 1.6s ease-in-out infinite',
          }}
        />
      ) : null}
      <span
        style={{
          position: 'relative',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 0 2px ${color}22`,
        }}
      />
    </span>
  );
}

// ---------------------------------------------------------------------------
// KeyVal
// ---------------------------------------------------------------------------
export function KeyVal({ rows = [] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            padding: '8px 0',
            borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${LINE}`,
          }}
        >
          <span style={{ fontSize: 12.5, color: SUB, flexShrink: 0 }}>{row.k}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: row.color || INK, textAlign: 'right', wordBreak: 'break-word' }}>
            {row.v}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar — horizontal progress bar
// ---------------------------------------------------------------------------
export function Bar({ pct = 0, color = ACCENT }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ width: '100%', height: 8, background: LINE, borderRadius: 999, overflow: 'hidden' }}>
      <div
        style={{
          width: `${clamped}%`,
          height: '100%',
          background: color,
          borderRadius: 999,
          transition: 'width 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gauge — inline-SVG 270° ring
// ---------------------------------------------------------------------------
export function Gauge({ value = 0, max = 100, label, unit, color = ACCENT, size = 120 }) {
  const safeMax = max <= 0 ? 1 : max;
  const frac = Math.max(0, Math.min(1, value / safeMax));
  const stroke = Math.max(6, Math.round(size * 0.085));
  const r = (size - stroke) / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 135;
  const sweep = 270;
  const circumference = 2 * Math.PI * r;
  const arcLen = (sweep / 360) * circumference;
  const dashOffset = arcLen * (1 - frac);

  const polar = (angleDeg) => {
    const a = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const start = polar(startAngle);
  const end = polar(startAngle + sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        <path d={trackPath} fill="none" stroke={LINE} strokeWidth={stroke} strokeLinecap="round" />
        <path
          d={trackPath}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circumference}`}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
        <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.24} fontWeight="700" fill={INK}>
          {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
        </text>
        {unit ? (
          <text x={cx} y={cy + size * 0.16} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.1} fontWeight="600" fill={MUTE}>
            {unit}
          </text>
        ) : null}
      </svg>
      {label ? <div style={{ fontSize: 12, fontWeight: 600, color: SUB, textAlign: 'center' }}>{label}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — inline-SVG line with optional baseline + shaded band
// ---------------------------------------------------------------------------
export function Sparkline({ data = [], color = ACCENT, w = 140, h = 40, baseline, band }) {
  if (!data || data.length < 2) {
    return <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true" />;
  }
  const pad = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const xFor = (i) => pad + (i / (data.length - 1)) * innerW;
  const yFor = (val) => pad + (1 - (val - min) / range) * innerH;

  const points = data.map((d, i) => `${xFor(i).toFixed(2)},${yFor(d).toFixed(2)}`);
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `M ${xFor(0).toFixed(2)},${(h - pad).toFixed(2)} L ${points.join(' L ')} L ${xFor(data.length - 1).toFixed(2)},${(h - pad).toFixed(2)} Z`;
  const gradId = `sk-spark-${Math.round(w)}-${Math.round(h)}-${color.replace('#', '')}`;

  let bandRect = null;
  if (band && typeof band.low === 'number' && typeof band.high === 'number') {
    const yHigh = yFor(band.high);
    const yLow = yFor(band.low);
    bandRect = (
      <rect x={pad} y={Math.min(yHigh, yLow)} width={innerW} height={Math.abs(yLow - yHigh)} fill={color} opacity="0.08" />
    );
  }

  let baselineEl = null;
  if (typeof baseline === 'number') {
    const yb = yFor(baseline);
    baselineEl = <line x1={pad} y1={yb} x2={w - pad} y2={yb} stroke={MUTE} strokeWidth="1" strokeDasharray="3 3" />;
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {bandRect}
      <path d={areaPath} fill={`url(#${gradId})`} />
      {baselineEl}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xFor(data.length - 1)} cy={yFor(data[data.length - 1])} r="2.4" fill={color} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Scatter — inline-SVG scatter plot with optional least-squares trend line.
// points: [{ x, y, label?, color? }]
// ---------------------------------------------------------------------------
export function Scatter({ points = [], xLabel, yLabel, color = ACCENT, trend = false, w = 320, h = 220 }) {
  const padL = 34;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  if (!points.length) {
    return <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true" />;
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  // pad the domains a touch so points don't sit on the axes
  const xLo = xMin - xRange * 0.05;
  const xHi = xMax + xRange * 0.05;
  const yLo = yMin - yRange * 0.08;
  const yHi = yMax + yRange * 0.08;
  const xSpan = xHi - xLo || 1;
  const ySpan = yHi - yLo || 1;

  const sx = (x) => padL + ((x - xLo) / xSpan) * plotW;
  const sy = (y) => padT + (1 - (y - yLo) / ySpan) * plotH;

  // Least-squares fit for the optional trend line.
  let trendLine = null;
  if (trend && points.length >= 2) {
    const n = points.length;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
    const sumXX = xs.reduce((a, b) => a + b * b, 0);
    const denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) > 1e-9) {
      const slope = (n * sumXY - sumX * sumY) / denom;
      const intercept = (sumY - slope * sumX) / n;
      const x1 = xLo;
      const x2 = xHi;
      trendLine = (
        <line
          x1={sx(x1)}
          y1={sy(slope * x1 + intercept)}
          x2={sx(x2)}
          y2={sy(slope * x2 + intercept)}
          stroke={color}
          strokeWidth="1.6"
          strokeDasharray="5 4"
          opacity="0.7"
        />
      );
    }
  }

  const gridTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {/* grid */}
      {gridTicks.map((t, i) => {
        const y = padT + t * plotH;
        return <line key={`gy-${i}`} x1={padL} y1={y} x2={w - padR} y2={y} stroke={LINE} strokeWidth="1" />;
      })}
      {gridTicks.map((t, i) => {
        const x = padL + t * plotW;
        return <line key={`gx-${i}`} x1={x} y1={padT} x2={x} y2={padT + plotH} stroke={LINE} strokeWidth="1" />;
      })}
      {/* axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={MUTE} strokeWidth="1.2" />
      <line x1={padL} y1={padT + plotH} x2={w - padR} y2={padT + plotH} stroke={MUTE} strokeWidth="1.2" />
      {/* axis value labels */}
      <text x={padL - 5} y={padT + 4} textAnchor="end" fontSize="9" fill={MUTE}>{yHi.toFixed(yRange < 5 ? 1 : 0)}</text>
      <text x={padL - 5} y={padT + plotH} textAnchor="end" fontSize="9" fill={MUTE}>{yLo.toFixed(yRange < 5 ? 1 : 0)}</text>
      <text x={padL} y={h - padB + 14} textAnchor="middle" fontSize="9" fill={MUTE}>{xLo.toFixed(xRange < 5 ? 1 : 0)}</text>
      <text x={w - padR} y={h - padB + 14} textAnchor="end" fontSize="9" fill={MUTE}>{xHi.toFixed(xRange < 5 ? 1 : 0)}</text>
      {trendLine}
      {/* points */}
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3.4" fill={p.color || color} fillOpacity="0.75" stroke="#fff" strokeWidth="0.8">
          {p.label ? <title>{p.label}</title> : null}
        </circle>
      ))}
      {/* axis titles */}
      {xLabel ? (
        <text x={padL + plotW / 2} y={h - 3} textAnchor="middle" fontSize="10" fontWeight="600" fill={SUB}>{xLabel}</text>
      ) : null}
      {yLabel ? (
        <text x={10} y={padT + plotH / 2} textAnchor="middle" fontSize="10" fontWeight="600" fill={SUB} transform={`rotate(-90 10 ${padT + plotH / 2})`}>{yLabel}</text>
      ) : null}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ControlChart — inline-SVG SPC chart: center line + control limits +
// optional EWMA/target overlay + Nelson-style violation markers.
// points: array of numbers OR [{ v }]
// ---------------------------------------------------------------------------
export function ControlChart({ points = [], mean, ucl, lcl, overlay, target, w = 480, h = 200 }) {
  const padL = 40;
  const padR = 14;
  const padT = 12;
  const padB = 22;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const vals = points.map((p) => (typeof p === 'number' ? p : p.v));
  if (vals.length < 2) {
    return <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true" />;
  }

  const cMean = typeof mean === 'number' ? mean : vals.reduce((a, b) => a + b, 0) / vals.length;
  const ovVals = Array.isArray(overlay) ? overlay.filter((v) => typeof v === 'number') : [];

  // Vertical domain spans data + limits + overlay with a little headroom.
  const all = [...vals, ...ovVals];
  if (typeof ucl === 'number') all.push(ucl);
  if (typeof lcl === 'number') all.push(lcl);
  if (typeof target === 'number') all.push(target);
  const dMin = Math.min(...all);
  const dMax = Math.max(...all);
  const dRange = dMax - dMin || 1;
  const yLo = dMin - dRange * 0.1;
  const yHi = dMax + dRange * 0.1;
  const ySpan = yHi - yLo || 1;

  const sx = (i) => padL + (i / (vals.length - 1)) * plotW;
  const sy = (v) => padT + (1 - (v - yLo) / ySpan) * plotH;

  const linePts = vals.map((v, i) => `${sx(i).toFixed(2)},${sy(v).toFixed(2)}`).join(' L ');
  const ovPts = ovVals.length === vals.length
    ? ovVals.map((v, i) => `${sx(i).toFixed(2)},${sy(v).toFixed(2)}`).join(' L ')
    : null;

  const hi = typeof ucl === 'number' ? ucl : null;
  const lo = typeof lcl === 'number' ? lcl : null;
  const isViolation = (v) => (hi !== null && v > hi) || (lo !== null && v < lo);

  const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {/* control-limit shaded envelope */}
      {hi !== null && lo !== null && (
        <rect x={padL} y={sy(hi)} width={plotW} height={Math.max(0, sy(lo) - sy(hi))} fill={GREEN} opacity="0.05" />
      )}
      {/* UCL / LCL */}
      {hi !== null && (
        <>
          <line x1={padL} y1={sy(hi)} x2={w - padR} y2={sy(hi)} stroke={RED} strokeWidth="1.2" strokeDasharray="6 4" />
          <text x={w - padR} y={sy(hi) - 3} textAnchor="end" fontSize="9" fontWeight="700" fill={RED}>UCL {fmt(hi)}</text>
        </>
      )}
      {lo !== null && (
        <>
          <line x1={padL} y1={sy(lo)} x2={w - padR} y2={sy(lo)} stroke={RED} strokeWidth="1.2" strokeDasharray="6 4" />
          <text x={w - padR} y={sy(lo) + 11} textAnchor="end" fontSize="9" fontWeight="700" fill={RED}>LCL {fmt(lo)}</text>
        </>
      )}
      {/* center line */}
      <line x1={padL} y1={sy(cMean)} x2={w - padR} y2={sy(cMean)} stroke={ACCENT} strokeWidth="1.4" />
      <text x={padL - 4} y={sy(cMean) + 3} textAnchor="end" fontSize="9" fontWeight="700" fill={ACCENT}>x̄</text>
      {/* target line (optional) */}
      {typeof target === 'number' && (
        <line x1={padL} y1={sy(target)} x2={w - padR} y2={sy(target)} stroke={CYAN} strokeWidth="1" strokeDasharray="2 3" />
      )}
      {/* EWMA / overlay series (optional) */}
      {ovPts && <path d={`M ${ovPts}`} fill="none" stroke={PURPLE} strokeWidth="1.6" strokeDasharray="4 3" opacity="0.85" />}
      {/* primary series line */}
      <path d={`M ${linePts}`} fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinejoin="round" />
      {/* point markers (red halo on violations) */}
      {vals.map((v, i) => {
        const bad = isViolation(v);
        return (
          <g key={i}>
            {bad && <circle cx={sx(i)} cy={sy(v)} r="6" fill="none" stroke={RED} strokeWidth="1.4" />}
            <circle cx={sx(i)} cy={sy(v)} r="3" fill={bad ? RED : ACCENT} stroke="#fff" strokeWidth="0.8" />
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Toasts — module-level integer id counter (no Date / Math.random)
// ---------------------------------------------------------------------------
let _toastId = 0;

export function useToasts() {
  const [items, setItems] = useState([]);

  const dismiss = (id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  };

  const push = ({ title, msg, type = 'info', duration = 5000 } = {}) => {
    _toastId += 1;
    const id = _toastId;
    setItems((prev) => [...prev, { id, title, msg, type, duration }]);
    // Mirror every toast into the TopBar bell notification centre.
    try { notify({ title, msg, type }); } catch (e) { /* noop */ }
    return id;
  };

  return { push, dismiss, items };
}

const TOAST_META = {
  success: { color: GREEN, icon: <path d="M20 6 9 17l-5-5" /> },
  info: {
    color: BLUE,
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-4M12 8h.01" />
      </>
    ),
  },
  warning: {
    color: AMBER,
    icon: (
      <>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
  },
  error: {
    color: RED,
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 9l-6 6M9 9l6 6" />
      </>
    ),
  },
};

function ToastItem({ item, onDismiss }) {
  const meta = TOAST_META[item.type] || TOAST_META.info;
  const timerRef = useRef(null);

  useEffect(() => {
    if (!item.duration) return undefined;
    timerRef.current = setTimeout(() => onDismiss?.(item.id), item.duration);
    return () => clearTimeout(timerRef.current);
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      style={{
        width: 320,
        background: '#fff',
        borderRadius: 10,
        borderLeft: `4px solid ${meta.color}`,
        boxShadow: '0 8px 28px rgba(15,23,42,0.16)',
        padding: '12px 14px',
        display: 'flex',
        gap: 11,
        alignItems: 'flex-start',
        animation: 'sk-toast-in 0.24s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={meta.color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        {meta.icon}
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{item.title}</div>
        {item.msg && <div style={{ fontSize: 12.5, color: SUB, marginTop: 2, lineHeight: 1.4 }}>{item.msg}</div>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss?.(item.id)}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTE, padding: 2, lineHeight: 0, flexShrink: 0 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastStack({ items = [], onDismiss }) {
  useKeyframes();
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      {items.map((item) => (
        <div key={item.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem item={item} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared layout primitives + palette for the Autonomous Inspection portal pages.
// ---------------------------------------------------------------------------
export const PALETTE = { ACCENT: '#15227a', ACCENT_LIGHT: '#e8ecff', INK: '#0f172a', SUB: '#475569', MUTE: '#94a3b8', LINE: '#e8ecf1', BG: '#f8fafc', GREEN: '#10b981', AMBER: '#f59e0b', RED: '#ef4444', BLUE: '#3b82f6', CYAN: '#0891b2', PURPLE: '#7c3aed' };

// The border is written as three longhands rather than the `border` shorthand.
//
// Callers tint the edge by passing `borderColor` — a warning card in red, a
// selected one in indigo — and React warns whenever a shorthand and one of its
// longhands are both set and the shorthand changes on a rerender, because the
// browser's resolution order between them is not something it can guarantee.
// The computed style is identical either way; this is the form that does not
// make every tinted card log a warning. A caller passing `border` outright
// still wins, since the spread lands after these.
export function Card({ children, style }) {
  return (
    <div style={{
      background: '#fff',
      borderStyle: 'solid', borderWidth: 1, borderColor: '#e8ecf1',
      borderRadius: 14, padding: 18,
      ...style,
    }}>{children}</div>
  );
}

export function Title({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{children}</span>
      {right}
    </div>
  );
}

export function PageHeader({ icon, title, subtitle, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: '#e8ecff', color: '#15227a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{title}</h1>
          {subtitle && <p style={{ margin: '3px 0 0', fontSize: 13, color: '#94a3b8' }}>{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}
