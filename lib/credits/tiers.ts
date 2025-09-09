export type LotTier = "BASIC" | "PRIORITY" | "GUARANTEED";

export interface SpendContext {
  peak?: boolean; // +2%
  urgent?: boolean; // +5%
  equipment?: boolean; // +3%
  crossCircle?: boolean; // +10%
}

export interface CreditLotLike {
  id: string;
  tier: LotTier;
  remaining: number;
  expiresAt?: Date | null;
}

export const TIER_FEES: Record<LotTier, number> = {
  BASIC: 0.08,
  PRIORITY: 0.12,
  GUARANTEED: 0.18,
};

export const SURCHARGES = {
  peak: 0.02,
  urgent: 0.05,
  equipment: 0.03,
  crossCircle: 0.10,
} as const;

export type SurchargeKey = keyof typeof SURCHARGES;

export function surchargeRate(ctx?: SpendContext): number {
  if (!ctx) return 0;
  let sum = 0;
  for (const k of Object.keys(SURCHARGES) as SurchargeKey[]) {
    if ((ctx as any)[k]) sum += SURCHARGES[k];
  }
  // Cap surcharges at +18%
  return Math.min(sum, 0.18);
}

export function computeFee(amount: number, tier: LotTier, ctx?: SpendContext) {
  const baseRate = TIER_FEES[tier];
  const sRate = surchargeRate(ctx);
  const totalRate = baseRate + sRate;
  const fee = Math.round(amount * totalRate);
  return { baseRate, surchargeRate: sRate, totalRate, fee };
}

export function createPurchasedLot(params: {
  id: string;
  tier: LotTier;
  amount: number;
  expiresAt?: Date | null;
}): CreditLotLike {
  return {
    id: params.id,
    tier: params.tier,
    remaining: params.amount,
    expiresAt: params.expiresAt ?? null,
  };
}

export type TierOrder = LotTier[];

const DEFAULT_ORDER: TierOrder = ["GUARANTEED", "PRIORITY", "BASIC"];

function cmpByExpiry(a?: Date | null, b?: Date | null): number {
  if (!a && !b) return 0;
  if (!a) return 1; // put non-expiring after expiring
  if (!b) return -1;
  return a.getTime() - b.getTime();
}

export function selectLots(
  lots: CreditLotLike[],
  amount: number,
  opts?: { order?: TierOrder }
) {
  const order = opts?.order ?? DEFAULT_ORDER;
  const tierRank = new Map(order.map((t, i) => [t, i] as const));
  const sorted = [...lots]
    .filter((l) => l.remaining > 0)
    .sort((a, b) => {
      const r = (tierRank.get(a.tier) ?? 999) - (tierRank.get(b.tier) ?? 999);
      if (r !== 0) return r;
      return cmpByExpiry(a.expiresAt ?? null, b.expiresAt ?? null);
    });

  const picks: { lot: CreditLotLike; use: number }[] = [];
  let need = amount;
  for (const lot of sorted) {
    if (need <= 0) break;
    const use = Math.min(lot.remaining, need);
    if (use > 0) {
      picks.push({ lot, use });
      need -= use;
    }
  }
  return { picks, leftover: Math.max(0, need) };
}

export function priceSpend(
  lots: CreditLotLike[],
  amount: number,
  ctx?: SpendContext,
  opts?: { order?: TierOrder }
) {
  const { picks, leftover } = selectLots(lots, amount, opts);
  let totalFee = 0;
  const breakdown = picks.map(({ lot, use }) => {
    const fee = computeFee(use, lot.tier, ctx);
    totalFee += fee.fee;
    return { lotId: lot.id, tier: lot.tier, amount: use, ...fee };
  });
  return { totalFee, breakdown, leftover };
}

