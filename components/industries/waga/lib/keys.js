// Stable keys for the WAGA registers.
//
// useRecords memoises on its `idOf` argument, so an arrow written inline at the
// call site is a new function on every render and the merge reruns every time.
// Defined once here, the merge reruns only when the records change — and every
// screen that counts a register counts it by the same key.

export const permitKey = (p) => p.permitId
export const requirementKey = (r) => r.requirementId
export const deviationKey = (d) => d.deviationId || d.recordId
