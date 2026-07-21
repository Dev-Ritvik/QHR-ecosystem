/**
 * FR-C16: Booking-scoped document templates and TDS rules.
 */

export const DEAL_DOCUMENT_TITLES: Record<string, string> = {
  agreement_of_sale: 'Agreement of Sale',
  allotment_letter: 'Allotment Letter',
  form_26qb: 'Form 26QB (1% TDS)',
  kyc_pan: 'PAN Card',
  kyc_aadhaar: 'Aadhaar Card',
};

export function getBookingChecklist(tdsApplicable: boolean): string[] {
  const docs = ['agreement_of_sale', 'allotment_letter'];
  
  if (tdsApplicable) {
    docs.push('form_26qb');
  }
  
  return docs;
}

export function getClientChecklist(): string[] {
  return ['kyc_pan', 'kyc_aadhaar'];
}
