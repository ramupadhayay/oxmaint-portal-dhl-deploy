import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * The class joiner every shadcn component expects, and the one the real product
 * uses at @/lib/utils. Kept here rather than at the app root because Tailwind is
 * scoped to this portal — nothing outside it has classes to merge.
 *
 * twMerge on top of clsx is what makes a caller's `className` win: without it,
 * passing "p-6" to a component whose base is "p-4" leaves both in the string and
 * the winner is whichever Tailwind emitted last, not the one the caller asked
 * for.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
