import { describe, it, expect, beforeEach } from 'vitest'
import * as ledger from '@/lib/credits/ledger'

function createMemoryDb() {
  type Key = string
  const memberships = new Map<Key, any>()
  const treasuries = new Map<string, any>()
  const pools = new Map<string, any>()
  const loans = new Map<string, any>()
  const ledgerEntries: any[] = []

  const db: any = {
    membership: {
      upsert: async ({ where, update, create }: any) => {
        const key = `${where.userId_circleId.userId}|${where.userId_circleId.circleId}`
        if (memberships.has(key)) return memberships.get(key)
        const row = { id: key, balanceCredits: 0, role: 'MEMBER', ...create }
        memberships.set(key, row)
        return row
      },
      update: async ({ where, data }: any) => {
        const key = `${where.userId_circleId.userId}|${where.userId_circleId.circleId}`
        const row = memberships.get(key)
        if (data.balanceCredits?.increment) row.balanceCredits += data.balanceCredits.increment
        memberships.set(key, row)
        return row
      },
    },
    treasury: {
      upsert: async ({ where, create }: any) => {
        const key = where.circleId
        if (treasuries.has(key)) return treasuries.get(key)
        const row = { id: key, circleId: key, balanceCredits: 0, reservedCredits: 0, ...create }
        treasuries.set(key, row)
        return row
      },
      update: async ({ where, data }: any) => {
        const row = treasuries.get(where.circleId)
        if (data.balanceCredits?.increment) row.balanceCredits += data.balanceCredits.increment
        if (data.reservedCredits?.increment) row.reservedCredits += data.reservedCredits.increment
        treasuries.set(where.circleId, row)
        return row
      },
    },
    insurancePool: {
      upsert: async ({ where, create }: any) => {
        const key = where.circleId
        if (pools.has(key)) return pools.get(key)
        const row = { id: key, circleId: key, balance: 0, ...create }
        pools.set(key, row)
        return row
      },
      update: async ({ where, data }: any) => {
        const row = pools.get(where.circleId)
        if (data.balance?.increment) row.balance += data.balance.increment
        pools.set(where.circleId, row)
        return row
      },
    },
    loan: {
      create: async ({ data }: any) => {
        const id = `loan_${loans.size + 1}`
        const row = { id, ...data }
        loans.set(id, row)
        return row
      },
      update: async ({ where, data }: any) => {
        const row = loans.get(where.id)
        if (data.principal?.increment) row.principal += data.principal.increment
        if (data.remaining?.increment) row.remaining += data.remaining.increment
        if (data.remaining?.decrement) row.remaining -= data.remaining.decrement
        loans.set(where.id, row)
        return row
      },
    },
    ledgerEntry: {
      createMany: async ({ data }: any) => {
        for (const d of data) ledgerEntries.push({ id: `le_${ledgerEntries.length+1}`, ...d })
        return { count: data.length }
      },
    },
    $transaction: async (fn: any) => fn(db),
    _state: { memberships, treasuries, pools, loans, ledgerEntries },
  }
  return db
}

describe('ledger engine', () => {
  let db: any
  const circle = 'c1'
  const alice = 'u_alice'
  const bob = 'u_bob'

  beforeEach(() => {
    db = createMemoryDb()
  })

  it('runs sample flows and reconciles balances', async () => {
    await ledger.deposit(db, circle, alice, 100)
    await ledger.escrowLock(db, circle, alice, 30, 'b1')
    await ledger.escrowRelease(db, circle, bob, 30, 'b1')
    await ledger.applyFee(db, circle, bob, 3)
    await ledger.insurancePremium(db, circle, bob, 2)
    await ledger.insurancePayout(db, circle, bob, 1)
    const loan = await ledger.loanIssue(db, circle, bob, 10)
    await ledger.loanRepay(db, circle, bob, 4, loan.id)
    await ledger.spend(db, circle, bob, 2)

    const state = db._state
    const balAlice = state.memberships.get(`${alice}|${circle}`).balanceCredits
    const balBob = state.memberships.get(`${bob}|${circle}`).balanceCredits
    const treasury = state.treasuries.get(circle)
    const pool = state.pools.get(circle)
    const loanRow = state.loans.get(loan.id)

    expect(balAlice).toBe(70)
    expect(balBob).toBe(30)
    // Treasury: +fee(3) +spend(2) -loanIssue(10) => -5, reserved should be 0
    expect(treasury.reservedCredits).toBe(0)
    expect(treasury.balanceCredits).toBe(-5)
    // Pool: +premium(2) -payout(1) => 1
    expect(pool.balance).toBe(1)
    // Loan remaining: 10 - 4 => 6
    expect(loanRow.remaining).toBe(6)
    // Ledger entries created (pairs)
    expect(state.ledgerEntries.length).toBeGreaterThan(0)
  })
})

