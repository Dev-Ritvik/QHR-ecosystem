/**
 * Formats a bigint paise amount into a human-readable Indian currency string.
 * - < ₹1 Lakh: ₹X,XXX
 * - >= ₹1 Lakh and < ₹1 Crore: ₹X.XX L
 * - >= ₹1 Crore: ₹X.XX Cr
 */
export function formatPaise(paiseAmt: bigint): string {
  const isNegative = paiseAmt < 0n;
  const absPaise = isNegative ? -paiseAmt : paiseAmt;
  const rupees = Number(absPaise) / 100;

  let formatted = '';

  if (rupees >= 10000000) {
    // Crore representation (1 Cr = 10,000,000 rupees)
    const cr = rupees / 10000000;
    formatted = `${cr % 1 === 0 ? cr : Number(cr.toFixed(2))} Cr`;
  } else if (rupees >= 100000) {
    // Lakh representation (1 L = 100,000 rupees)
    const l = rupees / 100000;
    formatted = `${l % 1 === 0 ? l : Number(l.toFixed(2))} L`;
  } else {
    // Standard Indian formatting for everything under 1 Lakh
    formatted = new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
    }).format(rupees);
  }

  return `${isNegative ? '-' : ''}₹${formatted}`;
}
