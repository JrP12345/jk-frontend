"use client";

import { useState } from "react";
import { Card, Tabs } from "@/components/ui";
import { PharmacyFileHistory } from "./PharmacyFileHistory";
import { PharmacyRegister } from "./PharmacyRegister";

interface PharmacyPrescriptionRecordsProps {
  locationId: string;
  canReadRegister: boolean;
  canExportRegister: boolean;
  canReadFiles: boolean;
  canManageFiles: boolean;
  initialTab?: "register" | "files";
}

export function PharmacyPrescriptionRecords({
  locationId,
  canReadRegister,
  canExportRegister,
  canReadFiles,
  canManageFiles,
  initialTab,
}: PharmacyPrescriptionRecordsProps) {
  const defaultTab = initialTab === "files" && canReadFiles ? "files" : canReadRegister ? "register" : "files";
  const [tab, setTab] = useState<string>(defaultTab);
  const resolvedTab = tab === "files" && canReadFiles ? "files" : canReadRegister ? "register" : "files";

  if (canReadRegister && !canReadFiles) {
    return <PharmacyRegister locationId={locationId} canExport={canExportRegister} />;
  }

  if (!canReadRegister && canReadFiles) {
    return locationId ? <PharmacyFileHistory locationId={locationId} canManage={canManageFiles} /> : null;
  }

  return (
    <section className="min-w-0" aria-label="Prescription records">
      <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
        <header className="border-b border-border/70 px-3 py-3 md:px-4">
          <h2 className="text-sm font-semibold text-text md:text-base">Prescription records</h2>
          <p className="mt-0.5 hidden text-xs text-text-secondary sm:block">
            Schedule H1 and Schedule H registers, original prescription files, retention and legal holds.
          </p>
        </header>

        <Tabs
          variant="underline"
          scrollActiveIntoView={false}
          activeTab={resolvedTab}
          onChange={setTab}
          tabs={[
            {
              id: "register",
              label: "Prescription registers",
              content: (
                <div className="p-3 md:p-4">
                  <PharmacyRegister embedded locationId={locationId} canExport={canExportRegister} />
                </div>
              ),
            },
            {
              id: "files",
              label: "Prescription files",
              content: (
                <div className="p-3 md:p-4">
                  {locationId ? (
                    <PharmacyFileHistory embedded locationId={locationId} canManage={canManageFiles} />
                  ) : (
                    <p className="rounded-xl border border-border/70 bg-surface-alt/40 p-3 text-xs text-text-secondary">
                      Choose a branch location to review prescription file history.
                    </p>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </section>
  );
}
