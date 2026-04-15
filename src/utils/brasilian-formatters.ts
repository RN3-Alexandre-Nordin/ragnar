/**
 * Brazilian Specific Formatters and Validators (Ragnar Project)
 */

/**
 * Removes all non-digit characters from a string.
 */
export const cleanDigits = (value: string): string => {
  return value.replace(/\D/g, '')
}

/**
 * Applies CNPJ mask: 00.000.000/0001-00
 */
export const maskCNPJ = (value: string): string => {
  const digits = cleanDigits(value).slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

/**
 * Applies Phone mask: (00) 00000-0000 or (00) 0000-0000
 */
export const maskPhone = (value: string): string => {
  const digits = cleanDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/**
 * Official CNPJ validation algorithm.
 */
export const validateCNPJ = (cnpj: string): boolean => {
  const digits = cleanDigits(cnpj)
  if (digits.length !== 14) return false

  // Reject known invalid patterns
  if (/^(\d)\1+$/.test(digits)) return false

  const calc = (s: string, n: number) => {
    let sum = 0
    let weight = n - 7
    for (let i = s.length; i >= 1; i--) {
      sum += parseInt(s.charAt(s.length - i)) * weight--
      if (weight < 2) weight = 9
    }
    const res = sum % 11
    return res < 2 ? 0 : 11 - res
  }

  const s = digits.substring(0, 12)
  const digit1 = calc(s, 12)
  const digit2 = calc(s + digit1, 13)

  return digits.substring(12) === `${digit1}${digit2}`
}
