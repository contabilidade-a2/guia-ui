/** Lower case, without accents, so typing "sao" finds "São Paulo". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Keeps only the digits: plan and Cigam numbers are identifiers, so a leading zero is kept (`099481`). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}
