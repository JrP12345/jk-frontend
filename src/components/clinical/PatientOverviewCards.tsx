"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Badge, StatCard, Button, ChartContainer, LineChart } from "@/components/ui";

export interface PatientDemographics {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  abdmHealthId?: string;
  allergies?: string[];
  conditions?: string[];
  medicalNotes?: string;
  emergencyContacts?: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  insurancePolicies?: Array<{
    providerName: string;
    policyNumber: string;
    coverageAmount?: number;
    validUntil?: string;
  }>;
  totalAppointments?: number;
  activeAdmissions?: number;
}

interface PatientOverviewCardsProps {
  patient: PatientDemographics;
  onEditProfile?: () => void;
}

export function PatientOverviewCards({ patient, onEditProfile }: PatientOverviewCardsProps) {
  const [selectedVitalMetric, setSelectedVitalMetric] = useState<"bp" | "pulse" | "glucose" | "spo2">("bp");

  const vitalsHistoryData = [
    { label: "Visit 1", systolic: 128, diastolic: 82, pulse: 74, glucose: 104, spo2: 98 },
    { label: "Visit 2", systolic: 134, diastolic: 86, pulse: 78, glucose: 112, spo2: 99 },
    { label: "Visit 3", systolic: 124, diastolic: 81, pulse: 72, glucose: 98, spo2: 98 },
    { label: "Visit 4", systolic: 118, diastolic: 78, pulse: 70, glucose: 95, spo2: 99 },
    { label: "Latest", systolic: 120, diastolic: 79, pulse: 71, glucose: 96, spo2: 98 },
  ];

  const calculateAge = (dobString?: string) => {
    if (!dobString) return "N/A";
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return dobString;
    const diffMs = Date.now() - dob.getTime();
    const ageDate = new Date(diffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970) + " yrs";
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-6">
      {/* Top Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Consultations"
          value={(patient.totalAppointments || 0).toString()}
          icon={
            <svg className="h-5 w-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          label="Active Admissions"
          value={(patient.activeAdmissions || 0).toString()}
          icon={
            <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
        <StatCard
          label="Allergies Flagged"
          value={(patient.allergies?.length || 0).toString()}
          icon={
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <StatCard
          label="Active Conditions"
          value={(patient.conditions?.length || 0).toString()}
          icon={
            <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      </div>

      {/* 2-Column Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Patient Demographics & Profile */}
        <Card className="rounded-2xl border border-border bg-surface shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-text flex items-center gap-2">
              <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Demographics & Profile
            </CardTitle>
            {onEditProfile && (
              <Button size="xs" variant="outline" onClick={onEditProfile} className="rounded-lg font-semibold">
                ✏️ Edit Profile
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-surface-alt rounded-xl border border-border/60">
              <div>
                <span className="text-text-muted font-medium block">Full Name</span>
                <span className="font-bold text-text text-sm">{patient.name}</span>
              </div>
              <div>
                <span className="text-text-muted font-medium block">Email Address</span>
                <span className="font-semibold text-text">{patient.email}</span>
              </div>
              <div>
                <span className="text-text-muted font-medium block">Phone Number</span>
                <span className="font-mono font-semibold text-text">{patient.phone || "—"}</span>
              </div>
              <div>
                <span className="text-text-muted font-medium block">Gender / Age</span>
                <span className="font-semibold text-text capitalize">{patient.gender || "Unknown"} ({calculateAge(patient.dob)})</span>
              </div>
              <div>
                <span className="text-text-muted font-medium block">Blood Group</span>
                <Badge variant="danger" size="sm" className="font-mono font-bold">
                  {patient.bloodGroup || "Not Specified"}
                </Badge>
              </div>
              <div>
                <span className="text-text-muted font-medium block">Date of Birth</span>
                <span className="font-semibold text-text">{formatDate(patient.dob)}</span>
              </div>
            </div>

            <div>
              <span className="text-text-muted font-medium block mb-1">Residential Address</span>
              <p className="text-text-secondary bg-surface-alt p-2.5 rounded-xl border border-border/60">
                {patient.address || "No address on file."}
              </p>
            </div>

            {patient.abdmHealthId && (
              <div>
                <span className="text-text-muted font-medium block mb-1">ABDM Health ID (ABHA)</span>
                <Badge variant="primary" size="sm" className="font-mono">
                  {patient.abdmHealthId}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clinical Summary & Notes */}
        <Card className="rounded-2xl border border-border bg-surface shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-text flex items-center gap-2">
              <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Clinical Alerts & Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {/* Allergies */}
            <div>
              <span className="text-text-muted font-bold block mb-1.5 uppercase text-[10px] tracking-wider">
                Drug & Environmental Allergies
              </span>
              <div className="flex flex-wrap gap-1.5">
                {patient.allergies && patient.allergies.length > 0 ? (
                  patient.allergies.map((allergy, idx) => (
                    <Badge key={idx} variant="danger" size="sm" className="font-bold px-2 py-0.5">
                      ⚠️ {allergy}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="success" size="sm">
                    ✓ No Known Drug Allergies (NKDA)
                  </Badge>
                )}
              </div>
            </div>

            {/* Conditions */}
            <div>
              <span className="text-text-muted font-bold block mb-1.5 uppercase text-[10px] tracking-wider">
                Active Diagnoses & Chronic Conditions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {patient.conditions && patient.conditions.length > 0 ? (
                  patient.conditions.map((condition, idx) => (
                    <Badge key={idx} variant="primary" size="sm" className="font-medium px-2 py-0.5">
                      🩺 {condition}
                    </Badge>
                  ))
                ) : (
                  <span className="text-text-muted italic">No active chronic conditions recorded.</span>
                )}
              </div>
            </div>

            {/* General Medical Notes */}
            <div>
              <span className="text-text-muted font-bold block mb-1.5 uppercase text-[10px] tracking-wider">
                Physician Notes & Special Precautions
              </span>
              <div className="bg-surface-alt p-3 rounded-xl border border-border/60 leading-relaxed text-text-secondary">
                {patient.medicalNotes || "No special physician notes attached to this profile."}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Longitudinal Vitals Trend Analysis */}
        <ChartContainer
          title="Longitudinal Vitals Trajectory"
          description="Track patient physiological indicators across past clinic encounters"
          timeRanges={[
            { label: "Blood Pressure", value: "bp" },
            { label: "Pulse / HR", value: "pulse" },
            { label: "Blood Glucose", value: "glucose" },
            { label: "SpO2 Oxygen", value: "spo2" },
          ]}
          activeRange={selectedVitalMetric}
          onRangeChange={(v) => setSelectedVitalMetric(v as any)}
          height={210}
        >
          {selectedVitalMetric === "bp" && (
            <LineChart
              data={vitalsHistoryData}
              series={[
                { key: "systolic", name: "Systolic (mmHg)", color: "var(--s-chart-5, #f43f5e)" },
                { key: "diastolic", name: "Diastolic (mmHg)", color: "var(--s-chart-1, #3b82f6)" },
              ]}
              referenceBand={{
                min: 80,
                max: 120,
                label: "Target BP Range",
                color: "var(--s-chart-2, #10b981)",
              }}
              height={210}
              valueFormatter={(v) => `${v} mmHg`}
            />
          )}

          {selectedVitalMetric === "pulse" && (
            <LineChart
              data={vitalsHistoryData}
              series={[
                { key: "pulse", name: "Heart Rate (BPM)", color: "var(--s-chart-4, #8b5cf6)" },
              ]}
              referenceBand={{
                min: 60,
                max: 100,
                label: "Normal Resting HR",
                color: "var(--s-chart-2, #10b981)",
              }}
              height={210}
              valueFormatter={(v) => `${v} bpm`}
            />
          )}

          {selectedVitalMetric === "glucose" && (
            <LineChart
              data={vitalsHistoryData}
              series={[
                { key: "glucose", name: "Blood Glucose (mg/dL)", color: "var(--s-chart-3, #f59e0b)" },
              ]}
              referenceBand={{
                min: 70,
                max: 140,
                label: "Target Fasting/PP",
                color: "var(--s-chart-2, #10b981)",
              }}
              height={210}
              valueFormatter={(v) => `${v} mg/dL`}
            />
          )}

          {selectedVitalMetric === "spo2" && (
            <LineChart
              data={vitalsHistoryData}
              series={[
                { key: "spo2", name: "Blood Oxygen (SpO2 %)", color: "var(--s-chart-2, #10b981)" },
              ]}
              referenceBand={{
                min: 95,
                max: 100,
                label: "Optimal Oxygenation",
                color: "var(--s-chart-2, #10b981)",
              }}
              height={210}
              valueFormatter={(v) => `${v}%`}
            />
          )}
        </ChartContainer>

        {/* Emergency Contacts */}
        <Card className="rounded-2xl border border-border bg-surface shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-text flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Emergency Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {patient.emergencyContacts && patient.emergencyContacts.length > 0 ? (
              <div className="space-y-2">
                {patient.emergencyContacts.map((contact, idx) => (
                  <div key={idx} className="p-3 bg-surface-alt rounded-xl border border-border/60 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-text">{contact.name}</p>
                      <p className="text-[11px] text-text-muted capitalize">{contact.relationship}</p>
                    </div>
                    <span className="font-mono font-bold text-primary-600 bg-primary-500/10 px-2.5 py-1 rounded-lg">
                      📞 {contact.phone}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted italic py-4 text-center">No emergency contacts registered.</p>
            )}
          </CardContent>
        </Card>

        {/* Insurance Policies */}
        <Card className="rounded-2xl border border-border bg-surface shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-text flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Insurance Policies & Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {patient.insurancePolicies && patient.insurancePolicies.length > 0 ? (
              <div className="space-y-2">
                {patient.insurancePolicies.map((policy, idx) => (
                  <div key={idx} className="p-3 bg-surface-alt rounded-xl border border-border/60 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-text">{policy.providerName}</p>
                      <p className="text-[11px] text-text-muted font-mono">Policy #: {policy.policyNumber}</p>
                      {policy.validUntil && (
                        <p className="text-[10px] text-text-muted mt-0.5">Valid until: {formatDate(policy.validUntil)}</p>
                      )}
                    </div>
                    {policy.coverageAmount !== undefined && (
                      <div className="text-right">
                        <span className="font-black text-sm text-emerald-600 block">₹{policy.coverageAmount.toLocaleString()}</span>
                        <span className="text-[10px] text-text-muted">Coverage Limit</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted italic py-4 text-center">No insurance policy details on file (Self-Pay Patient).</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
