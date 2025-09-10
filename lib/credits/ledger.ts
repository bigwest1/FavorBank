import { prisma } from "@/lib/prisma";

type DB = any; // Use Prisma.TransactionClient in real app; tests can pass in-memory store

async function ensureMembership(tx: DB, circleId: string, userId: string) {
  return tx.membership.upsert({
    where: { userId_circleId: { userId, circleId } },
    update: {},
    create: { circleId, userId, role: "MEMBER" },
  });
}

async function ensureTreasury(tx: DB, circleId: string) {
  return tx.treasury.upsert({
    where: { circleId },
    update: {},
    create: { circleId },
  });
}

async function ensureInsurance(tx: DB, circleId: string) {
  return tx.insurancePool.upsert({
    where: { circleId },
    update: {},
    create: { circleId },
  });
}

async function addLedgerPair(
  tx: DB,
  params: {
    circleId: string;
    amount: number;
    bookingId?: string | null;
    loanId?: string | null;
    fromUserId?: string | null;
    toUserId?: string | null;
    debitType?: "DEBIT" | "FEE" | "ADJUSTMENT" | "CREDIT";
    creditType?: "CREDIT" | "FEE" | "ADJUSTMENT" | "DEBIT";
    meta?: any;
  }
) {
  const { circleId, amount, bookingId = null, loanId = null, fromUserId = null, toUserId = null, meta } = params;
  const debitType = params.debitType ?? "DEBIT";
  const creditType = params.creditType ?? "CREDIT";
  await tx.ledgerEntry.createMany({
    data: [
      { circleId, amount, bookingId, loanId, fromUserId, toUserId: null, type: debitType, meta },
      { circleId, amount, bookingId, loanId, fromUserId: null, toUserId, type: creditType, meta },
    ],
  });
}

async function bumpMembership(tx: DB, circleId: string, userId: string, delta: number) {
  await ensureMembership(tx, circleId, userId);
  await tx.membership.update({
    where: { userId_circleId: { userId, circleId } },
    data: { balanceCredits: { increment: delta } },
  });
}

async function bumpTreasury(tx: DB, circleId: string, balanceDelta = 0, reservedDelta = 0) {
  await ensureTreasury(tx, circleId);
  const data: any = {};
  if (balanceDelta) data.balanceCredits = { increment: balanceDelta };
  if (reservedDelta) data.reservedCredits = { increment: reservedDelta };
  if (Object.keys(data).length) {
    await tx.treasury.update({ where: { circleId }, data });
  }
}

async function bumpInsurance(tx: DB, circleId: string, delta: number) {
  await ensureInsurance(tx, circleId);
  await tx.insurancePool.update({ where: { circleId }, data: { balance: { increment: delta } } });
}

function getDb(db?: DB) {
  const real = db ?? prisma;
  return {
    $transaction: (fn: (tx: DB) => Promise<any>) => real.$transaction(fn),
  } as any;
}

export async function deposit(db: DB, circleId: string, userId: string, amount: number, meta?: any) {
  const client = getDb(db);
  return client.$transaction(async (tx: DB) => {
    await addLedgerPair(tx, {
      circleId,
      amount,
      fromUserId: null,
      toUserId: userId,
      meta: { kind: meta?.kind ?? "deposit", ...meta, counterparty: "external" },
    });
    await bumpMembership(tx, circleId, userId, amount);
  });
}

export async function earn(db: DB, circleId: string, fromUserId: string, toUserId: string, amount: number, meta?: any) {
  const client = getDb(db);
  return client.$transaction(async (tx: DB) => {
    await addLedgerPair(tx, {
      circleId,
      amount,
      fromUserId,
      toUserId,
      meta: { kind: "earn", ...meta },
    });
    await bumpMembership(tx, circleId, fromUserId, -amount);
    await bumpMembership(tx, circleId, toUserId, amount);
  });
}

export async function spend(db: DB, circleId: string, userId: string, amount: number, meta?: any) {
  const client = getDb(db);
  return client.$transaction(async (tx: DB) => {
    await addLedgerPair(tx, {
      circleId,
      amount,
      fromUserId: userId,
      toUserId: null,
      meta: { kind: "spend", ...meta, counterparty: "treasury" },
    });
    await bumpMembership(tx, circleId, userId, -amount);
    await bumpTreasury(tx, circleId, amount, 0);
  });
}

export async function applyFee(db: DB, circleId: string, userId: string, amount: number, meta?: any) {
  const client = getDb(db);
  return client.$transaction(async (tx: DB) => {
    await addLedgerPair(tx, {
      circleId,
      amount,
      fromUserId: userId,
      toUserId: null,
      debitType: "FEE",
      creditType: "FEE",
      meta: { kind: "fee", ...meta, counterparty: "treasury" },
    });
    await bumpMembership(tx, circleId, userId, -amount);
    await bumpTreasury(tx, circleId, amount, 0);
  });
}

export async function escrowLock(db: DB, circleId: string, fromUserId: string, amount: number, bookingId: string, meta?: any) {
  const client = getDb(db);
  return client.$transaction(async (tx: DB) => {
    await addLedgerPair(tx, {
      circleId,
      amount,
      bookingId,
      fromUserId,
      toUserId: null,
      debitType: "ADJUSTMENT",
      creditType: "ADJUSTMENT",
      meta: { kind: "escrow_lock", ...meta, counterparty: "treasury_reserved" },
    });
    await bumpMembership(tx, circleId, fromUserId, -amount);
    await bumpTreasury(tx, circleId, 0, amount);
  });
}

export async function escrowRelease(db: DB, circleId: string, fromUserId: string, toUserId: string, amount: number, bookingId: string, meta?: any) {
  const client = getDb(db);
  return client.$transaction(async (tx: DB) => {
    await addLedgerPair(tx, {
      circleId,
      amount,
      bookingId,
      fromUserId: null,
      toUserId,
      debitType: "ADJUSTMENT",
      creditType: "ADJUSTMENT",
      meta: { kind: "escrow_release", ...meta, counterparty: "treasury_reserved" },
    });
    await bumpTreasury(tx, circleId, 0, -amount);
    await bumpMembership(tx, circleId, toUserId, amount);
  });
}

export async function guaranteePoolFund(db: DB, circleId: string, amount: number, meta?: any) {
  const client = getDb(db);
  return client.$transaction(async (tx: DB) => {
    await addLedgerPair(tx, {
      circleId,
      amount,
      fromUserId: null,
      toUserId: null,
      debitType: "ADJUSTMENT",
      creditType: "ADJUSTMENT",
      meta: { kind: "pool_fund", ...meta, from: "treasury", to: "insurance_pool" },
    });
    await bumpTreasury(tx, circleId, -amount, 0);
    await bumpInsurance(tx, circleId, amount);
  });
}

export async function guaranteePoolPayout(db: DB, circleId: string, userId: string, amount: number, meta?: any) {
  const client = getDb(db);
  return client.$transaction(async (tx: DB) => {
    await addLedgerPair(tx, {
      circleId,
      amount,
      fromUserId: null,
      toUserId: userId,
      debitType: "ADJUSTMENT",
      creditType: "ADJUSTMENT",
      meta: { kind: "pool_payout", ...meta, from: "insurance_pool", to: "user" },
    });
    await bumpInsurance(tx, circleId, -amount);
    await bumpMembership(tx, circleId, userId, amount);
  });
}

export async function loanIssue(tx: DB, circleId: string, borrowerId: string, amount: number, loanId: string, meta?: any) {
  // Loan should already exist - this is just recording the ledger entry
  await addLedgerPair(tx, {
    circleId,
    amount,
    loanId,
    fromUserId: null,
    toUserId: borrowerId,
    debitType: "DEBIT",
    creditType: "CREDIT",
    meta: { kind: "loan_issue", loanId, ...meta, from: "treasury", to: "user" },
  });
  await bumpTreasury(tx, circleId, -amount, 0);
  await bumpMembership(tx, circleId, borrowerId, amount);
}

export async function loanRepay(tx: DB, circleId: string, borrowerId: string, amount: number, loanId: string, meta?: any) {
  // Don't update loan here - that's handled by the service layer
  await addLedgerPair(tx, {
    circleId,
    amount,
    loanId,
    fromUserId: borrowerId,
    toUserId: null,
    debitType: "DEBIT",
    creditType: "CREDIT",
    meta: { kind: "loan_repay", loanId, ...meta, from: "user", to: "treasury" },
  });
  await bumpMembership(tx, circleId, borrowerId, -amount);
  await bumpTreasury(tx, circleId, amount, 0);
}

export async function insurancePremium(db: DB, circleId: string, userId: string, amount: number, meta?: any) {
  const client = getDb(db);
  return client.$transaction(async (tx: DB) => {
    await addLedgerPair(tx, {
      circleId,
      amount,
      fromUserId: userId,
      toUserId: null,
      debitType: "ADJUSTMENT",
      creditType: "ADJUSTMENT",
      meta: { kind: "insurance_premium", ...meta, from: "user", to: "insurance_pool" },
    });
    await bumpMembership(tx, circleId, userId, -amount);
    await bumpInsurance(tx, circleId, amount);
  });
}

export async function insurancePayout(db: DB, circleId: string, userId: string, amount: number, meta?: any) {
  return guaranteePoolPayout(db, circleId, userId, amount, { kind: "insurance_payout", ...meta });
}
