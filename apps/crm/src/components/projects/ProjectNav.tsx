// apps/crm/src/components/projects/ProjectNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ProjectNavProps {
  projectId: string;
}

export function ProjectNav({ projectId }: ProjectNavProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const links = [
    { href: base, label: 'Details' },
    { href: `${base}/units`, label: 'Units' },
    { href: `${base}/pricing`, label: 'Pricing' },
    { href: `${base}/pois`, label: 'POIs' },
    { href: `${base}/commissions`, label: 'Commissions' },
  ];

  return (
    <nav className="flex space-x-6 border-b mb-8 overflow-x-auto">
      {links.map(l => (
        <Link
          key={l.href}
          href={l.href}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            pathname === l.href
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
