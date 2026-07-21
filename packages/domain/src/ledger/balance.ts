/**
 * NFR-D1 / FR-C17: Core domain logic for ledger running balances and sign constraint validation.
 */

export type LedgerEntryInput = {
  id: bigint;
  entryType: string;
  amountPaise: bigint;
  paidOn: string;
};

export function computeRunningBalances<T extends LedgerEntryInput>(
  entries: T[]
): (T & { runningBalancePaise: bigint })[] {
  // Sort chronologically. If dates match, sort by ID to ensure stability and causality.
  const sorted = [...entries].sort((a, b) => {
    const timeA = new Date(a.paidOn).getTime();
    const timeB = new Date(b.paidOn).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  });

  let runningBalance = 0n;
  return sorted.map(entry => {
    runningBalance += entry.amountPaise;
    return {
      ...entry,
      runningBalancePaise: runningBalance
    };
  });
}

export function validateLedgerSign(entryType: string, displayAmountPaise: bigint): bigint {
  // Matches DB CHECK: inflows (token/installment/registration) positive; refund/reversal negative.
  const isNegativeType = entryType === 'refund' || entryType === 'reversal';
  const absAmount = displayAmountPaise < 0n ? -displayAmountPaise : displayAmountPaise;
  return isNegativeType ? -absAmount : absAmount;
}
