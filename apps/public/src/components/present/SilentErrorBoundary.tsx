'use client';

import React, { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * FR-PM11: Catches React-level crashes on the presentation surface.
 * Reports silently to Sentry and renders a designed static fallback 
 * instead of breaking the UI or showing red error text to a client.
 */
export class SilentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Silent reporting
    Sentry.captureException(error, { extra: { errorInfo } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full bg-slate-900 absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Designed fallback for total crash: branded dim ambient visual, no text */}
          <img 
            src="/fallbacks/map-placeholder.jpg" 
            alt="" 
            className="w-full h-full object-cover opacity-10 grayscale"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
