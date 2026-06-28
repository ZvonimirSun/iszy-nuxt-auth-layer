import { randomBytes } from 'node:crypto'

export function randomState(size = 16) {
  return randomBytes(size).toString('hex').slice(0, size)
}
