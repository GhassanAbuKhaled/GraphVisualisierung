/** d3.schemeTableau10 */
export const TABLEAU10: readonly string[] = [
  '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
  '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab',
]

/** Vertices without edges (never colored, as in the C program). */
export const UNCOLORED = '#52525b'

const GOLDEN_ANGLE = 137.508

/** Color of class i: Tableau 10 first, then golden-angle hues so neighbors differ clearly. */
export function classColor(i: number): string {
  if (i < 0) return UNCOLORED
  if (i < TABLEAU10.length) return TABLEAU10[i]
  return hslToHex((i * GOLDEN_ANGLE) % 360, 0.65, 0.55)
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const channel = (k: number) => {
    const t = (k + h / 30) % 12
    const value = l - a * Math.max(-1, Math.min(t - 3, 9 - t, 1))
    return Math.round(value * 255).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}
