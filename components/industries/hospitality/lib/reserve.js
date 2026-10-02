'use client'

// The reserve arithmetic.
//
// This is the straight-line component method, which is what a reserve study
// does and what the article describes: every component has an age, a useful
// life and a replacement cost, and from those three come the three numbers a
// board is actually asking about.
//
//   Fully funded balance — what should be in the account today, being the
//   share of each component's cost that its life has already used up. A roof
//   twelve years into a twenty-five year life has 12/25 of its replacement
//   cost owed to it.
//
//   Percent funded — the balance against that. Under 50% is the level the
//   article calls high risk, and it is where this community sits.
//
//   Annual requirement — the sum of each component's cost divided by its life.
//   This is what has to go in every year for the account to keep pace, before
//   any catching up on the gap.
//
// And the forecast, which the article is right to call the valuable output:
// year by year, what falls due, what the balance does against it, and the year
// it goes negative. A board that can see that year has a governance tool. One
// that cannot is setting dues by what feels acceptable.
//
// Two honesties. Inflation is applied to future replacement costs because
// ignoring it understates the gap, and the rate is stated on the screen rather
// than buried. And none of this replaces a study by a licensed reserve
// specialist — the article says so and so does the screen.

// Extension on purpose. Next resolves either, but written this way the reserve
// arithmetic also runs under plain node — which is how it gets checked without
// a browser in the loop.
import { COMPONENTS, COMMUNITY, COMPONENT_TYPES } from './community.js'

/** Cost inflation on future replacements. Shown on screen, not hidden here. */
export const INFLATION = 0.03

/** Interest earned on the reserve balance. Deliberately conservative. */
export const INTEREST = 0.02

export const THIS_YEAR = new Date().getFullYear()

/** One component, with everything the reserve view needs worked out. */
export function componentView(c) {
  const age = Math.max(0, THIS_YEAR - c.installed)
  // Remaining useful life never goes below zero: a component past its life is
  // due now, not overdue by a negative number.
  const remaining = Math.max(0, c.usefulLife - age)
  const dueYear = c.installed + c.usefulLife
  const overdue = dueYear < THIS_YEAR
  // What the replacement will cost in the year it lands.
  const futureCost = Math.round(c.replacementCost * (1 + INFLATION) ** Math.max(0, dueYear - THIS_YEAR))
  return {
    ...c,
    typeLabel: COMPONENT_TYPES[c.type]?.label || c.type,
    priority: COMPONENT_TYPES[c.type]?.priority || 'Medium',
    pm: COMPONENT_TYPES[c.type]?.pm || '',
    tasks: COMPONENT_TYPES[c.type]?.tasks || '',
    age,
    remaining,
    dueYear,
    overdue,
    futureCost,
    // The share of this component's cost that its life has already consumed.
    accrued: Math.round(c.replacementCost * Math.min(1, age / c.usefulLife)),
    // What it needs each year to fund itself over its life.
    annualShare: Math.round(c.replacementCost / c.usefulLife),
    // Condition, as a word. 5 is new, 1 is failing.
    conditionLabel: ['—', 'Failing', 'Poor', 'Fair', 'Good', 'Excellent'][c.condition] || '—',
  }
}

export const COMPONENT_VIEW = COMPONENTS.map(componentView)

/** The position today. */
export const POSITION = (() => {
  const replacementTotal = COMPONENT_VIEW.reduce((n, c) => n + c.replacementCost, 0)
  const fullyFunded = COMPONENT_VIEW.reduce((n, c) => n + c.accrued, 0)
  const annualRequirement = COMPONENT_VIEW.reduce((n, c) => n + c.annualShare, 0)
  const balance = COMMUNITY.reserveBalance
  const percentFunded = fullyFunded ? balance / fullyFunded : 1
  const shortfall = Math.max(0, fullyFunded - balance)

  return {
    replacementTotal,
    fullyFunded,
    balance,
    percentFunded,
    shortfall,
    annualRequirement,
    contributing: COMMUNITY.annualReserveContribution,
    // The gap between what goes in and what should. This is the number a board
    // argues about, so it is computed rather than described.
    annualGap: Math.max(0, annualRequirement - COMMUNITY.annualReserveContribution),
    // Per unit per month, because that is the unit a homeowner thinks in and
    // the one a dues increase is actually voted on.
    perUnitMonth: Math.round(annualRequirement / COMMUNITY.units / 12),
    contributingPerUnitMonth: Math.round(COMMUNITY.annualReserveContribution / COMMUNITY.units / 12),
    // Under 50% is the level the article calls high risk.
    risk: (balance / (fullyFunded || 1)) < 0.3 ? 'Critical'
      : (balance / (fullyFunded || 1)) < 0.5 ? 'High'
        : (balance / (fullyFunded || 1)) < 0.7 ? 'Fair' : 'Strong',
  }
})()

/**
 * The cash-flow forecast, year by year.
 *
 * @param years      how far ahead — the article's range is 5 to 20
 * @param contribution what goes in annually; the screen varies this to show
 *                     what closing the gap would take
 */
export function forecast(years = 20, contribution = COMMUNITY.annualReserveContribution) {
  let balance = COMMUNITY.reserveBalance
  const rows = []
  let firstNegative = null

  for (let i = 0; i < years; i += 1) {
    const year = THIS_YEAR + i
    // Anything already past its life lands in the first year rather than
    // disappearing off the back of the forecast.
    const due = COMPONENT_VIEW.filter((c) => (c.dueYear <= THIS_YEAR ? i === 0 : c.dueYear === year))
    const spend = due.reduce((n, c) => n + c.futureCost, 0)

    const opening = balance
    balance = Math.round((balance + contribution) * (1 + INTEREST) - spend)
    if (balance < 0 && firstNegative === null) firstNegative = year

    rows.push({
      year,
      opening,
      contribution,
      spend,
      due,
      closing: balance,
      negative: balance < 0,
    })
  }

  return { rows, firstNegative, endBalance: balance }
}

/**
 * What annual contribution would keep the balance non-negative for the horizon.
 *
 * Found by search rather than algebra: the interest compounding makes the
 * closed form fiddly and a board wants the number, not the derivation. Stepped
 * to the nearest thousand so the answer is one somebody could actually put in a
 * budget.
 */
export function requiredContribution(years = 20) {
  let lo = 0
  let hi = 600_000
  for (let i = 0; i < 40; i += 1) {
    const mid = Math.round((lo + hi) / 2)
    if (forecast(years, mid).rows.some((r) => r.negative)) lo = mid
    else hi = mid
  }
  return Math.ceil(hi / 1000) * 1000
}

/** A special assessment, if the gap were closed in one go instead. */
export function specialAssessmentPerUnit(years = 20) {
  const worst = forecast(years).rows.reduce((n, r) => Math.min(n, r.closing), 0)
  return Math.max(0, Math.round(Math.abs(worst) / COMMUNITY.units))
}

export const money = (n) => (n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`)
export const moneyShort = (n) => {
  if (n == null) return '—'
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${n < 0 ? '-' : ''}$${(a / 1_000_000).toFixed(1)}M`
  if (a >= 1_000) return `${n < 0 ? '-' : ''}$${Math.round(a / 1000)}K`
  return `${n < 0 ? '-' : ''}$${Math.round(a)}`
}
export const pct = (n) => `${Math.round(n * 100)}%`
