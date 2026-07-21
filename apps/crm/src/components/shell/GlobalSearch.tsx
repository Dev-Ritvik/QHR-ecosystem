'use client';

import { useState, useEffect, useTransition } from 'react';
import { searchGlobal } from '@/server/actions/search';
import Link from 'next/link';

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<{ leads: any[], units: any[], projects: any[] }>({ leads: [], units: [], projects: [] });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (query.length >= 2) {
      startTransition(async () => {
        const res = await searchGlobal(query);
        if (res.ok) setResults(res.data);
      });
    } else {
      setResults({ leads: [], units: [], projects: [] });
    }
  }, [query]);

  // Floating trigger button so it integrates smoothly regardless of shell styling
  const Trigger = (
    <div className="relative z-40">
      <button 
        onClick={() => setIsOpen(true)} 
        className="flex items-center text-sm text-muted-foreground bg-background border px-3 py-1.5 rounded-full shadow-sm hover:bg-accent transition-colors"
      >
        <span>Search CRM...</span>
        <kbd className="ml-3 bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono font-medium">⌘K</kbd>
      </button>
    </div>
  );

  if (!isOpen) return Trigger;

  return (
    <>
      {Trigger}
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-24 p-4">
        <div className="w-full max-w-2xl bg-background rounded-xl shadow-2xl border overflow-hidden flex flex-col">
          <div className="p-4 border-b flex items-center bg-card">
            <svg className="w-5 h-5 text-muted-foreground mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              autoFocus
              className="w-full bg-transparent outline-none text-lg placeholder:text-muted-foreground"
              placeholder="Search leads by name/phone, units by plot/survey, or projects..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button onClick={() => setIsOpen(false)} className="text-xs text-muted-foreground ml-2 border px-1.5 py-0.5 rounded hover:bg-accent">
              ESC
            </button>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto p-2 bg-muted/30">
            {query.length < 2 && (
              <div className="p-8 text-center text-sm text-muted-foreground">Type at least 2 characters to search...</div>
            )}
            {isPending && query.length >= 2 && (
              <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Searching...</div>
            )}
            
            {!isPending && query.length >= 2 && (
              <div className="space-y-4 p-2">
                {results.projects.length > 0 && (
                  <div>
                    <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Projects</h3>
                    <div className="space-y-1">
                      {results.projects.map(p => (
                        <Link key={p.id} href={`/projects/${p.id}`} onClick={() => setIsOpen(false)} className="block px-3 py-2.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                          <div className="font-medium text-sm">{p.name}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {results.leads.length > 0 && (
                  <div>
                    <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Leads</h3>
                    <div className="space-y-1">
                      {results.leads.map(l => (
                        <Link key={l.id} href={`/leads/${l.id}`} onClick={() => setIsOpen(false)} className="block px-3 py-2.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                          <div className="font-medium text-sm">{l.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{l.phone} • Stage: <span className="capitalize">{l.stage}</span></div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {results.units.length > 0 && (
                  <div>
                    <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Units</h3>
                    <div className="space-y-1">
                      {results.units.map(u => (
                        <Link key={u.id} href={`/projects/${u.projectId}/units/${u.id}`} onClick={() => setIsOpen(false)} className="block px-3 py-2.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                          <div className="font-medium text-sm">Unit {u.unitNumber}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{u.projectName}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {results.projects.length === 0 && results.leads.length === 0 && results.units.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">No results found for "{query}".</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
