import type { Company } from '../api/types'

/** Companies that have an accounting short name: the columns of the Depara and Fornecedores, in name order. */
export function accountingCompanies(companies: Company[]): Company[] {
  return companies
    .filter((company) => company.accounting.shortName)
    .sort((a, b) => (a.accounting.shortName ?? '').localeCompare(b.accounting.shortName ?? ''))
}

/** CPF (11 digits) or CNPJ (14) with punctuation; anything else as it is. */
export function formatDocument(document: string | null): string {
  if (!document) return ''
  if (/^\d{11}$/.test(document)) return document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (document.length === 14) return `${document.slice(0, 2)}.${document.slice(2, 5)}.${document.slice(5, 8)}/${document.slice(8, 12)}-${document.slice(12)}`
  return document
}
