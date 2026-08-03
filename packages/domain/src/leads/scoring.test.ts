import { describe, it, expect } from 'vitest';
import {
  scoreLead,
  CAP_WITHOUT_ANALYTICS,
  OUTBOUND_THRESHOLD,
  NURTURE_THRESHOLD,
} from './scoring';
import { routeLead } from './routing';
import { branchForPlace, projectByStation, PROJECTS } from './branches';

describe('lead scoring', () => {
  it('scores a deeply engaged consented visitor into the outbound band', () => {
    const r = scoreLead({
      analyticsConsent: true,
      hologramDwellMs: { S1: 90_000, S2: 20_000 },
      parcelsFocused: 8,
      parcelsSelected: 2,
      placesVisited: 5,
      medianPlaceDwellMs: 45_000,
      consideredRouteDwellMs: 120_000,
      floorPlanOpens: 2,
      pricingViews: 1,
      siteVisitInterest: true,
      returnSessions: 3,
    });
    expect(r.score).toBeGreaterThanOrEqual(OUTBOUND_THRESHOLD);
    expect(r.band).toBe('outbound');
    expect(r.breakdown.cappedForNoConsent).toBe(false);
  });

  it('never lets an analytics refusal exceed the cap', () => {
    // Same visitor, same actions, consent refused. Everything telemetry-derived
    // is unavailable; the explicit actions still count.
    const r = scoreLead({
      analyticsConsent: false,
      hologramDwellMs: { S1: 90_000 },
      parcelsFocused: 8,
      parcelsSelected: 5,
      placesVisited: 5,
      medianPlaceDwellMs: 45_000,
      consideredRouteDwellMs: 120_000,
      floorPlanOpens: 3,
      pricingViews: 3,
      siteVisitInterest: true,
      returnSessions: 4,
    });
    expect(r.score).toBeLessThanOrEqual(CAP_WITHOUT_ANALYTICS);
    expect(r.breakdown.cappedForNoConsent).toBe(true);
  });

  it('ignores telemetry-derived components entirely without consent', () => {
    const r = scoreLead({
      analyticsConsent: false,
      hologramDwellMs: { S1: 300_000 },
      placesVisited: 9,
      medianPlaceDwellMs: 90_000,
      consideredRouteDwellMs: 300_000,
      returnSessions: 9,
    });
    expect(r.breakdown.hologramEngagement).toBe(0);
    expect(r.breakdown.explorationDepth).toBe(0);
    expect(r.breakdown.contentConsideration).toBe(0);
    expect(r.breakdown.returnBehaviour).toBe(0);
  });

  it('still scores a refusing visitor above zero on explicit intent alone', () => {
    // The point of the cap is to limit, not to erase. Someone who asked for a
    // site visit is a real lead whether or not we may profile them.
    const r = scoreLead({
      analyticsConsent: false,
      parcelsSelected: 1,
      siteVisitInterest: true,
    });
    expect(r.score).toBeGreaterThan(0);
    expect(r.breakdown.explicitIntent).toBeGreaterThan(0);
  });

  it('places a passive visitor in the cold band', () => {
    const r = scoreLead({ analyticsConsent: true, placesVisited: 1 });
    expect(r.score).toBeLessThan(NURTURE_THRESHOLD);
    expect(r.band).toBe('cold');
  });

  it('keeps every component within its ceiling and the total within 100', () => {
    const r = scoreLead({
      analyticsConsent: true,
      hologramDwellMs: { S1: 9_000_000, S2: 9_000_000, S3: 9_000_000 },
      parcelsFocused: 9999,
      parcelsSelected: 9999,
      placesVisited: 9999,
      medianPlaceDwellMs: 9_000_000,
      consideredRouteDwellMs: 9_000_000,
      floorPlanOpens: 9999,
      pricingViews: 9999,
      siteVisitInterest: true,
      returnSessions: 9999,
    });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.breakdown.hologramEngagement).toBeLessThanOrEqual(30);
    expect(r.breakdown.explorationDepth).toBeLessThanOrEqual(20);
    expect(r.breakdown.contentConsideration).toBeLessThanOrEqual(15);
    expect(r.breakdown.explicitIntent).toBeLessThanOrEqual(20);
    expect(r.breakdown.returnBehaviour).toBeLessThanOrEqual(15);
  });
});

describe('branch routing', () => {
  it('lets a stated preference beat both interest and geography', () => {
    const r = routeLead({
      statedPreference: 'srikakulam',
      hologramDwellMs: { S1: 200_000 },
      geoPlace: 'Visakhapatnam',
    });
    expect(r.branch).toBe('srikakulam');
    expect(r.reason).toContain('stated_preference');
  });

  it('routes on interest over geography', () => {
    // Browsing from Vizag, but four minutes on the Srikakulam township.
    const r = routeLead({
      hologramDwellMs: { S3: 240_000, S1: 3_000 },
      geoPlace: 'Visakhapatnam',
    });
    expect(r.branch).toBe('srikakulam');
    expect(r.reason).toContain('vsr-gayatri-township');
  });

  it('does not let a glance at a table override geography', () => {
    const r = routeLead({
      hologramDwellMs: { S3: 1_200 },
      geoPlace: 'Vizianagaram',
    });
    expect(r.branch).toBe('vizianagaram');
    expect(r.reason).toContain('geo');
  });

  it('falls back to head office rather than leaving a lead unrouted', () => {
    const r = routeLead({ geoPlace: 'Hyderabad' });
    expect(r.branch).toBe('visakhapatnam');
    expect(r.reason).toContain('fallback');
  });

  it('resolves each project to the office that owns its district', () => {
    expect(projectByStation('S1')?.branch).toBe('vizianagaram');
    expect(projectByStation('S2')?.branch).toBe('vizianagaram');
    expect(projectByStation('S3')?.branch).toBe('srikakulam');
  });

  it('refuses to guess an unknown place', () => {
    expect(branchForPlace('Chennai')).toBeNull();
    expect(branchForPlace('')).toBeNull();
    expect(branchForPlace(null)).toBeNull();
    expect(branchForPlace('Garividi')).toBe('vizianagaram');
  });

  it('gives every project a branch', () => {
    for (const p of PROJECTS) {
      expect(p.branch).toBeTruthy();
    }
  });
});
