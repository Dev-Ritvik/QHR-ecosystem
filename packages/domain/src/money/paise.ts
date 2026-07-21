/**
 * Converts a human-entered rupee amount (number or string, at most 2 decimal
 * places) into integer paise. Parses the decimal text instead of multiplying
 * floats, so amounts like 4500000.5 can never round to the wrong paise.
 */
export function rupeesToPaise(rupees: string | number): bigint {
  const s = String(rupees).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new Error(`Invalid rupee amount: "${rupees}" (expected a non-negative number with at most 2 decimals)`);
  }
  const [intPart, fracPart = ''] = s.split('.');
  return BigInt(intPart) * 100n + BigInt(fracPart.padEnd(2, '0') || '0');
}

/**
 * Adds multiple bigint paise amounts securely.
 */
export function add(...amounts: bigint[]): bigint {
  return amounts.reduce((sum, a) => sum + a, 0n);
}

/**
 * Subtracts b from a.
 */
export function subtract(a: bigint, b: bigint): bigint {
  return a - b;
}

/**
 * Multiplies an amount by basis points (100 bps = 1%).
 * 10,000 bps = 100%. Truncates fractional paise.
 */
export function multiplyByBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps)) / 10000n;
}

/**
 * Allocates a given amount across an array of proportional ratios.
 * Guarantees that the sum of the returned allocations exactly matches the input amount,
 * distributing the remainder sequentially from the first array item.
 */
export function allocate(amount: bigint, ratios: number[]): bigint[] {
  const totalRatio = ratios.reduce((sum, r) => sum + r, 0);
  if (totalRatio === 0) return ratios.map(() => 0n);

  let remainder = amount;
  const shares = ratios.map((r) => {
    const share = (amount * BigInt(r)) / BigInt(totalRatio);
    remainder -= share;
    return share;
  });

  const step = remainder > 0n ? 1n : -1n;
  const absRemainder = remainder > 0n ? remainder : -remainder;

  // Distribute the penny remainder safely
  for (let i = 0; i < Number(absRemainder); i++) {
    shares[i] += step;
  }

  return shares;
}
