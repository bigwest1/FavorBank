import { describe, it, expect } from 'vitest'
import {
  computeFee,
  createPurchasedLot,
  priceSpend,
  selectLots,
  surchargeRate,
} from '@/lib/credits/tiers'

describe('tiers pricing and selection', () => {
  it('computes base fees for tiers', () => {
    expect(computeFee(100, 'BASIC').fee).toBe(8)
    expect(computeFee(100, 'PRIORITY').fee).toBe(12)
    expect(computeFee(100, 'GUARANTEED').fee).toBe(18)
  })

  it('applies surcharges and caps at +18%', () => {
    // peak + urgent + equipment + crossCircle = 0.02 + 0.05 + 0.03 + 0.10 = 0.20 -> cap 0.18
    const s = surchargeRate({ peak: true, urgent: true, equipment: true, crossCircle: true })
    expect(s).toBe(0.18)
    const total = computeFee(100, 'BASIC', { peak: true, urgent: true, equipment: true, crossCircle: true })
    // base 0.08 + surcharges 0.18 = 0.26 -> 26 on 100
    expect(total.fee).toBe(26)
  })

  it('selects lots by default order G -> P -> B and by expiry within tier', () => {
    const lots = [
      createPurchasedLot({ id: 'b1', tier: 'BASIC', amount: 50 }),
      createPurchasedLot({ id: 'g1', tier: 'GUARANTEED', amount: 10, expiresAt: new Date('2030-01-01') }),
      createPurchasedLot({ id: 'p1', tier: 'PRIORITY', amount: 20 }),
      createPurchasedLot({ id: 'g0', tier: 'GUARANTEED', amount: 5, expiresAt: new Date('2029-01-01') }),
    ]
    const { picks, leftover } = selectLots(lots, 25)
    expect(leftover).toBe(0)
    expect(picks.map(p => p.lot.id)).toEqual(['g0', 'g1', 'p1'])
    expect(picks.map(p => p.use)).toEqual([5, 10, 10])
  })

  it('supports user override order (Basic first)', () => {
    const lots = [
      createPurchasedLot({ id: 'b1', tier: 'BASIC', amount: 10 }),
      createPurchasedLot({ id: 'g1', tier: 'GUARANTEED', amount: 10 }),
      createPurchasedLot({ id: 'p1', tier: 'PRIORITY', amount: 10 }),
    ]
    const { picks } = selectLots(lots, 15, { order: ['BASIC', 'PRIORITY', 'GUARANTEED'] })
    expect(picks.map(p => p.lot.id)).toEqual(['b1', 'p1'])
    expect(picks.map(p => p.use)).toEqual([10, 5])
  })

  it('prices a multi-lot spend correctly with shared context', () => {
    const lots = [
      createPurchasedLot({ id: 'g', tier: 'GUARANTEED', amount: 10 }),
      createPurchasedLot({ id: 'p', tier: 'PRIORITY', amount: 10 }),
      createPurchasedLot({ id: 'b', tier: 'BASIC', amount: 10 }),
    ]
    const { breakdown, totalFee, leftover } = priceSpend(lots, 25, { urgent: true })
    // urgent adds +5% to each part
    // first 10 @ G: (0.18 + 0.05) * 10 = 2.3 -> 2 after rounding? 2.3 rounds to 2
    // Actually Math.round -> 2
    // next 10 @ P: (0.12 + 0.05) * 10 = 1.7 -> 2
    // last 5 @ B: (0.08 + 0.05) * 5 = 0.65 -> 1
    expect(breakdown.map(b => [b.lotId, b.fee])).toEqual([['g', 2], ['p', 2], ['b', 1]])
    expect(totalFee).toBe(5)
    expect(leftover).toBe(0)
  })
})

