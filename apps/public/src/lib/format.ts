export function formatPaiseToLakhCrore(paise: bigint | number | null | undefined): string {
  if (paise == null) return '';
  const rupees = Number(paise) / 100;
  
  if (rupees >= 10000000) {
    return `₹${(rupees / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
  }
  if (rupees >= 100000) {
    return `₹${(rupees / 100000).toFixed(2).replace(/\.00$/, '')} L`;
  }
  
  return `₹${rupees.toLocaleString('en-IN')}`;
}

export function formatAreaSqFt(sqFt: number | null | undefined): string {
  if (sqFt == null) return '';
  return `${sqFt.toLocaleString('en-IN', { maximumFractionDigits: 0 })} sq ft`;
}

export function formatAreaSqYd(sqYd: number | null | undefined): string {
  if (sqYd == null) return '';
  return `${sqYd.toLocaleString('en-IN', { maximumFractionDigits: 0 })} sq yd`;
}
