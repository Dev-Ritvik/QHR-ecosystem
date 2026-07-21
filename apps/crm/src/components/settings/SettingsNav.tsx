// apps/crm/src/components/settings/SettingsNav.tsx
// COMPLETE-FILE REPLACEMENT
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SettingsNav() {
  const pathname = usePathname();
  
  const links = [
    { href: '/settings', label: 'Office Configuration' },
    { href: '/settings/users', label: 'User Management' },
    { href: '/settings/devices', label: 'Presentation Devices' },
    { href: '/settings/commissions', label: 'Commissions' },
    { href: '/settings/export', label: 'Data Export' }
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
