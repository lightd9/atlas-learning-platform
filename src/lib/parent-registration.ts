import { randomBytes } from 'node:crypto'

export function createParentRegistrationToken() {
  return randomBytes(24).toString('hex')
}

export function parentRegistrationPath(token: string) {
  return `/register?school=${token}`
}
