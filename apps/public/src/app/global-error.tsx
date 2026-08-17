'use client';

// apps/public/src/app/global-error.tsx
//
// Last resort. A segment error.tsx renders INSIDE its layout, so it cannot
// catch a throw in the root layout itself — that is what this is for, and it
// has to supply its own <html> and <body> because the failing layout never
// produced them.
//
// Inlined styles, no Tailwind classes and no imported components: if the root
// layout threw, the safest assumption is that nothing above this is reliable,
// including whatever would have loaded the stylesheet.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#0A1120',
          color: '#F2EDE4',
          fontFamily: 'Georgia, "Times New Roman", serif',
          padding: '0 clamp(1.5rem, 6vw, 6rem)',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.75rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#E8B98A',
          }}
        >
          Quality Homes Reality
        </p>
        <h1
          style={{
            margin: '1.5rem 0 0',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 400,
            lineHeight: 1.1,
          }}
        >
          The site didn&rsquo;t load
        </h1>
        <p
          style={{
            margin: '1.5rem 0 0',
            maxWidth: '34rem',
            fontSize: '1.05rem',
            lineHeight: 1.6,
            color: 'rgba(242,237,228,0.65)',
          }}
        >
          Please try again in a moment. If it keeps happening, call the head
          office on +91 95535 13366 and we will help you directly.
        </p>
        <div style={{ marginTop: '3rem' }}>
          <button
            type="button"
            onClick={reset}
            style={{
              background: 'none',
              border: '1px solid rgba(232,185,138,0.5)',
              color: '#E8B98A',
              padding: '0.85rem 1.75rem',
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Try again
          </button>
        </div>
        {error.digest ? (
          <p
            style={{
              marginTop: '4rem',
              fontSize: '0.75rem',
              color: 'rgba(242,237,228,0.25)',
            }}
          >
            Reference {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  );
}
