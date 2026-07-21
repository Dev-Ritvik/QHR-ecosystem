// packages/domain/src/documents/templates.ts

export type AssetClass = 'land' | 'commercial' | 'luxury_residential';

export type DocumentTemplate = {
  key: string;
  title: string;
  hasValidityDates: boolean; // True for documents like ECs that have date ranges
};

export const LAND_CHECKLIST: DocumentTemplate[] = [
  { key: 'mother_deed', title: 'Mother Deed', hasValidityDates: false },
  { key: 'ec', title: 'Encumbrance Certificate (EC)', hasValidityDates: true },
  { key: 'mutation_khata', title: 'Mutation / Khata', hasValidityDates: false },
  { key: 'conversion_order', title: 'Conversion Order', hasValidityDates: false },
  { key: 'layout_approval', title: 'Layout Approval', hasValidityDates: false },
  { key: 'sale_deed_chain', title: 'Sale Deed Chain', hasValidityDates: false },
];

export const COMMERCIAL_CHECKLIST: DocumentTemplate[] = [
  { key: 'sale_deed_chain', title: 'Sale Deed Chain', hasValidityDates: false },
  { key: 'oc', title: 'Occupancy Certificate (OC)', hasValidityDates: false },
  { key: 'lease_deed', title: 'Lease Deed', hasValidityDates: true },
];

export const LUXURY_CHECKLIST: DocumentTemplate[] = [
  { key: 'agreement_of_sale', title: 'Agreement of Sale', hasValidityDates: false },
  { key: 'allotment_letter', title: 'Allotment Letter', hasValidityDates: false },
  { key: 'oc', title: 'Occupancy Certificate (OC)', hasValidityDates: false },
  { key: 'cc', title: 'Completion Certificate (CC)', hasValidityDates: false },
];

export function getUnitChecklistTemplate(assetClass: AssetClass): DocumentTemplate[] {
  switch (assetClass) {
    case 'land':
      return LAND_CHECKLIST;
    case 'commercial':
      return COMMERCIAL_CHECKLIST;
    case 'luxury_residential':
      return LUXURY_CHECKLIST;
    default:
      return [];
  }
}
