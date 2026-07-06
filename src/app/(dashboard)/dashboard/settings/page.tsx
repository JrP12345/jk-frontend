"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Input, useToast, Spinner, ImageUpload, ScheduleEditor
} from "@/components/ui";
import { useR2Upload } from "@/lib/useR2Upload";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/;

export default function SettingsPage() {
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { uploadFile } = useR2Upload();

  const validateField = (field: string, value: string) => {
    let error = "";
    if (field === "name" && !value.trim()) {
      error = "Organization Name is required";
    } else if (field === "city" && !value.trim()) {
      error = "City is required";
    } else if (field === "email" && value.trim() && !EMAIL_REGEX.test(value)) {
      error = "Please enter a valid email address";
    } else if (field === "phone" && value.trim() && !PHONE_REGEX.test(value)) {
      error = "Please enter a valid phone number";
    }

    setErrors((prev) => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = "Organization Name is required";
    if (!formData.city?.trim()) newErrors.city = "City is required";
    if (formData.email?.trim() && !EMAIL_REGEX.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (formData.phone?.trim() && !PHONE_REGEX.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/onboarding/organization/me");
      setFormData(res.data.data);
      setErrors({});
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to load settings", variant: "error", duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast({ title: "Validation Error", description: "Please resolve the form validation errors.", variant: "warning", duration: 3000 });
      return;
    }
    setSaving(true);
    try {
      let finalData = { ...formData };
      
      // Handle deferred image upload
      if (finalData.image_url instanceof File) {
        toast({ title: "Uploading...", description: "Uploading organization image to Cloudflare R2", variant: "default" });
        const { publicUrl } = await uploadFile(finalData.image_url);
        finalData.image_url = publicUrl;
      }

      await api.put("/onboarding/organization/me", finalData);
      toast({ title: "Success", description: "Organization settings updated successfully!", variant: "success", duration: 3000 });
      fetchSettings(); // Refresh data
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to update settings", variant: "error", duration: 4000 });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" label="Loading settings..." />
      </div>
    );
  }

  if (!formData) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Organization Settings</h1>
        <p className="text-text-muted mt-1">Update your hospital or clinic details.</p>
      </div>

      <Card>
        <form onSubmit={handleSave}>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>This information will be displayed publicly to patients.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <ImageUpload 
              label="Organization Logo / Image" 
              value={formData.image_url || null} 
              onChange={(val) => setFormData({ ...formData, image_url: val })} 
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input 
                  label="Organization Name *" 
                  required 
                  value={formData.name || ""} 
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    validateField("name", e.target.value);
                  }} 
                  onBlur={(e) => validateField("name", e.target.value)}
                  error={errors.name}
                />
                {errors.name && <p className="text-red-500 text-xs mt-0.5">{errors.name}</p>}
              </div>
              <div>
                <Input 
                  label="City *" 
                  required 
                  value={formData.city || ""} 
                  onChange={(e) => {
                    setFormData({ ...formData, city: e.target.value });
                    validateField("city", e.target.value);
                  }} 
                  onBlur={(e) => validateField("city", e.target.value)}
                  error={errors.city}
                />
                {errors.city && <p className="text-red-500 text-xs mt-0.5">{errors.city}</p>}
              </div>
              <div>
                <Input 
                  label="Email" 
                  type="email" 
                  value={formData.email || ""} 
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    validateField("email", e.target.value);
                  }} 
                  onBlur={(e) => validateField("email", e.target.value)}
                  error={errors.email}
                />
                {errors.email && <p className="text-red-500 text-xs mt-0.5">{errors.email}</p>}
              </div>
              <div>
                <Input 
                  label="Phone Number" 
                  value={formData.phone || ""} 
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    validateField("phone", e.target.value);
                  }} 
                  onBlur={(e) => validateField("phone", e.target.value)}
                  error={errors.phone}
                />
                {errors.phone && <p className="text-red-500 text-xs mt-0.5">{errors.phone}</p>}
              </div>
            </div>

            <Input 
              label="Full Address" 
              value={formData.address || ""} 
              onChange={(e) => setFormData({ ...formData, address: e.target.value })} 
            />

            <Input 
              label="Description / About" 
              value={formData.description || ""} 
              onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
            />

            <ScheduleEditor 
              label="Operating Hours & Days" 
              value={formData.timings || ""} 
              onChange={(val) => setFormData({ ...formData, timings: val })} 
            />

          </CardContent>
          <div className="p-6 pt-0 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner size="sm" /> : "Save Changes"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
