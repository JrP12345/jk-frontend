"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, LoadingState, Select } from "@/components/ui";
import { buttonClassName } from "@/components/ui/Button";
import api from "@/lib/api";
import { authScopeKey } from "@/lib/authScope";
import { hasAnyPermission } from "@/lib/permissions";
import { parsePharmacyCapabilities, type PharmacyCapabilities } from "@/lib/pharmacyCapabilities";
import { readPharmacyIssuer, type PharmacyIssuerProfile } from "@/lib/pharmacyIssuer";
import { validSingleChoice } from "@/lib/locationWorkflow";
import { useAuthStore } from "@/store/authStore";
import { useLatestRead } from "@/hooks/useLatestRead";
import { organizationPath, type OrganizationRecord } from "@/services/organization.service";

interface Branch { id: string; name: string; isActive?: boolean; organizationId?: string; address?: string; phone?: string; timings?: string }
interface Props { organization: OrganizationRecord; onNavigate: (section: string) => void; onOpenWorkspace?: () => void }
export function OrganizationPharmacySetup({ organization, onNavigate, onOpenWorkspace }: Props) {
  const user = useAuthStore(state => state.user);
  return <PharmacySetup key={`${organization.id}:${authScopeKey(user)}`} organization={organization} onNavigate={onNavigate} onOpenWorkspace={onOpenWorkspace} />;
}
function PharmacySetup({ organization, onNavigate, onOpenWorkspace }: Props) {
  const user = useAuthStore(state => state.user);
  const canRead = hasAnyPermission(user, "VIEW_LOCATIONS", "MANAGE_LOCATIONS");
  const canReadIssuer = hasAnyPermission(user, "MANAGE_ORGANIZATION");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [accessError, setAccessError] = useState("");
  const [revision, setRevision] = useState(0);
  const [access, setAccess] = useState<{ capabilities: PharmacyCapabilities; issuer: PharmacyIssuerProfile | null } | null>(null);
  const beginRead = useLatestRead();
  const beginAccess = useLatestRead();
  const selected = branches.find(branch => branch.id === branchId);
  useEffect(() => {
    if (!canRead) return;
    const request = beginRead();
    api.get(organizationPath("/onboarding/locations", organization.id), { signal: request.signal }).then(response => {
      if (!request.isCurrent()) return;
      const rows: Branch[] = response.data?.data;
      if (!Array.isArray(rows) || rows.some(row => !row.id || row.organizationId && row.organizationId !== organization.id)) throw new Error("Branch scope could not be confirmed");
      const active = rows.filter(row => row.isActive !== false);
      setBranches(active); setBranchId(previous => validSingleChoice(active, row => row.id, previous)); setError("");
    }).catch(() => { if (request.isCurrent()) { setBranches([]); setAccess(null); setError("Pharmacy branches could not be checked. Reload setup before continuing."); } })
      .finally(() => { if (request.isCurrent()) setLoading(false); });
    return () => { beginRead(); };
  }, [organization.id, canRead, revision, beginRead]);
  useEffect(() => {
    const request = beginAccess();
    if (!branchId || !canRead) return;
    void Promise.all([
      api.get(organizationPath(`/pharmacy/locations/${encodeURIComponent(branchId)}/capabilities`, organization.id), { signal: request.signal }),
      canReadIssuer ? readPharmacyIssuer(branchId, organization.id, request.signal) : Promise.resolve(null),
    ]).then(([response, issuer]) => {
      if (request.isCurrent()) { setAccess({ capabilities: parsePharmacyCapabilities(response.data?.data, branchId), issuer }); setAccessError(""); }
    }).catch(() => { if (request.isCurrent()) { setAccess(null); setAccessError("Branch access or issuer details could not be confirmed. Reload before treating setup as complete."); } })
      .finally(() => { if (request.isCurrent()) setChecking(false); });
    return () => { beginAccess(); };
  }, [branchId, organization.id, canRead, canReadIssuer, revision, beginAccess]);
  function reload() { setAccess(null); setError(""); setAccessError(""); setLoading(true); setChecking(Boolean(branchId)); setRevision(value => value + 1); }
  if (!canRead) return null;
  const checklist: Array<{ label: string; complete: boolean | undefined }> = selected && access ? [
    { label: "Branch address and contact number", complete: Boolean(selected.address?.trim() && selected.phone?.trim()) },
    { label: "Pharmacy module enabled", complete: access.capabilities.moduleEnabled },
    { label: "Reviewed issuer and supported invoice settings", complete: canReadIssuer ? access.issuer?.issueSupported === true : undefined },
    { label: "Pharmacy enabled at this branch", complete: access.capabilities.enabled },
    { label: "Commercial pharmacy access", complete: ["active", "plan_included"].includes(access.capabilities.commercialEntitlement || "") },
    { label: "Administrator account active", complete: organization.primaryAdmin?.isActive },
  ] : [];
  return <Card><CardHeader><div className="flex items-center justify-between gap-4"><CardTitle as="h2">Pharmacy setup</CardTitle><Button variant="outline" size="sm" aria-label="Refresh pharmacy setup" loading={loading} onClick={reload} icon={<RotateCw className="h-4 w-4" />} /></div><p className="text-sm text-text-secondary">Review branch access, issuer details and administrator access before receiving stock or making sales.</p></CardHeader><CardContent className="space-y-4">
    {loading ? <LoadingState label="Checking pharmacy setup" /> : error ? <Alert variant="error" title="Pharmacy setup unavailable" action={<Button onClick={reload}>Reload setup</Button>}>{error}</Alert> : !branches.length ? <Alert variant="warning" title="Create an active pharmacy branch" action={<Button onClick={() => onNavigate("locations")}>Open locations</Button>}>The pharmacy needs an active physical branch.</Alert> : <>
      <Select label="Review pharmacy branch" value={branchId} options={[{ value: "", label: "Choose a branch" }, ...branches.map(branch => ({ value: branch.id, label: branch.name }))]} onChange={event => { setAccess(null); setAccessError(""); setChecking(Boolean(event.target.value)); setBranchId(event.target.value); }} />
      {checking && <LoadingState label="Checking branch access" />}
      {accessError && <Alert variant="error" title="Branch checks unavailable" action={<Button onClick={reload}>Reload setup</Button>}>{accessError}</Alert>}
      {checklist.length > 0 && <ul aria-label="Pharmacy setup checklist" className="grid gap-x-6 sm:grid-cols-2">{checklist.map(row => <li key={row.label} className="flex items-start justify-between gap-4 border-b border-border py-3 text-sm"><span>{row.label}</span><span className={row.complete ? "shrink-0 text-success-text" : "shrink-0 text-warning-text"}>{row.complete === undefined ? "Not checked" : row.complete ? "Complete" : "Needs attention"}</span></li>)}</ul>}
      {selected && <p className="text-sm leading-relaxed text-text-secondary">In Locations, open this branch’s Pharmacy settings to review issuer and licence details and enable pharmacy. Authenticator setup is optional. Each user can enable it from Account security whenever they want.</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onNavigate("locations")}>Review branch settings</Button>
        {hasAnyPermission(user, "MANAGE_BILLING") && <Button variant="outline" size="sm" onClick={() => onNavigate("subscription")}>Review pharmacy subscription</Button>}
        {hasAnyPermission(user, "VIEW_STAFF", "MANAGE_STAFF") && <Button variant="outline" size="sm" onClick={() => onNavigate("members")}>Review pharmacy staff</Button>}
        {hasAnyPermission(user, "MANAGE_ORGANIZATION") && <Button variant="outline" size="sm" onClick={() => onNavigate("configuration")}>Review modules</Button>}
      </div>
    </>}
    <div className="space-y-3 border-t border-border pt-4"><p className="text-sm leading-relaxed text-text-secondary">After branch checks, assign staff permissions, configure product units and classifications, record opening stock with batches and expiry dates, and open a cash drawer before cash collections. These operational steps are not verified by this checklist.</p>
      {user?.organization_id === organization.id ? <Link href="/dashboard/pharmacy" className={buttonClassName({ variant: "outline", size: "sm" })}>Open pharmacy workspace</Link> : onOpenWorkspace && <Button variant="outline" size="sm" onClick={onOpenWorkspace}>Open administrator workspace</Button>}
    </div>
  </CardContent></Card>;
}
