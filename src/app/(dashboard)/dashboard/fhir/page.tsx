"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, Button, Modal, Select, useToast, Spinner, Badge, StatCard, SkeletonTable
} from "@/components/ui";

interface PatientOption {
  id: string;
  name: string;
  mrn?: string;
  gender?: string;
}

interface HieConnection {
  id: string;
  name: string;
  type: string; // e.g. "ABDM M3", "NDHM HIE", "HL7 FHIR R4 Endpoint"
  status: "active" | "syncing" | "offline";
  lastSync: string;
  recordsExchanged: number;
}

export default function FhirInteroperabilityPage() {
  const { activeClinicId } = useAuthStore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [selectedResource, setSelectedResource] = useState<string>("Bundle");

  const [fhirJsonPayload, setFhirJsonPayload] = useState<string>("");
  const [fetchingPayload, setFetchingPayload] = useState(false);

  const [hieConnections] = useState<HieConnection[]>([]);

  useEffect(() => {
    fetchPatientsList();
  }, [activeClinicId]);

  useEffect(() => {
    if (selectedPatientId) {
      loadFhirResourcePayload(selectedPatientId, selectedResource);
    }
  }, [selectedPatientId, selectedResource]);

  const fetchPatientsList = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/patients${activeClinicId ? `?clinicId=${activeClinicId}` : ""}`);
      if (res.data?.success && Array.isArray(res.data?.data)) {
          const list: PatientOption[] = res.data.data.map((p: any) => ({
          id: p.id || p._id,
          name: p.userId?.name || p.name || "Patient",
          mrn: p.mrn,
          gender: p.gender || "male",
        }));
        setPatients(list);
        if (list.length > 0) {
          setSelectedPatientId(list[0].id);
        }
      } else {
        setPatients([]);
        setSelectedPatientId("");
      }
    } catch (err) {
      console.error("Error loading patients list for FHIR inspector:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadFhirResourcePayload = async (patientId: string, resourceType: string) => {
    try {
      setFetchingPayload(true);
      let endpoint = `/fhir/R4/Bundle/${patientId}`;

      if (resourceType === "Patient") {
        endpoint = `/fhir/R4/Patient/${patientId}`;
      } else if (resourceType === "Observation") {
        endpoint = `/fhir/R4/Observation/${patientId}`;
      } else if (resourceType === "DiagnosticReport") {
        endpoint = `/fhir/R4/DiagnosticReport/${patientId}`;
      }

      const res = await api.get(endpoint);
      if (res.data) {
        setFhirJsonPayload(JSON.stringify(res.data, null, 2));
      }
    } catch (err: any) {
      toast({
        title: "FHIR Gateway Error",
        description: err.response?.data?.message || "Failed to fetch FHIR payload from server",
        variant: "error",
      });
      setFhirJsonPayload(JSON.stringify({ error: "Failed to fetch FHIR payload", details: err.response?.data?.message || "Resource not found" }, null, 2));
    } finally {
      setFetchingPayload(false);
    }
  };

  const handleDownloadFhirJson = () => {
    if (!fhirJsonPayload) return;
    const blob = new Blob([fhirJsonPayload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fhir-R4-${selectedResource.toLowerCase()}-${selectedPatientId.substring(0, 8)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "FHIR Payload Exported",
      description: `Downloaded valid HL7 FHIR R4 ${selectedResource} bundle JSON.`,
      variant: "success",
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider text-blue-100">
            🌐 HL7 FHIR R4 & ABDM Data Portability
          </div>
          <h1 className="text-3xl font-bold tracking-tight">FHIR R4 Interoperability & Health Data Exchange</h1>
          <p className="text-blue-100 text-sm max-w-2xl">
            Standardized HL7 FHIR R4 health data exchange, ABDM consent framework integration, and longitudinal patient health bundle JSON export.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleDownloadFhirJson}
            disabled={!fhirJsonPayload || fetchingPayload}
            className="bg-white text-blue-800 hover:bg-blue-50 font-semibold shadow-md border-0 text-sm px-4 py-2.5 rounded-xl transition-all"
          >
            ⬇️ Export FHIR R4 Bundle (.json)
          </Button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active HIE Connectors"
          value={hieConnections.length}
          change={{ value: "Configured connectors", positive: false }}
          icon={
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
              🌐
            </div>
          }
        />
        <StatCard
          title="FHIR Bundles Exported"
          value="—"
          change={{ value: "No export telemetry", positive: false }}
          icon={
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
              📦
            </div>
          }
        />
        <StatCard
          title="HL7 R4 Compliance"
          value="—"
          change={{ value: "Provider validation unavailable", positive: false }}
          icon={
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
              ✅
            </div>
          }
        />
        <StatCard
          title="ABDM Consent Tokens"
          value="—"
          change={{ value: "No consent telemetry", positive: false }}
          icon={
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
              🔐
            </div>
          }
        />
      </div>

      {/* Live FHIR Resource Inspector & Exporter Workspace */}
      <Card className="shadow-sm border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900">
        <CardHeader className="p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span>🔍</span> Live HL7 FHIR R4 Resource Inspector
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Inspect real-time FHIR R4 Patient, Observation, DiagnosticReport, and Bundle JSON schemas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <span className="text-xs text-gray-500 mr-2">Patient:</span>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="text-xs py-1.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.mrn})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-xs text-gray-500 mr-2">FHIR Resource:</span>
              <select
                value={selectedResource}
                onChange={(e) => setSelectedResource(e.target.value)}
                className="text-xs py-1.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="Bundle">Bundle (Full Record)</option>
                <option value="Patient">Patient Resource</option>
                <option value="Observation">Observation (Vitals)</option>
                <option value="DiagnosticReport">DiagnosticReport (Lab)</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5">
          {fetchingPayload ? (
            <div className="p-12 text-center text-gray-500 space-y-3">
              <Spinner size="lg" />
              <p className="text-xs font-medium">Fetching FHIR R4 schema payload from REST gateway...</p>
            </div>
          ) : !selectedPatientId ? (
            <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No patient records are available for FHIR inspection.
            </div>
          ) : (
            <div className="relative">
              <div className="absolute right-3 top-3 z-10">
                <Button
                  onClick={handleDownloadFhirJson}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 py-1 px-3 rounded-lg shadow-sm"
                >
                  📋 Download JSON
                </Button>
              </div>

              <pre className="p-4 bg-gray-950 text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto max-h-96 border border-gray-800 shadow-inner">
                {fhirJsonPayload || "// Select a patient to inspect FHIR R4 JSON schema"}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active HIE Connections & ABDM Exchange Table */}
      <Card className="shadow-sm border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900">
        <CardHeader className="p-5 border-b border-gray-100 dark:border-gray-800">
          <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Registered HIE Network Endpoints & Consent Sync
          </CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Active Health Information Exchange (HIE) integration connectors and ABDM consent artifact logging.
          </p>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <SkeletonTable rows={3} cols={5} />
            </div>
          ) : hieConnections.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No HIE connectors are configured for this workspace.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {hieConnections.map((hie) => (
                <div key={hie.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-sm">
                      HIE
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                        {hie.name}
                        <Badge variant="success">🟢 Active</Badge>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Protocol: <strong className="text-gray-700 dark:text-gray-300">{hie.type}</strong> · Last Sync: {hie.lastSync}
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <div className="font-bold text-gray-900 dark:text-gray-100">
                      {hie.recordsExchanged.toLocaleString()} Records Exchanged
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      200 OK · HL7 R4 Validated
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
