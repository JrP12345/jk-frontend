import api from "@/lib/api";
import type { User } from "@/store/authStore";
export interface PharmacyTrialOption { id: string; name: string; trialDays: number; monthlyTotalPaise: number; currency: "INR"; maxStaff: number; fingerprint: string }
export interface PharmacySetupProof { requestId: string; setupToken: string; completionKey: string }
export interface PharmacySetupInput { ownerName: string; email: string; password?: string; businessName: string; city: string; address: string; businessPhone?: string; planId: string; planFingerprint: string }
export interface PharmacySetupStatus { state: "pending" | "verified" | "provisioned"; organizationId?: string }
export interface PharmacySetupAuth { twoFactorRequired?: boolean; twoFactorToken?: string; user?: User }
const id = (value: unknown) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const body = (proof: PharmacySetupProof) => ({ requestId: proof.requestId, setupToken: proof.setupToken });
export function parseStoredPharmacySetup(value: string | null): PharmacySetupProof | null {
  if (!value) return null;
  let proof: PharmacySetupProof; try { proof = JSON.parse(value); } catch { throw new Error("Saved business setup reference needs review"); }
  if (!proof || !id(proof.requestId) || !/^[a-f\d]{64}$/.test(proof.setupToken) || !/^[a-zA-Z0-9_-]{8,100}$/.test(proof.completionKey)) throw new Error("Saved business setup reference needs review"); return proof;
}
export async function readPharmacyTrials(signal?: AbortSignal): Promise<PharmacyTrialOption[]> {
  const data = (await api.get("/pharmacy/onboarding/options", { signal })).data?.data;
  if (!data || !Array.isArray(data.items) || data.items.length > 20 || data.items.some((row: PharmacyTrialOption) => !id(row.id) || typeof row.name !== "string" || row.name.length > 200 || !Number.isSafeInteger(row.trialDays) || row.trialDays < 1 || row.trialDays > 365 || !Number.isSafeInteger(row.monthlyTotalPaise) || row.monthlyTotalPaise < 0 || row.currency !== "INR" || !Number.isSafeInteger(row.maxStaff) || row.maxStaff < 1 || !/^[a-f\d]{64}$/.test(row.fingerprint))) throw new Error("Published pharmacy trials could not be confirmed"); return data.items;
}
export async function startPharmacySetup(input: PharmacySetupInput) {
  const data = (await api.post("/pharmacy/onboarding/start", input)).data?.data;
  if (!data || !id(data.requestId) || typeof data.setupToken !== "string" || !/^[a-f\d]{64}$/.test(data.setupToken) || data.state !== "pending" || typeof data.deliveryAvailable !== "boolean") throw new Error("Setup request could not be confirmed. Begin another verified request after the resend interval");
  return { proof: { requestId: data.requestId, setupToken: data.setupToken, completionKey: crypto.randomUUID() }, deliveryAvailable: data.deliveryAvailable };
}
export async function pharmacySetupStatus(proof: PharmacySetupProof): Promise<PharmacySetupStatus> {
  const data = (await api.post("/pharmacy/onboarding/status", body(proof))).data?.data;
  if (!data || !["pending", "verified", "provisioned"].includes(data.state) || data.state === "provisioned" && !id(data.organizationId)) throw new Error("Business setup status could not be confirmed"); return data;
}
export async function verifyPharmacySetup(proof: PharmacySetupProof, otp: string) {
  const data = (await api.post("/pharmacy/onboarding/verify", { ...body(proof), otp })).data?.data;
  if (!data || !["verified", "provisioned"].includes(data.state)) throw new Error("Business email verification could not be confirmed"); return data as PharmacySetupStatus;
}
export async function resendPharmacySetup(proof: PharmacySetupProof) {
  const data = (await api.post("/pharmacy/onboarding/resend", body(proof))).data?.data;
  if (!data || data.state !== "pending" || typeof data.deliveryAvailable !== "boolean") throw new Error("Setup code delivery could not be confirmed"); return data.deliveryAvailable as boolean;
}
function authResult(value: unknown): PharmacySetupAuth {
  const data = value as PharmacySetupAuth;
  if (data?.twoFactorRequired === true && typeof data.twoFactorToken === "string" && data.twoFactorToken.length > 10) return data;
  if (!data?.user || !id(data.user.id) || !id(data.user.organization_id) || data.user.workspaceProfile !== "pharmacy" || ["root", "patient", "family_member", "guest"].includes(data.user.role)) throw new Error("The pharmacy sign-in outcome could not be confirmed. Keep the setup reference and check again"); return data;
}
export async function completePharmacySetup(proof: PharmacySetupProof) { return authResult((await api.post("/pharmacy/onboarding/complete", body(proof), { headers: { "Idempotency-Key": proof.completionKey } })).data?.data); }
export async function verifyPharmacySetupMfa(twoFactorToken: string, otp: string) { return authResult((await api.post("/auth/login/verify-2fa", { twoFactorToken, otp })).data?.data); }
export function pharmacySetupError(value: unknown) { return (value as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (value as Error)?.message || "Business setup could not be confirmed"; }
