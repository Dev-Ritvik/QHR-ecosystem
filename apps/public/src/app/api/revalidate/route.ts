// apps/public/src/app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    if (body.tag) {
      revalidateTag(body.tag);
      
      // Always bust the top-level index routing cache so the catalog syncs immediately
      revalidatePath('/', 'page');

      // AND EVERYTHING ELSE THAT PRINTS THE REGISTER. '/' is not the film's
      // route — the film is /site-home behind a rewrite — so the line above
      // refreshed nothing a visitor sees, and after a publish the film's
      // count of open plots, the tables in the hall on every page, the
      // layouts' index, the sizes page and the two forms' lists of layouts
      // all waited out their hour. The whole site hangs from one layout:
      // this marks every page under it, and each is rebuilt on its next
      // visit.
      revalidatePath('/', 'layout');
      
      // Target specific project paths if the tag format matches
      if (typeof body.tag === 'string' && body.tag.startsWith('project-')) {
         const slug = body.tag.replace('project-', '');
         revalidatePath(`/projects/${slug}`);
      }
      
      return NextResponse.json({ revalidated: true, now: Date.now(), tag: body.tag });
    }
    
    return NextResponse.json({ message: 'Missing tag in payload' }, { status: 400 });
  } catch (err) {
    console.error('Revalidation error:', err);
    return NextResponse.json({ message: 'Error processing request' }, { status: 500 });
  }
}
