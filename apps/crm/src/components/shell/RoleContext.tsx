"use client";

import { createContext, useContext, ReactNode } from "react";

type RoleContextType = {
  userId: string;
  role: "owner" | "agent";
  name: string;
};

const RoleContext = createContext<RoleContextType | null>(null);

/**
 * Provides the authenticated user's session role context downwards.
 * Ensures the presentation layer can structurally adjust per-role without fetching.
 */
export function RoleProvider({ children, value }: { children: ReactNode; value: RoleContextType }) {
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
