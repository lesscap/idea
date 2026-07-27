import { cn } from '../../lib/cn'

// Text avatar: an initial on a colour derived from the seed.
//
// No upload, no storage, no broken-image state, and the same person is always
// the same colour on every device because the colour is computed rather than
// stored. When image upload arrives this stays as the fallback for everyone who
// has not set one.

// Fixed palette rather than a random hue: hand-picked values stay legible
// against white text, whereas an arbitrary hue lands on yellows that do not.
const COLOURS = [
  'bg-teal-600',
  'bg-sky-600',
  'bg-indigo-600',
  'bg-violet-600',
  'bg-rose-600',
  'bg-orange-600',
  'bg-emerald-600',
  'bg-cyan-700',
] as const

// Deterministic and stable across reloads and machines — the point is that a
// colleague is recognisable by colour, which only works if it never changes.
const pick = (seed: string): string => {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return COLOURS[Math.abs(hash) % COLOURS.length] ?? COLOURS[0]
}

// One character. For CJK names the first character is the surname and carries
// more identity than two Latin-style initials would.
const initial = (name: string): string => [...name.trim()][0]?.toUpperCase() ?? '?'

type Props = {
  /** Display name — supplies the letter. */
  name: string
  /** Stable identifier — supplies the colour. Username, not display name, so a
   *  rename does not change someone's colour. */
  seed: string
  className?: string
}

export const Avatar = ({ name, seed, className }: Props) => (
  <span
    aria-hidden
    className={cn(
      'inline-flex size-7 shrink-0 select-none items-center justify-center rounded-full',
      'text-xs font-medium text-white',
      pick(seed),
      className,
    )}
  >
    {initial(name)}
  </span>
)
