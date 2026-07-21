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
