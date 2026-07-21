"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject, updateProject, archiveProject } from "@/server/actions/projects";
import { z } from "zod";
import { ProjectSchema, type ProjectFormData } from "@/lib/validation";

type ProjectFormDataType = ProjectFormData;
import { useRole } from "@/components/shell/RoleContext";
import { PoiMapPicker } from "@/components/pois/PoiMapPicker";
import { parseWkbPoint } from "@/lib/wkb";

interface ProjectFormProps {
  projectId?: string;
  initialData?: Partial<ProjectFormDataType> & { centroid?: unknown };
}

export function ProjectForm({ projectId, initialData }: ProjectFormProps) {
  const router = useRouter();
  const { role } = useRole();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFormDataType, string[]>>>({});
  const [globalError, setGlobalError] = useState("");

  // Existing centroid arrives as raw WKB hex from the projects row
  const existingCentroid = parseWkbPoint(initialData?.centroid as string | null | undefined) as
    | { type: 'Point'; coordinates: [number, number] }
    | null;

  const [formData, setFormData] = useState<ProjectFormDataType>({
    name: initialData?.name || "",
    slug: initialData?.slug || "",
    assetClass: initialData?.assetClass || "land",
    narrative: initialData?.narrative || "",
    locality: initialData?.locality || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    layoutType: initialData?.layoutType || null,
    approvalNumber: initialData?.approvalNumber || "",
    reraNumber: initialData?.reraNumber || "",
    priceVisibility: initialData?.priceVisibility || "on_request",
    sellingFastThresholdPct: initialData?.sellingFastThresholdPct ?? 15,
    centroidLng: existingCentroid?.coordinates[0] ?? null,
    centroidLat: existingCentroid?.coordinates[1] ?? null,
  });

  // "RERA Approved?" toggle (Approvals section) — only meaningful for these
  // layout types; initial state reflects whether a RERA number is stored.
  const RERA_LAYOUT_TYPES = ["vmrda", "suda", "buda", "dtcp"];
  const showApprovalsSection = RERA_LAYOUT_TYPES.includes(formData.layoutType || "");
  const [reraApproved, setReraApproved] = useState<boolean>(!!(initialData?.reraNumber || "").trim());

  const pinnedLocation: [number, number] | null =
    formData.centroidLng != null && formData.centroidLat != null
      ? [Number(formData.centroidLng), Number(formData.centroidLat)]
      : null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: ProjectFormDataType) => ({ ...prev, [name]: value }));
  };

  const handleSlugify = () => {
    setFormData((prev: ProjectFormDataType) => ({
      ...prev,
      slug: prev.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    setGlobalError("");

    // The RERA number only persists while the Approvals section is visible
    // and the toggle is on; otherwise it is cleared, matching the hidden UI.
    const payload: ProjectFormDataType = {
      ...formData,
      reraNumber: showApprovalsSection && reraApproved ? formData.reraNumber : "",
    };

    const result = projectId
      ? await updateProject(projectId, payload)
      : await createProject(payload);

    if (result.ok) {
      router.push("/projects");
    } else {
      setGlobalError("message" in result && typeof result.message === "string" ? result.message : "Failed to save project.");
      if ("issues" in result && result.issues) {
        setErrors(result.issues as any);
      }
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!projectId || !confirm("Are you sure you want to archive this project? This will hide it from active views.")) return;
    setIsArchiving(true);
    
    const result = await archiveProject(projectId);
    if (result.ok) {
      router.push("/projects");
    } else {
      setGlobalError(result.message || "Failed to archive.");
      setIsArchiving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {globalError && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{globalError}</div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Project Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">URL Slug *</label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500 sm:text-sm">
              example.com/projects/
            </span>
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              className="block w-full min-w-0 flex-1 rounded-none rounded-r-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSlugify}
              className="ml-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Auto-fill
            </button>
          </div>
          {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug[0]}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Asset Class *</label>
          <select
            name="assetClass"
            value={formData.assetClass}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="land">Land / Plots</option>
            <option value="commercial">Commercial</option>
            <option value="luxury_residential">Luxury Residential</option>
          </select>
          {errors.assetClass && <p className="mt-1 text-sm text-red-600">{errors.assetClass[0]}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Price Visibility *</label>
          <select
            name="priceVisibility"
            value={formData.priceVisibility}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="on_request">Price on Request (Office Only)</option>
            <option value="public">Publicly Visible</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">Controls if public site shows prices.</p>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Narrative / Description</label>
          <textarea
            name="narrative"
            rows={4}
            value={formData.narrative || ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Locality</label>
          <input
            type="text"
            name="locality"
            value={formData.locality || ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input
            type="text"
            name="city"
            value={formData.city || ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Project Location</label>
          <p className="text-xs text-gray-500 mb-2">
            Pin the property on the map. Every project map opens centred here,
            and POI distances are measured from this point.
          </p>
          <PoiMapPicker
            centroid={existingCentroid}
            selectedLocation={pinnedLocation}
            onLocationSelect={(loc) =>
              setFormData((prev: ProjectFormDataType) => ({ ...prev, centroidLng: loc[0], centroidLat: loc[1] }))
            }
            label="Click map to set the project location"
          />
          {pinnedLocation && (
            <p className="text-xs text-green-600 mt-1">
              Location set: {pinnedLocation[0].toFixed(5)}, {pinnedLocation[1].toFixed(5)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Layout Type</label>
          <select
            name="layoutType"
            value={formData.layoutType || ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Not specified</option>
            <option value="vmrda">VMRDA</option>
            <option value="panchayat">Panchayat</option>
            <option value="farmlands">Farmlands</option>
            <option value="suda">SUDA</option>
            <option value="buda">BUDA</option>
            <option value="dtcp">DTCP</option>
            <option value="private_land">Private Land</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Approval Number</label>
          <input
            type="text"
            name="approvalNumber"
            value={formData.approvalNumber || ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {showApprovalsSection && (
          <div className="sm:col-span-2 border rounded-md p-4 bg-gray-50 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Approvals</h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reraApproved"
                checked={reraApproved}
                onChange={(e) => setReraApproved(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="reraApproved" className="text-sm font-medium text-gray-700">
                RERA Approved?
              </label>
            </div>
            {reraApproved && (
              <div>
                <label className="block text-sm font-medium text-gray-700">RERA Number</label>
                <input
                  type="text"
                  name="reraNumber"
                  value={formData.reraNumber || ""}
                  onChange={handleChange}
                  placeholder="e.g. AP-RERA-2026-00452"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 pt-6">
        {projectId && role === "owner" ? (
          <button
            type="button"
            onClick={handleArchive}
            disabled={isArchiving || isSubmitting}
            className="text-sm font-medium text-red-600 hover:text-red-900 disabled:opacity-50"
          >
            {isArchiving ? "Archiving..." : "Archive Project"}
          </button>
        ) : (
          <div /> // Spacer
        )}
        
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isArchiving}
            className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : projectId ? "Save Changes" : "Create Project"}
          </button>
        </div>
      </div>
    </form>
  );
}
