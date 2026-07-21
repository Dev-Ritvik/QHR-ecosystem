// packages/domain/src/permissions/matrix.ts

export type Role = 'owner' | 'agent';

export type Action =
  | 'read:lead'
  | 'read:floor_price'
  | 'read:commission'
  | 'read:audit_log'
  | 'export:data'
  | 'manage:settings';

export interface Actor {
  id: string;
  role: Role;
}

export interface Resource {
  /**
   * The ID of the user who owns or is assigned to the resource.
   * For leads, this is the assignedAgentId.
   */
  ownerId?: string | null;
}

type PermissionCheck = boolean | ((actor: Actor, resource?: Resource) => boolean);

/**
 * Capability matrix as data. 
 * Enforces NFR-S3 and FR-C5/FR-C6 access boundaries at the domain level.
 */
export const PERMISSION_MATRIX: Record<Role, Record<Action, PermissionCheck>> = {
  owner: {
    'read:lead': true,
    'read:floor_price': true,
    'read:commission': true,
    'read:audit_log': true,
    'export:data': true,
    'manage:settings': true,
  },
  agent: {
    'read:lead': (actor, resource) => {
      // Agent lead scoping (FR-C5, NFR-S3): agents see own leads only.
      // If there is no resource context, or the ownerId is missing, deny.
      if (!resource || !resource.ownerId) {
        return false;
      }
      return actor.id === resource.ownerId;
    },
    'read:floor_price': false,
    'read:commission': false,
    'read:audit_log': false,
    'export:data': false,
    'manage:settings': false,
  },
};

/**
 * Evaluates whether an actor can perform a specific action on an optional resource.
 */
export function can(actor: Actor, action: Action, resource?: Resource): boolean {
  const roleMatrix = PERMISSION_MATRIX[actor.role];
  if (!roleMatrix) {
    return false;
  }

  const check = roleMatrix[action];
  
  if (typeof check === 'boolean') {
    return check;
  }
  
  if (typeof check === 'function') {
    return check(actor, resource);
  }
  
  return false;
}
