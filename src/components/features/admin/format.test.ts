import { describe, it, expect } from 'vitest'
import { personLabel } from './format'

const id = '123e4567-e89b-12d3-a456-426614174000'

describe('personLabel', () => {
  it('shows name with email under it', () => {
    expect(personLabel({ name: 'Mona', email: 'm@x.co', id })).toEqual({ primary: 'Mona', secondary: 'm@x.co', initial: 'M' })
  })
  it('falls back to the email when the name is blank or only spaces', () => {
    expect(personLabel({ name: '', email: 'sam@x.co', id })).toEqual({ primary: 'sam@x.co', secondary: 'ID 123e4567', initial: 'S' })
    expect(personLabel({ name: '   ', email: 'sam@x.co', id }).primary).toBe('sam@x.co')
  })
  it('falls back to the id when there is nothing else, and handles masked emails', () => {
    expect(personLabel({ name: null, email: null, id })).toEqual({ primary: 'User 123e4567', secondary: null, initial: 'U' })
    expect(personLabel({ name: null, email: 'a***@x.co', id }).primary).toBe('a***@x.co')
  })
})
