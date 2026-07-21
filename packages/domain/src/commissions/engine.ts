/**
 * FR-C18: Domain-level commission tranche computation.
 * Uses integer paise arithmetic to avoid rounding loss (NFR-D1).
 */

export type TrancheSplit = {
  token: number;
  agreement: number;
  registration: number;
};

export type ComputedTranches = {
  token: bigint;
  agreement: bigint;
  registration: bigint;
};

export function computeCommissionTranches(
  considerationPaise: bigint,
  rateBps: number,
  split: TrancheSplit
): ComputedTranches {
  if (split.token + split.agreement + split.registration !== 100) {
    throw new Error('Tranche split percentages must sum to 100');
  }
  
  if (rateBps < 0 || rateBps > 10000) {
    throw new Error('rateBps must be between 0 and 10000');
  }

  // totalCommission = consideration * (bps / 10000)
  const totalCommission = (considerationPaise * BigInt(rateBps)) / 10000n;

  // Compute individual tranches.
  // The final tranche ('registration') absorbs any rounding remainder to ensure exact sum.
  const tokenAmt = (totalCommission * BigInt(split.token)) / 100n;
  const agreementAmt = (totalCommission * BigInt(split.agreement)) / 100n;
  const registrationAmt = totalCommission - tokenAmt - agreementAmt;

  return {
    token: tokenAmt,
    agreement: agreementAmt,
    registration: registrationAmt
  };
}
