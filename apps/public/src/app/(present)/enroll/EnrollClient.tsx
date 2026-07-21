'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function EnrollClient() {
  const [shortCode, setShortCode] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Generate a clean 6-character short code (excluding lookalike letters like I/O/1/0)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 6 })
      .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
      .join('');
    setShortCode(code);

    if (!supabaseUrl || !supabaseAnonKey) return;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Listen to the bespoke channel mapped to our shortcode (ADR-004)
    const channel = supabase.channel(`device-enrollment-${code}`);
    channel.on('broadcast', { event: 'enrollment_success' }, (payload) => {
      if (payload.payload?.token) {
        // Mint received. Drop it into an unguessable strict-path cookie, 1-year max-age.
        document.cookie = `device_token=${payload.payload.token}; path=/; max-age=31536000; samesite=lax`;
        router.push('/');
      }
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-50 font-sans p-8 select-none">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl p-10 text-center border border-slate-700">
        <h1 className="text-2xl font-bold mb-2">Connect Office Display</h1>
        <p className="text-slate-400 mb-8">
          Enter this short code in the CRM Settings to authorize this screen for live pricing presentation.
        </p>
        
        <div className="bg-slate-900 rounded-xl p-8 mb-8 border border-slate-700/50 shadow-inner">
          <div className="text-5xl font-mono font-bold tracking-[0.25em] text-indigo-400">
            {shortCode || '------'}
          </div>
        </div>

        <div className="flex items-center justify-center space-x-3 text-sm text-slate-500 animate-pulse">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Waiting for owner approval...</span>
        </div>
      </div>
    </div>
  );
}
