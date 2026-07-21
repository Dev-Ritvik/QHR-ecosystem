"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "./RoleContext";
import { authClient } from "@/lib/auth-client";

/**
 * Mobile-first responsive app shell matching NFR-A4 constraints.
 * Implements off-canvas sidebar on mobile and fixed sidebar on desktop.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { role, name } = useRole();
  const router = useRouter();

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/projects", label: "Projects" },
    { href: "/leads", label: "Leads" },
    { href: "/visits", label: "Site Visits" },
    ...(role === "owner"
      ? [
          { href: "/audit", label: "Audit Log" },
          { href: "/settings", label: "Settings" },
        ]
      : []),
  ];

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50 md:flex-row">
      {/* Mobile Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-4 md:hidden">
        <span className="text-lg font-bold tracking-tight text-gray-900">CRM Engine</span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-gray-600 focus:outline-none"
          aria-label="Toggle navigation"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
            />
          </svg>
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-white transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="hidden h-14 shrink-0 items-center border-b px-6 md:flex">
            <span className="text-lg font-bold tracking-tight text-gray-900">CRM Engine</span>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {links.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 border-t p-4">
            <div className="mb-4 truncate px-3 text-sm text-gray-500">
              Logged in as <br />
              <span className="font-medium text-gray-900">{name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
