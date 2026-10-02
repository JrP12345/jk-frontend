import api from "@/lib/api";

export interface OrganizationRecord {
  id: string; name: string; city: string; plan: string; status: string; isActive?: boolean;
  address?: string; email?: string; phone?: string; description?: string;
  logo_url?: string | null; image_url?: string | null; images?: string[];
  countryCode?: string; currency?: string; timezone?: string; taxId?: string; licenseNumber?: string;
  timings?: string; working_days?: string; onboardingStatus?: string;
  maxClinics?: number; maxDoctors?: number; maxStaff?: number;
  primaryAdmin?: { name: string; email?: string } | null;
  subscriptionSummary?: { label?: string; commercialState?: string; trialEndsAt?: string; nextBillingDate?: string; [key: string]: unknown };
}
export interface OrganizationMember { id: string; name: string; email: string; phone?: string; role: string; isActive: boolean; source?: string }

export function organizationPath(path: string, organizationId?: string) {
  return organizationId ? `${path}${path.includes("?") ? "&" : "?"}organizationId=${encodeURIComponent(organizationId)}` : path;
}
export function organizationImageUrl(value?: string | null, organizationId?: string, slot: string | number = "logo_url") {
  if (!value) return undefined;
  if (/^(https?:|blob:|data:)/i.test(value)) return value;
  // Same-origin proxy keeps branding compatible with the site's image CSP.
  if (value.startsWith("/api/")) return value;
  if (organizationId) return `/api/public/organizations/${organizationId}/branding/${slot}`;
  return undefined;
}

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(file);
  });
}
/** Upload all files before saving. Cleanup only staged uploads on failure;
 * a committed image is retained even if the save response was lost. */
export async function saveWithBranding<T>(values: (File | string | null | undefined)[], organizationId: string | undefined, save: (refs: (string | null)[]) => Promise<T>): Promise<T> {
  const staged: string[] = [];
  try {
    const refs: (string | null)[] = [];
    for (const value of values) {
      if (!(value instanceof File)) { refs.push(value || null); continue; }
      if (!["image/png", "image/jpeg", "image/webp"].includes(value.type) || value.size > 5 * 1024 * 1024) throw new Error("Select a PNG, JPEG or WebP image up to 5 MB");
      const response = await api.post(organizationPath("/organizations/branding/uploads", organizationId), { forCreation: !organizationId, contentType: value.type, base64Data: await fileBase64(value) }, { timeout: 60000 });
      if (!response.data?.data?.reference || !response.data.data.id) throw new Error("Image upload did not return a saved reference");
      staged.push(response.data.data.id);
      refs.push(response.data.data.reference);
    }
    return await save(refs);
  } catch (error) {
    await Promise.allSettled(staged.map((id) => api.delete(`/organizations/branding/uploads/${encodeURIComponent(id)}`)));
    throw error;
  }
}
