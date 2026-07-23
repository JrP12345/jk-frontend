"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, Button, Modal, Input, useToast, Spinner, Badge, Checkbox, ConfirmDialog, ScheduleEditor, ImageUpload, Select, SkeletonTable, Dropdown
} from "@/components/ui";
import { useR2Upload } from "@/lib/useR2Upload";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

interface Clinic {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  image_url: string;
  timings: string;
  facilities: string[];
}

export default function ClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [qrClinic, setQrClinic] = useState<Clinic | null>(null);
  const { toast } = useToast();
  const { uploadFile } = useR2Upload();

  // Clinic Form Validation State
  const [clinicErrors, setClinicErrors] = useState<Record<string, string>>({});

  const validateClinicField = (field: string, value: string) => {
    let error = "";
    if (field === "name" && !value.trim()) {
      error = "Clinic Name is required";
    } else if (field === "city" && !value.trim()) {
      error = "City is required";
    } else if (field === "email" && value.trim() && !EMAIL_REGEX.test(value)) {
      error = "Please enter a valid email address";
    }
    
    setClinicErrors((prev) => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
    return !error;
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    if (clinicErrors[field]) {
      setClinicErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const fetchClinics = async () => {
    try {
      setLoading(true);
      const res = await api.get("/onboarding/clinics");
      setClinics(res.data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load clinics list", variant: "error", duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinics();
  }, []);

  const openModal = () => {
    setEditingId(null);
    setFormData({ facilities: [] });
    setClinicErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (row: Clinic) => {
    setEditingId(row.id);
    setFormData({ ...row, facilities: row.facilities || [] });
    setClinicErrors({});
    setIsModalOpen(true);
  };

  const handleFacilityChange = (facility: string, checked: boolean) => {
    const currentFacilities = formData.facilities || [];
    if (checked) {
      setFormData({ ...formData, facilities: [...currentFacilities, facility] });
    } else {
      setFormData({ ...formData, facilities: currentFacilities.filter((f: string) => f !== facility) });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const isNameValid = validateClinicField("name", formData.name || "");
    const isCityValid = validateClinicField("city", formData.city || "");
    const isEmailValid = validateClinicField("email", formData.email || "");

    if (!isNameValid || !isCityValid || !isEmailValid) {
      toast({ title: "Validation Error", description: "Please correct the highlighted errors.", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      let finalData = { ...formData };
      
      // Handle deferred image upload
      if (finalData.image_url instanceof File) {
        toast({ title: "Uploading...", description: "Uploading logo to Cloudflare R2", variant: "default" });
        const { publicUrl } = await uploadFile(finalData.image_url);
        finalData.image_url = publicUrl;
      }

      if (editingId) {
        await api.put(`/onboarding/clinics/${editingId}`, finalData);
        toast({ title: "Success", description: "Clinic updated successfully!", variant: "success", duration: 3000 });
      } else {
        await api.post("/onboarding/clinics", finalData);
        toast({ title: "Success", description: "Clinic added successfully!", variant: "success", duration: 3000 });
      }
      setIsModalOpen(false);
      fetchClinics();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to save clinic", variant: "error", duration: 4000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/onboarding/clinics/${deletingId}`);
      toast({ title: "Success", description: "Clinic deactivated successfully!", variant: "success", duration: 3000 });
      fetchClinics();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to delete clinic", variant: "error", duration: 4000 });
    } finally {
      setDeletingId(null);
    }
  };

  const formatTimings = (timingsStr: string | null | undefined): string => {
    if (!timingsStr) return "Not specified";
    try {
      const data = JSON.parse(timingsStr);
      const days = Object.keys(data);
      if (days.length === 0) return timingsStr;
      
      for (const day of days) {
        if (data[day] && data[day].length > 0) {
          const firstSlot = data[day][0];
          return `Open ${firstSlot.start} - ${firstSlot.end} (${days.length} days/week)`;
        }
      }
      return "Not specified";
    } catch (e) {
      return timingsStr;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-surface-alt rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-surface-alt rounded animate-pulse" />
          </div>
          <div className="h-9 w-28 bg-surface-alt rounded-lg animate-pulse" />
        </div>
        <SkeletonTable rows={5} cols={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-text">Clinics Management</h2>
          <p className="text-xs sm:text-sm text-text-secondary">Configure the physical clinic locations owned by your organization.</p>
        </div>
      </div>

      <Table
        onAddClick={openModal}
        actionLabel="Add Clinic"
            searchable
            searchPlaceholder="Search clinics by name or city..."
            columns={[
              { key: "name", header: "Name", sortable: true },
              { key: "city", header: "City", sortable: true },
              { 
                key: "phone", 
                header: "Phone",
                render: (row: Clinic) => <span className="whitespace-nowrap">{row.phone || "-"}</span>
              },
              { 
                key: "email", 
                header: "Email",
                render: (row: Clinic) => (
                  <span className="truncate max-w-[150px] inline-block" title={row.email}>
                    {row.email || "-"}
                  </span>
                )
              },
              { 
                key: "timings", 
                header: "Operating Hours",
                render: (row: Clinic) => <span>{formatTimings(row.timings)}</span>
              },
              {
                key: "facilities",
                header: "Facilities",
                render: (row: Clinic) => (
                  <div className="flex flex-wrap gap-1">
                    {row.facilities && row.facilities.map((fac, idx) => (
                      <span key={idx} className="bg-primary-50 text-primary-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        {fac}
                      </span>
                    ))}
                    {(!row.facilities || row.facilities.length === 0) && <span className="text-text-muted text-xs">-</span>}
                  </div>
                )
              },
              { 
                key: "actions", 
                header: "Actions",
                width: "110px",
                render: (row: Clinic) => (
                  <Dropdown
                    align="right"
                    trigger={
                      <Button size="xs" variant="outline" className="h-7 w-7 p-0 flex items-center justify-center rounded-lg cursor-pointer" title="Row Actions">
                        <svg className="h-4 w-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                      </Button>
                    }
                    items={[
                      { label: "QR Code", onClick: () => setQrClinic(row) },
                      { label: "Edit Clinic", onClick: () => openEditModal(row) },
                      { label: "Delete Clinic", danger: true, onClick: () => setDeletingId(row.id) }
                    ]}
                  />
                )
              }
            ]}
            data={clinics}
            emptyMessage="No clinics added yet."
          />

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editingId ? "Edit" : "Add New"} Clinic`}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input 
            label="Clinic Name *" 
            value={formData.name || ""} 
            onChange={(e) => handleFieldChange("name", e.target.value)} 
            onBlur={() => validateClinicField("name", formData.name || "")}
            error={clinicErrors.name}
            required 
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="City *" 
              value={formData.city || ""} 
              onChange={(e) => handleFieldChange("city", e.target.value)} 
              onBlur={() => validateClinicField("city", formData.city || "")}
              error={clinicErrors.city}
              required 
            />
            <Input 
              label="Full Address" 
              value={formData.address || ""} 
              onChange={(e) => handleFieldChange("address", e.target.value)} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Phone Number" 
              value={formData.phone || ""} 
              onChange={(e) => handleFieldChange("phone", e.target.value)} 
            />
            <Input 
              label="Email Address" 
              type="email" 
              value={formData.email || ""} 
              onChange={(e) => handleFieldChange("email", e.target.value)} 
              onBlur={() => validateClinicField("email", formData.email || "")}
              error={clinicErrors.email}
            />
          </div>

          <ScheduleEditor 
            label="Operating Hours & Days" 
            value={formData.timings || ""} 
            onChange={(val) => setFormData({ ...formData, timings: val })} 
          />

          <ImageUpload 
            label="Clinic Logo / Image" 
            value={formData.image_url || null} 
            onChange={(val) => setFormData({ ...formData, image_url: val })} 
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-text block">Facilities Available</label>
            <div className="flex flex-wrap gap-6 pt-1">
              {["Pharmacy", "Laboratory", "Parking", "Emergency Care", "Vaccination Center"].map((fac) => (
                <Checkbox 
                  key={fac}
                  label={fac}
                  checked={formData.facilities?.includes(fac) || false}
                  onChange={(e) => handleFacilityChange(fac, e.target.checked)}
                />
              ))}
            </div>
          </div>

          <Input 
            label="Clinic Description / About" 
            placeholder="Short overview..." 
            value={formData.description || ""} 
            onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={submitting}>Save</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Deactivate Clinic?"
        description="Are you sure you want to deactivate this clinic location? Staff linked to this clinic will remain registered but their location link will need to be updated."
        variant="danger"
        confirmLabel="Deactivate"
      />

      <Modal
        open={!!qrClinic}
        onClose={() => setQrClinic(null)}
        title="Clinic Reception QR Code"
        size="md"
      >
        {qrClinic && (
          <div className="space-y-6 text-center">
            <p className="text-sm text-text-secondary">
              Display this QR card at the reception desk. Patients can scan to book online appointments instantly on their mobile devices.
            </p>
            
            {/* Printable QR Card Frame */}
            <div id="printable-qr-card" className="border border-border rounded-2xl p-6 bg-white max-w-sm mx-auto shadow-md text-slate-800 animate-fade-in print:border-none print:shadow-none">
              <div className="text-center space-y-2 mb-4">
                <span className="text-xs font-bold tracking-widest text-primary-600 uppercase">HealthOS Portal</span>
                <h3 className="text-xl font-extrabold text-slate-900">{qrClinic.name}</h3>
                <p className="text-xs text-slate-500 font-medium">{qrClinic.city}</p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 flex justify-center items-center my-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    `${typeof window !== "undefined" ? window.location.origin : ""}/browse/${qrClinic.id}`
                  )}`}
                  alt={`${qrClinic.name} Booking QR`}
                  className="w-48 h-48 bg-white border border-slate-200 p-2 shadow-sm rounded-lg"
                />
              </div>

              <div className="text-center space-y-1 mt-4">
                <p className="text-sm font-bold text-slate-900">SCAN TO BOOK</p>
                <p className="text-[10px] text-slate-500 font-semibold">Instantly check queues & schedule slots</p>
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-4 border-t border-border mt-6">
              <Button variant="outline" type="button" onClick={() => setQrClinic(null)}>Close</Button>
              <Button type="button" onClick={() => {
                const printContent = document.getElementById("printable-qr-card")?.innerHTML;
                if (printContent) {
                  const printWindow = window.open("", "_blank");
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Print QR Card - ${qrClinic.name}</title>
                          <style>
                            body {
                              margin: 0;
                              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                              display: flex;
                              justify-content: center;
                              align-items: center;
                              min-height: 100vh;
                              background-color: white;
                            }
                            .card {
                              border: 2px solid #e2e8f0;
                              border-radius: 1rem;
                              padding: 2rem;
                              max-width: 320px;
                              text-align: center;
                              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                            }
                            .brand {
                              font-size: 0.75rem;
                              font-weight: 700;
                              text-transform: uppercase;
                              letter-spacing: 0.1em;
                              color: #2563eb;
                            }
                            .title {
                              font-size: 1.25rem;
                              font-weight: 800;
                              margin: 0.5rem 0 0.25rem;
                              color: #0f172a;
                            }
                            .subtitle {
                              font-size: 0.75rem;
                              color: #64748b;
                              margin: 0;
                              font-weight: 500;
                            }
                            .qr-container {
                              background-color: #f8fafc;
                              border: 1px solid #f1f5f9;
                              border-radius: 0.75rem;
                              padding: 1.5rem;
                              margin: 1rem 0;
                              display: flex;
                              justify-content: center;
                            }
                            img {
                              width: 200px;
                              height: 200px;
                              background: white;
                              border: 1px solid #e2e8f0;
                              padding: 0.5rem;
                              border-radius: 0.5rem;
                            }
                            .action {
                              font-size: 0.875rem;
                              font-weight: 700;
                              color: #0f172a;
                              margin: 1rem 0 0.25rem;
                            }
                            .instruction {
                              font-size: 0.625rem;
                              color: #64748b;
                              margin: 0;
                              font-weight: 600;
                            }
                          </style>
                        </head>
                        <body>
                          <div class="card">
                            <span class="brand">HealthOS Portal</span>
                            <h3 class="title">${qrClinic.name}</h3>
                            <p class="subtitle">${qrClinic.city}</p>
                            <div class="qr-container">
                              <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                                `${window.location.origin}/browse/${qrClinic.id}`
                              )}" />
                            </div>
                            <p class="action">SCAN TO BOOK</p>
                            <p class="instruction">Instantly check queues & schedule slots</p>
                          </div>
                          <script>
                            window.onload = function() {
                              window.print();
                              setTimeout(function() { window.close(); }, 500);
                            };
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }
                }
              }}>
                Print QR Card
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
