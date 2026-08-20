// apps/monolith/src/app/(experience)/@modal/default.tsx
//
// MASTER_SPEC §7 — the overlay's closed state.
//
// Next renders this in the @modal slot whenever the current URL does not match
// an intercepted route. Returning null is what makes "closed" the default:
// without this file the slot would render nothing on soft navigation but 404 on
// a hard refresh, which is one of the least obvious failure modes in the App
// Router.
export default function ModalDefault() {
  return null;
}
