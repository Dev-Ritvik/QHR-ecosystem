import { ProjectForm } from "@/components/projects/ProjectForm";
import Link from "next/link";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/projects" className="text-sm font-medium text-gray-500 hover:text-gray-900">
          &larr; Back to Projects
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">New Project</h1>
        <p className="mt-1 text-sm text-gray-500">Create a new real estate project.</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <ProjectForm />
      </div>
    </div>
  );
}
