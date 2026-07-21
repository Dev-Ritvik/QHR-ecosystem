import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";
import type { AppSession } from "@estate/db";

/**
 * Standard Better Auth session fetcher using the request headers.
 * `server-only` guarantees a loud build error if this module is ever pulled
 * into a client-component bundle (next/headers is server-context only).
 */
export async function getSession() {
  return auth.api.getSession({ headers: headers() });
}

/**
 * Utility to verify owner access inside server actions or route handlers.
 * Returns a discriminated result per Coding_conventions.md.
 */
export async function requireOwner() {
  const session = await getSession();
  
  if (!session) {
    return { ok: false as const, code: "UNAUTHENTICATED", message: "Not signed in" };
  }
  
  if ((session.user as any).role !== "owner") {
    return { ok: false as const, code: "FORBIDDEN", message: "Owner access required" };
  }
  
  return { ok: true as const, session };
}

/**
 * Returns the contextual shape expected by packages/db (withCoreContext)
 * to enforce Data Access Layer isolation and RLS backstops (NFR-S3).
 */
export async function getRoleContext(): Promise<AppSession | null> {
  const session = await getSession();
  
  if (!session) {
    return null;
  }
  
  return {
    userId: session.user.id,
    role: (session.user as any).role as "owner" | "agent",
  };
}
