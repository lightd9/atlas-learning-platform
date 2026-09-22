import { randomBytes } from 'crypto'

const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length)
  let password = ''
  for (let index = 0; index < length; index += 1) {
    password += TEMP_PASSWORD_ALPHABET[bytes[index] % TEMP_PASSWORD_ALPHABET.length]
  }
  return password
}