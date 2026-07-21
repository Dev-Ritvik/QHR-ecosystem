// packages/ui/src/status-colors.ts

// Presentation status labels (FR-PM4) mapped to dual-channel indicators (NFR-A3)
export type PresentationStatus = 
  | 'available' 
  | 'selling_fast' 
  | 'on_hold' 
  | 'booked' 
  | 'sold' 
  | 'not_for_sale';

export interface StatusStyle {
  backgroundColor: string;
  foregroundColor: string; // NFR-A1 WCAG contrast compliance
  pattern: 'solid' | 'dots' | 'dashed' | 'stripes' | 'crosshatch' | 'checkerboard';
}

export const statusStyles: Record<PresentationStatus, StatusStyle> = {
  available: {
    backgroundColor: '#dcfce7', // Green 100
    foregroundColor: '#14532d', // Green 900
    pattern: 'solid',
  },
  selling_fast: {
    backgroundColor: '#ffedd5', // Orange 100
    foregroundColor: '#7c2d12', // Orange 900
    pattern: 'dots',
  },
  on_hold: {
    backgroundColor: '#fef08a', // Yellow 300
    foregroundColor: '#713f12', // Yellow 900
    pattern: 'dashed',
  },
  booked: {
    backgroundColor: '#dbeafe', // Blue 100
    foregroundColor: '#1e3a8a', // Blue 900
    pattern: 'stripes',
  },
  sold: {
    backgroundColor: '#e5e7eb', // Gray 200
    foregroundColor: '#1f2937', // Gray 800
    pattern: 'crosshatch',
  },
  not_for_sale: {
    backgroundColor: '#f3f4f6', // Gray 100
    foregroundColor: '#9ca3af', // Gray 400
    pattern: 'checkerboard',
  },
};
