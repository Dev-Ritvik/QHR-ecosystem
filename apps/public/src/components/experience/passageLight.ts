// apps/public/src/components/experience/passageLight.ts
//
// The exposure the door passage asks of the print (doorway.ts): the iris that
// opens as the eye adjusts to the hall, and closes as the camera backs out
// into the night. Written by the journey driver every frame (WorldCanvas,
// paintDoorway), read by FilmGrade — its own module so the grade does not
// import the director. 1 at rest.

//
// AND THE GRADE (the continuous passage, doorway.ts 'through'): how far the
// exterior's print has gone to the hall's, 0..1, as the camera closes on the
// open door. By the time the sets change behind the opening the print is the
// room's own, so the frame before and the frame after are one picture. 0 at
// rest.

export const passageLight = { exposure: 1, grade: 0 };
