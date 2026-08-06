"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  Badge,
  Button,
  Input,
  Select,
  Modal,
  useToast,
  SkeletonCard,
  EmptyState,
} from "@/components/ui";
import {
  Utensils,
  Apple,
  Flame,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  RefreshCw,
  ChefHat,
  Ban,
  ShieldAlert,
} from "lucide-react";

interface DietOrder {
  id: string;
  patientName: string;
  bedNumber: string;
  ward: string;
  dietType: "regular" | "diabetic_low_carb" | "renal_low_sodium" | "soft_bland" | "liquid_clear" | "high_protein" | "npo_nothing_by_mouth";
  caloricTarget: number;
  allergies: string[];
  specialInstructions?: string;
  mealTime: "breakfast" | "lunch" | "dinner" | "snack_morning" | "snack_evening";
  deliveryStatus: "ordered" | "preparing" | "dispatched" | "delivered" | "npo_held";
  intakePercentage: number;
  createdAt: string;
  deliveredAt?: string;
}

interface Metrics {
  totalOrders: number;
  preparingCount: number;
  deliveredCount: number;
  npoHeldCount: number;
  allergyCount: number;
}

export default function DietaryNutritionPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<DietOrder[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalOrders: 0,
    preparingCount: 0,
    deliveredCount: 0,
    npoHeldCount: 0,
    allergyCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWard, setSelectedWard] = useState("ALL");
  const [selectedDietType, setSelectedDietType] = useState("ALL");
  const [selectedMealTime, setSelectedMealTime] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    patientName: "",
    bedNumber: "",
    ward: "",
    dietType: "regular",
    caloricTarget: 2000,
    allergiesInput: "",
    specialInstructions: "",
    mealTime: "lunch",
  });

  useEffect(() => {
    fetchDietOrders();
  }, [selectedWard, selectedDietType, selectedMealTime, selectedStatus]);

  const fetchDietOrders = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedWard !== "ALL") queryParams.append("ward", selectedWard);
      if (selectedDietType !== "ALL") queryParams.append("dietType", selectedDietType);
      if (selectedMealTime !== "ALL") queryParams.append("mealTime", selectedMealTime);
      if (selectedStatus !== "ALL") queryParams.append("deliveryStatus", selectedStatus);

      const res = await api.get(`/dietary?${queryParams.toString()}`);

      if (res.data && res.data.success) {
        setOrders(res.data.data.orders || []);
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching dietary orders:", err);
      toast({
        title: "Error Loading Diet Orders",
        description: err.response?.data?.message || "Failed to fetch clinical diet orders",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const allergies = formData.allergiesInput
        ? formData.allergiesInput.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const res = await api.post("/dietary", {
        ...formData,
        allergies,
        caloricTarget: Number(formData.caloricTarget),
      });

      if (res.data && res.data.success) {
        toast({
          title: "Diet Order Prescribed",
          description: `Successfully ordered ${formData.dietType} diet for ${formData.patientName}`,
          variant: "success",
        });
        setIsOrderModalOpen(false);
        setFormData({
          patientName: "",
          bedNumber: "",
          ward: "",
          dietType: "regular",
          caloricTarget: 2000,
          allergiesInput: "",
          specialInstructions: "",
          mealTime: "lunch",
        });
        fetchDietOrders();
      }
    } catch (err: any) {
      console.error("Error creating diet order:", err);
      toast({
        title: "Order Failed",
        description: err.response?.data?.message || "Failed to create therapeutic diet order",
        variant: "error",
      });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await api.patch(`/dietary/${id}/status`, { deliveryStatus: newStatus });
      if (res.data && res.data.success) {
        toast({
          title: "Status Updated",
          description: `Diet order status changed to ${newStatus}`,
          variant: "success",
        });
        fetchDietOrders();
      }
    } catch (err: any) {
      console.error("Error updating diet delivery status:", err);
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update delivery status",
        variant: "error",
      });
    }
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.bedNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.ward.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDietBadge = (type: string) => {
    switch (type) {
      case "diabetic_low_carb":
        return <Badge variant="info">Diabetic Low-Carb</Badge>;
      case "renal_low_sodium":
        return <Badge variant="primary">Renal Low-Sodium</Badge>;
      case "npo_nothing_by_mouth":
        return <Badge variant="danger"><Ban className="w-3 h-3 mr-1 inline" /> NPO Fasting</Badge>;
      case "liquid_clear":
        return <Badge variant="neutral">Clear Liquid</Badge>;
      case "soft_bland":
        return <Badge variant="warning">Soft / Bland</Badge>;
      case "high_protein":
        return <Badge variant="success">High Protein</Badge>;
      default:
        return <Badge variant="neutral">Regular Diet</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "preparing":
        return <Badge variant="warning"><ChefHat className="w-3 h-3 mr-1 inline" /> Preparing</Badge>;
      case "dispatched":
        return <Badge variant="info"><Clock className="w-3 h-3 mr-1 inline" /> Dispatched</Badge>;
      case "delivered":
        return <Badge variant="success" dot><CheckCircle2 className="w-3 h-3 mr-1 inline" /> Delivered</Badge>;
      case "npo_held":
        return <Badge variant="danger"><Ban className="w-3 h-3 mr-1 inline" /> NPO Held</Badge>;
      default:
        return <Badge variant="neutral">Ordered</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Dietary & Nutrition Clinical Meal Portal
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Inpatient therapeutic diet ordering, allergen safety verification & kitchen delivery dispatch
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchDietOrders} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button variant="primary" onClick={() => setIsOrderModalOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Prescribe Diet Order
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Active Diet Orders"
          value={metrics.totalOrders}
          icon={<Apple className="w-5 h-5 text-success-500" />}
          description="Inpatients Prescribed"
        />
        <StatCard
          title="Kitchen Prep Queue"
          value={metrics.preparingCount}
          icon={<ChefHat className="w-5 h-5 text-warning-500" />}
          description="Meals In Preparation"
        />
        <StatCard
          title="Allergen Safety Alerts"
          value={metrics.allergyCount}
          icon={<ShieldAlert className="w-5 h-5 text-danger-500" />}
          description="Patients with Allergies"
        />
        <StatCard
          title="NPO Fasting Holds"
          value={metrics.npoHeldCount}
          icon={<Ban className="w-5 h-5 text-danger-400" />}
          description="Pre-Op Fasting"
        />
      </div>

      {/* Filters Bar */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search patient name, bed or ward..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <Select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              options={[
                { label: "All Wards", value: "ALL" },
                { label: "ICU Ward A", value: "ICU Ward A" },
                { label: "ICU Ward B", value: "ICU Ward B" },
                { label: "General Ward A", value: "General Ward A" },
                { label: "Surgical Ward", value: "Surgical Ward" },
              ]}
            />

            <Select
              value={selectedDietType}
              onChange={(e) => setSelectedDietType(e.target.value)}
              options={[
                { label: "All Diets", value: "ALL" },
                { label: "Regular Diet", value: "regular" },
                { label: "Diabetic Low-Carb", value: "diabetic_low_carb" },
                { label: "Renal Low-Sodium", value: "renal_low_sodium" },
                { label: "Soft / Bland", value: "soft_bland" },
                { label: "Clear Liquid", value: "liquid_clear" },
                { label: "High Protein", value: "high_protein" },
                { label: "NPO Fasting", value: "npo_nothing_by_mouth" },
              ]}
            />

            <Select
              value={selectedMealTime}
              onChange={(e) => setSelectedMealTime(e.target.value)}
              options={[
                { label: "All Meal Slots", value: "ALL" },
                { label: "Breakfast", value: "breakfast" },
                { label: "Lunch", value: "lunch" },
                { label: "Dinner", value: "dinner" },
                { label: "Morning Snack", value: "snack_morning" },
                { label: "Evening Snack", value: "snack_evening" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Diet Orders Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-alt text-xs uppercase text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4">Inpatient & Bed</th>
                <th className="px-6 py-4">Prescribed Diet</th>
                <th className="px-6 py-4">Caloric Target</th>
                <th className="px-6 py-4">Allergen Safety</th>
                <th className="px-6 py-4">Meal Slot</th>
                <th className="px-6 py-4">Kitchen Dispatch Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                    Loading clinical meal orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12">
                    <EmptyState
                      icon={<Utensils className="w-8 h-8 text-text-muted" />}
                      title="No Diet Orders Found"
                      description="No active therapeutic diet orders match your selected filters."
                      action={
                        <Button variant="primary" size="sm" onClick={() => setIsOrderModalOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" /> Prescribe Diet Order
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 font-medium text-text">
                      <div className="font-semibold">{ord.patientName}</div>
                      <div className="text-xs text-primary-600 dark:text-primary-400 font-mono">
                        {ord.ward} • {ord.bedNumber}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {getDietBadge(ord.dietType)}
                      {ord.specialInstructions && (
                        <div className="text-xs text-text-muted mt-1 max-w-xs truncate" title={ord.specialInstructions}>
                          {ord.specialInstructions}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-mono text-text flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-warning-500" /> {ord.caloricTarget} kcal/day
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {ord.allergies && ord.allergies.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {ord.allergies.map((all, idx) => (
                            <Badge key={idx} variant="danger" size="sm">
                              ⚠️ {all}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">No known food allergies</span>
                      )}
                    </td>

                    <td className="px-6 py-4 capitalize text-text font-medium">{ord.mealTime}</td>

                    <td className="px-6 py-4">{getStatusBadge(ord.deliveryStatus)}</td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {ord.deliveryStatus === "ordered" && (
                          <Button variant="warning" size="sm" onClick={() => handleUpdateStatus(ord.id, "preparing")}>
                            Prepare
                          </Button>
                        )}
                        {ord.deliveryStatus === "preparing" && (
                          <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(ord.id, "dispatched")}>
                            Dispatch
                          </Button>
                        )}
                        {ord.deliveryStatus === "dispatched" && (
                          <Button variant="success" size="sm" onClick={() => handleUpdateStatus(ord.id, "delivered")}>
                            Mark Delivered
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Prescribe Diet Modal */}
      <Modal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        title="Prescribe Therapeutic Diet Order"
        description="Configure therapeutic diet, caloric target and food allergy precautions for inpatient"
        size="lg"
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Inpatient Name *</label>
            <Input
              required
              placeholder="e.g. Patient Robert Vance"
              value={formData.patientName}
              onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Ward Location</label>
              <Select
                value={formData.ward}
                onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                options={[
                  { label: "General Ward A", value: "General Ward A" },
                  { label: "ICU Ward A", value: "ICU Ward A" },
                  { label: "ICU Ward B", value: "ICU Ward B" },
                  { label: "Surgical Ward", value: "Surgical Ward" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Bed Number</label>
              <Input
                value={formData.bedNumber}
                onChange={(e) => setFormData({ ...formData, bedNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Therapeutic Diet Type</label>
              <Select
                value={formData.dietType}
                onChange={(e) => setFormData({ ...formData, dietType: e.target.value as any })}
                options={[
                  { label: "Regular Diet", value: "regular" },
                  { label: "Diabetic Low-Carb", value: "diabetic_low_carb" },
                  { label: "Renal Low-Sodium", value: "renal_low_sodium" },
                  { label: "Soft / Bland", value: "soft_bland" },
                  { label: "Clear Liquid", value: "liquid_clear" },
                  { label: "High Protein", value: "high_protein" },
                  { label: "NPO (Pre-Op Fasting)", value: "npo_nothing_by_mouth" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Caloric Target (kcal/day)</label>
              <Input
                type="number"
                value={formData.caloricTarget}
                onChange={(e) => setFormData({ ...formData, caloricTarget: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Allergies (comma-separated)</label>
            <Input
              placeholder="e.g. Peanuts, Lactose, Gluten, Shellfish"
              value={formData.allergiesInput}
              onChange={(e) => setFormData({ ...formData, allergiesInput: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Special Instructions & Prep Notes</label>
            <Input
              placeholder="e.g. Sodium restriction < 2000mg, serve warm."
              value={formData.specialInstructions}
              onChange={(e) => setFormData({ ...formData, specialInstructions: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsOrderModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Diet Order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
