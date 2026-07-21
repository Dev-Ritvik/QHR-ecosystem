'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * FR-PM13: Configurable idle timeout triggers an ambient attract state.
 * Any user input instantly dismisses the overlay and routes back to the main grid.
 */
export function IdleAttract() {
  const [isIdle, setIsIdle] = useState(false);
  const isIdleRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const router = useRouter();
  const pathname = usePathname();

  // Keep a mutable ref of the state so the event listener always sees the latest 
  // value without needing to re-bind constantly, preventing listener churn.
  useEffect(() => {
    isIdleRef.current = isIdle;
  }, [isIdle]);

  // Default to 3 minutes (180,000 ms) if not configured
  const idleTime = parseInt(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS || '180000', 10);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsIdle(true), idleTime);
  }, [idleTime]);

  useEffect(() => {
    const handleActivity = () => {
      if (isIdleRef.current) {
        setIsIdle(false);
        // Any interaction returns the user to the grid
        if (pathname !== '/') {
          router.push('/');
        }
      }
      resetTimer();
    };

    // Capture phase listeners ensure we intercept interaction immediately, 
    // even if deeply nested components stop propagation.
    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, handleActivity, { capture: true, passive: true }));

    resetTimer();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(e => window.removeEventListener(e, handleActivity, { capture: true }));
    };
  }, [pathname, router, resetTimer]);

  if (!isIdle) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden cursor-pointer"
      // The div catches any errant clicks while active, acting as an interaction shield
      onClick={() => setIsIdle(false)}
    >
      {/* Ambient hero rotation: A slow, continuous spin on the scaled fallback image */}
      <img 
        src="/fallbacks/map-placeholder.jpg" 
        alt="" 
        className="absolute inset-0 w-full h-full object-cover opacity-40 animate-[spin_240s_linear_infinite] scale-[1.5]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-transparent to-slate-900/80" />
      
      <div className="relative z-10 text-center flex flex-col items-center gap-8 animate-pulse">
         <div className="w-24 h-1 bg-indigo-500 rounded-full" />
         <h1 className="text-4xl md:text-6xl font-light text-slate-50 tracking-[0.2em] uppercase">
           Touch to explore
         </h1>
         <div className="w-24 h-1 bg-indigo-500 rounded-full" />
      </div>
    </div>
  );
}
