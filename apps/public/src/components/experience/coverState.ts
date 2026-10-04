// apps/public/src/components/experience/coverState.ts
//
// Whether the scene has been built in THIS document — shared by the canvas
// host, which draws the loading cover into the server-rendered page, and the
// Preloader, which takes it over once its chunk arrives. A module variable on
// purpose: a client-side return to the film keeps it (nothing to cover), a
// reload starts a new module and clears it (everything to cover). See the note
// at the top of Preloader.tsx.
export const coverState = { sceneInMemory: false };
