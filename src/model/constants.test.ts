import { describe, expect, it } from 'vitest'
import { PROJECT_HEIGHT, PROJECT_WIDTH } from './constants'

describe('constants', () => {
  it('is 9:16', () => {
    expect(PROJECT_WIDTH / PROJECT_HEIGHT).toBeCloseTo(9 / 16)
  })
})
