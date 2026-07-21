// packages/domain/src/permissions/matrix.test.ts

import { describe, it, expect } from 'vitest';
import { can, Actor, Resource } from './matrix';

describe('Permission Matrix', () => {
  const ownerActor: Actor = { id: 'owner-1', role: 'owner' };
  const agentActor: Actor = { id: 'agent-1', role: 'agent' };
  const otherAgentActor: Actor = { id: 'agent-2', role: 'agent' };

  describe('Owner Role', () => {
    it('allows global access to all actions', () => {
      expect(can(ownerActor, 'read:lead')).toBe(true);
      expect(can(ownerActor, 'read:floor_price')).toBe(true);
      expect(can(ownerActor, 'read:commission')).toBe(true);
      expect(can(ownerActor, 'read:audit_log')).toBe(true);
      expect(can(ownerActor, 'export:data')).toBe(true);
      expect(can(ownerActor, 'manage:settings')).toBe(true);
    });

    it('allows reading leads regardless of the resource owner', () => {
      const resourceAssignedToAgent: Resource = { ownerId: 'agent-1' };
      expect(can(ownerActor, 'read:lead', resourceAssignedToAgent)).toBe(true);
    });
  });

  describe('Agent Role (Asserting NFR-S3 Denials)', () => {
    it('denies reading floor prices (NFR-S3)', () => {
      expect(can(agentActor, 'read:floor_price')).toBe(false);
    });

    it('denies reading commissions (NFR-S3)', () => {
      expect(can(agentActor, 'read:commission')).toBe(false);
    });

    it('denies reading the audit log (NFR-S3)', () => {
      expect(can(agentActor, 'read:audit_log')).toBe(false);
    });

    it('denies exporting data (NFR-S3)', () => {
      expect(can(agentActor, 'export:data')).toBe(false);
    });

    it('denies managing settings (NFR-S3)', () => {
      expect(can(agentActor, 'manage:settings')).toBe(false);
    });

    describe('Lead Visibility Scoping (FR-C5, NFR-S3)', () => {
      it('allows an agent to read a lead assigned to them', () => {
        const myResource: Resource = { ownerId: 'agent-1' };
        expect(can(agentActor, 'read:lead', myResource)).toBe(true);
      });

      it('denies an agent reading a lead assigned to another agent', () => {
        const otherResource: Resource = { ownerId: 'agent-2' };
        expect(can(agentActor, 'read:lead', otherResource)).toBe(false);
      });

      it('denies an agent reading leads globally (no resource context provided)', () => {
        expect(can(agentActor, 'read:lead')).toBe(false);
      });

      it('denies an agent reading leads lacking an ownerId', () => {
        const unassignedResource: Resource = { ownerId: null };
        expect(can(agentActor, 'read:lead', unassignedResource)).toBe(false);
      });
    });
  });
});
