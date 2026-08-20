// apps/monolith/src/app/(experience)/@modal/layout.tsx
//
// The HUD shell — MASTER_SPEC §7.
//
// Wraps every intercepted utility page. Because this layout belongs to the SLOT
// and not to the pages, navigating Careers -> Contact re-renders only the page
// inside it: the rail keeps its scroll position, the canvas beneath is never
// touched, and no state has to be threaded anywhere.
//
// NOTE for the standalone variants (§4.2 "direct-hit parity"): a hard load of
// /careers does NOT pass through this layout — it renders the page in the main
// children slot instead. Those pages therefore render the same chrome
// explicitly. If that ever drifts, a shared link produces an unstyled page.
import { CommandOverlay } from '@/components/command/CommandOverlay';
import { ModalOpener } from '@/components/command/ModalOpener';

export default function ModalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Zero-output client bridge. Tells the store the overlay is open, which
          starts the freeze sequence. Kept separate from CommandOverlay so the
          overlay itself stays a pure renderer. */}
      <ModalOpener />
      <CommandOverlay>{children}</CommandOverlay>
    </>
  );
}
