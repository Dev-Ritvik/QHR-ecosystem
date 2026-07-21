// apps/public/src/components/site/ProjectCard.tsx
import Link from 'next/link';
import { InferSelectModel } from 'drizzle-orm';
import { projectsPub } from '@estate/db/src/schema/projection';

type Project = InferSelectModel<typeof projectsPub>;

const assetClassMap: Record<Project['assetClass'], string> = {
  land: 'Plotted Development',
  commercial: 'Commercial',
  luxury_residential: 'Luxury Residential',
};

export function ProjectCard({ project }: { project: Project }) {
  const isSoldOut = project.isSoldOut;

  return (
    <Link href={`/projects/${project.slug}`} className="group flex flex-col block overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4 rounded-sm">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 rounded-sm">
        <img 
          src={project.heroUrl} 
          alt={project.name}
          className={`object-cover w-full h-full transition-transform duration-700 ease-out group-hover:scale-105 ${isSoldOut ? 'grayscale opacity-90' : ''}`}
        />
        
        {isSoldOut ? (
          <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm text-white px-3 py-1.5 text-[10px] tracking-widest uppercase font-medium rounded-sm">
            Fully Sold
          </div>
        ) : (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm text-gray-900 px-3 py-1.5 text-[10px] tracking-widest uppercase font-semibold rounded-sm shadow-sm">
            {project.availableUnits} Available
          </div>
        )}
        
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white px-2.5 py-1 text-[11px] uppercase tracking-wider font-medium rounded-sm">
          {assetClassMap[project.assetClass]}
        </div>
      </div>
      
      <div className="mt-5 flex flex-col space-y-1.5 px-1">
        <h3 className="text-xl font-serif text-gray-900 group-hover:text-gray-600 transition-colors">
          {project.name}
        </h3>
        <p className="text-sm text-gray-500 font-sans tracking-wide">
          {[project.locality, project.city].filter(Boolean).join(', ')}
        </p>
      </div>
    </Link>
  );
}
