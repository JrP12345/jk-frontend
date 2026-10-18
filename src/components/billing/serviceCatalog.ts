import api from "@/lib/api";

export const serviceCategories = [
  { value: "consultation", label: "Consultation" },
  { value: "procedure", label: "Procedure" },
  { value: "lab_test", label: "Lab test" },
  { value: "radiology", label: "Radiology" },
  { value: "bed_charge", label: "Bed charge" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "nursing", label: "Nursing" },
  { value: "other", label: "Other" },
];

export interface ServiceItem {
  _id?: string;
  id?: string;
  code: string;
  name: string;
  department: string;
  category: string;
  price: number;
  hsnSacCode?: string;
  gstRate: number;
  isActive: boolean;
  description?: string;
}

export interface ServiceForm {
  code: string; name: string; department: string; category: string;
  price: string; hsnSacCode: string; gstRate: string; description: string; isActive: boolean;
}

export const emptyServiceForm = (): ServiceForm => ({
  code: "", name: "", department: "General Medicine", category: "consultation",
  price: "", hsnSacCode: "999312", gstRate: "0", description: "", isActive: true,
});

/** Fetch all API pages before exposing totals or treating the catalog as empty. */
export async function readServiceCatalog(signal: AbortSignal): Promise<ServiceItem[]> {
  const rows: ServiceItem[] = [];
  let pages = 1;
  for (let page = 1; page <= pages; page++) {
    const response = await api.get(`/service-catalog?page=${page}&limit=100`, { signal });
    if (signal.aborted) throw new Error("Catalog read cancelled");
    if (!Array.isArray(response.data?.data)) throw new Error("Invalid service catalog response");
    if (page === 1) {
      const totalPages = Number(response.headers?.["x-total-pages"] ?? 1);
      if (!Number.isSafeInteger(totalPages) || totalPages < 0) throw new Error("Invalid catalog pagination");
      pages = Math.max(1, totalPages);
    }
    rows.push(...response.data.data);
  }
  return rows;
}

export function validateServiceForm(form: ServiceForm): { tab: "service" | "pricing"; message: string } | null {
  if (!form.code.trim() || !form.name.trim() || !form.department.trim()) {
    return { tab: "service", message: "Enter a service code, name and department." };
  }
  if (!serviceCategories.some(category => category.value === form.category)) {
    return { tab: "service", message: "Choose a service category." };
  }
  const price = Number(form.price);
  if (!form.price.trim() || !Number.isFinite(price) || price < 0 || !Number.isSafeInteger(Math.round(price * 100)) || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) {
    return { tab: "pricing", message: "Enter a non-negative price with up to two decimal places." };
  }
  const tax = Number(form.gstRate);
  if (!form.gstRate.trim() || !Number.isFinite(tax) || tax < 0 || tax > 28) {
    return { tab: "pricing", message: "GST must be between 0% and 28%." };
  }
  return null;
}
