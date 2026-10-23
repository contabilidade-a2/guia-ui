/** Business units ("Unidade Negocio" of the accounting export) as typed by the user: "1-26, 200" or "1, 2, 3". */
export function parseBusinessUnits(text: string): string[] | null {
  const units = new Set<string>()
  for (const part of text.split(/[,;\s]+/).filter(Boolean)) {
    const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(part)
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])]
      // A typo like "1-20000" would create thousands of units: refuse instead.
      if (from > to || to - from > 500) return null
      for (let unit = from; unit <= to; unit += 1) units.add(String(unit))
    } else if (/^\d+$/.test(part)) {
      units.add(String(Number(part)))
    } else {
      return null
    }
  }
  return [...units]
}

/** ["1", "2", "3", "200"] → "1–3, 200" (the list comes sorted from the API). */
export function formatBusinessUnits(units: string[]): string {
  const numbers = units.map(Number).sort((a, b) => a - b)
  const parts: string[] = []
  let start = numbers[0]
  for (let i = 1; i <= numbers.length; i += 1) {
    if (numbers[i] !== numbers[i - 1] + 1) {
      const end = numbers[i - 1]
      parts.push(start === end ? String(start) : `${start}–${end}`)
      start = numbers[i]
    }
  }
  return numbers.length === 0 ? '' : parts.join(', ')
}
