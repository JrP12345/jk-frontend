"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, DatePicker, Input, Modal, Select, Spinner } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import api from "@/lib/api";
import { pickupError } from "@/lib/pharmacyPickup";
import type { OrganizationMember } from "@/services/organization.service";

interface Review {
  registrationNumber: string;
  council: string;
  address: string;
  reviewReference: string;
  validUntil: string;
  active: boolean;
  revision: number;
}

const empty = {
  registrationNumber: "",
  council: "",
  address: "",
  reviewReference: "",
  validUntil: "",
  active: false,
  revision: 0,
};

const fields = [
  ["registrationNumber", "Pharmacist registration number"],
  ["council", "Registration council"],
  ["address", "Professional address"],
  ["reviewReference", "Registration evidence reference"],
] as const;

/** Administrative evidence review using the existing professional-review API. */
export function PharmacyProfessionalReview({
  organizationId,
  locationId,
  onClose,
}: {
  organizationId: string;
  locationId: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [subject, setSubject] = useState("");
  const [loadedSubject, setLoadedSubject] = useState("");
  const [review, setReview] = useState<Review>(empty);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const beginMembers = useLatestRead();
  const beginReview = useLatestRead();
  const alive = useRef(true);
  const lock = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadMembers = useCallback(async () => {
    const read = beginMembers();
    setReading(true);
    setError("");
    try {
      const rows = (await api.get(`/onboarding/organizations/${organizationId}/members`, { signal: read.signal })).data?.data?.members;
      if (!Array.isArray(rows)) throw Error("Staff members could not be loaded completely");
      if (read.isCurrent()) {
        setMembers(
          rows.filter(
            (row: OrganizationMember) =>
              row.id && row.isActive && row.source === "org_member" && !["patient", "family_member", "guest", "root"].includes(row.role)
          )
        );
      }
    } catch (failure) {
      if (read.isCurrent()) setError(pickupError(failure));
    } finally {
      if (read.isCurrent()) setReading(false);
    }
  }, [beginMembers, organizationId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadMembers();
    });
    return () => {
      active = false;
    };
  }, [loadMembers]);

  const loadReview = useCallback(async () => {
    const read = beginReview();
    if (!subject) return;
    setReading(true);
    setLoadedSubject("");
    setError("");
    setNotice("");
    setConfirmed(false);
    try {
      const row = (
        await api.get(`/pharmacy/locations/${locationId}/professionals/${subject}/pharmacist`, { signal: read.signal })
      ).data?.data as Review | null;
      if (
        row &&
        (!Number.isSafeInteger(row.revision) ||
          row.revision < 1 ||
          typeof row.active !== "boolean" ||
          !Number.isFinite(Date.parse(row.validUntil)) ||
          fields.some(([field]) => typeof row[field] !== "string"))
      ) {
        throw Error("Professional evidence response is incomplete");
      }
      if (read.isCurrent()) {
        setReview(row ? { ...row, validUntil: row.validUntil.slice(0, 10) } : empty);
        setLoadedSubject(subject);
      }
    } catch (failure) {
      if (read.isCurrent()) setError(pickupError(failure));
    } finally {
      if (read.isCurrent()) setReading(false);
    }
  }, [beginReview, locationId, subject]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadReview();
    });
    return () => {
      active = false;
    };
  }, [loadReview]);

  async function save() {
    if (lock.current || !subject || loadedSubject !== subject || reading || !alive.current) return;
    if (fields.some(([field]) => review[field].trim().length < 3) || !review.validUntil || (review.active && !confirmed)) {
      setError("Complete the registration evidence and confirm the review before activating it.");
      return;
    }
    const deadline = new Date(`${review.validUntil}T23:59:59.999+05:30`).getTime();
    if (!Number.isFinite(deadline) || (review.active && deadline <= Date.now())) {
      setError("Choose a valid future review deadline before activating the registration.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api.put(`/pharmacy/locations/${locationId}/professionals/${subject}/pharmacist`, {
        expectedRevision: review.revision,
        registrationNumber: review.registrationNumber.trim(),
        council: review.council.trim(),
        address: review.address.trim(),
        reviewReference: review.reviewReference.trim(),
        validUntil: `${review.validUntil}T23:59:59.999+05:30`,
        active: review.active,
      });
      const saved = response.data?.data as Review;
      if (!saved || saved.revision !== review.revision + 1 || typeof saved.active !== "boolean") {
        throw Error("Save outcome needs review. Reload the saved registration before another change.");
      }
      if (alive.current) {
        setReview({ ...saved, validUntil: saved.validUntil.slice(0, 10) });
        setConfirmed(false);
        setNotice(saved.active ? "Registration review saved for this branch." : "Registration review deactivated. New supplies require active evidence.");
      }
    } catch (failure) {
      if (alive.current) {
        setError(pickupError(failure));
        setLoadedSubject("");
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Pharmacist registrations"
      description="Review professional evidence for staff at this pharmacy branch."
      size="lg"
      presentation="sheet"
      busy={busy}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <Button size="sm" variant="outline" disabled={busy} onClick={onClose}>
            Close
          </Button>
          <Button
            size="sm"
            loading={busy}
            disabled={reading || !subject || loadedSubject !== subject || (review.active && !confirmed)}
            onClick={() => {
              void save();
            }}
          >
            Save registration review
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="error" title="Registration review needs attention">
            {error}
          </Alert>
        )}

        {notice && (
          <p role="status" className="rounded-xl border border-success/30 bg-success-subtle px-3 py-2 text-xs font-medium text-text">
            {notice}
          </p>
        )}

        <p className="rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-2.5 text-xs text-text-secondary">
          This records your review of actual registration evidence. It does not verify a registration with a council. Branch assignment and
          active registration are checked again for each supply.
        </p>

        <Select
          size="sm"
          label="Staff member"
          searchable
          placeholder="Choose an active staff member"
          value={subject}
          disabled={busy || reading}
          options={members.map(member => ({ value: member.id, label: `${member.name} · ${member.role.replaceAll("_", " ")}` }))}
          onChange={event => {
            setLoadedSubject("");
            setSubject(event.target.value);
            setReview(empty);
            setConfirmed(false);
          }}
        />

        {reading && (
          <div role="status" className="flex items-center gap-2 text-xs text-text-secondary">
            <Spinner size="sm" />
            Loading registration review…
          </div>
        )}

        {error && (
          <div>
            <Button
              size="xs"
              variant="outline"
              disabled={reading || busy}
              onClick={() => {
                if (subject) void loadReview();
                else void loadMembers();
              }}
            >
              Reload saved review
            </Button>
          </div>
        )}

        {subject && (
          <fieldset
            disabled={busy || reading || loadedSubject !== subject}
            className="space-y-3 rounded-xl border border-border/70 bg-surface-alt/25 p-3 md:p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map(([field, label]) => (
                <Input
                  key={field}
                  size="sm"
                  label={label}
                  value={review[field]}
                  maxLength={500}
                  autoComplete="off"
                  onChange={event => {
                    setReview(current => ({ ...current, [field]: event.target.value }));
                    setConfirmed(false);
                  }}
                />
              ))}
              <DatePicker
                size="sm"
                label="Registration review valid until"
                value={review.validUntil}
                onChange={validUntil => {
                  setReview(current => ({ ...current, validUntil }));
                  setConfirmed(false);
                }}
              />
            </div>

            <Checkbox
              label="Active registration review for this branch"
              checked={review.active}
              onChange={event => {
                setReview(current => ({ ...current, active: event.target.checked }));
                setConfirmed(false);
              }}
            />

            {review.active && (
              <Checkbox
                label="I reviewed the pharmacist registration evidence and branch assignment."
                checked={confirmed}
                onChange={event => setConfirmed(event.target.checked)}
              />
            )}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
