import type { User } from "@/store/authStore";

export const pharmacyEntryPermissions = ["PHARMACY_READ_PRESCRIPTION_FILES", "PHARMACY_MANAGE_RECORDS", "PHARMACY_VIEW_SALES", "PHARMACY_VIEW_PURCHASES", "PHARMACY_VIEW_FINANCE", "PHARMACY_MANAGE_CUSTOMERS", "PHARMACY_DISPENSE_RESTRICTED", "PHARMACY_TRANSFER", "PHARMACY_VIEW_STOCK", "PHARMACY_VIEW_RX_QUEUE", "PHARMACY_MANAGE_SETTINGS", "PHARMACY_PURCHASE", "PHARMACY_SELL", "PHARMACY_COLLECT_PAYMENT", "PHARMACY_RETURN", "PHARMACY_APPROVE_REFUND", "PHARMACY_CLOSE_TILL", "PHARMACY_MOVE_TILL_CASH", "PHARMACY_VIEW_REPORTS", "MANAGE_ORGANIZATION", "MANAGE_MEDICINES", "VIEW_EHR"];

/** Navigation preference only; API capabilities remain the authorization boundary. */
export function isCounterSalesUser(user: Pick<User, "role" | "permissions"> | null | undefined): boolean {
  const permissions = user?.permissions || [];
  const counterPermissions = ["PHARMACY_MANAGE_CUSTOMERS", "VIEW_LOCATIONS", "PHARMACY_SELL", "PHARMACY_COLLECT_PAYMENT", "PHARMACY_CLOSE_TILL"];
  return Boolean(user && !["root", "patient", "family_member", "guest"].includes(user.role) && permissions.includes("PHARMACY_SELL") && permissions.every(code => counterPermissions.includes(code)));
}
export const pharmacyActions = ["viewStock", "viewCost", "manageCatalog", "receiveStock", "adjustStock", "viewRxQueue", "dispense", "recoverDispense", "readRegister", "exportRegister", "readMovements", "manageSettings"] as const;
export type PharmacyAction = typeof pharmacyActions[number];
export interface PharmacyCapabilities {
  importKinds?: Array<"catalogue" | "opening_stock" | "customer_dues" | "supplier_dues">;
  locationId: string;
  organizationId?: string;
  enabled: boolean;
  moduleEnabled: boolean;
  mode: "configured" | "legacy_included";
  inventoryMode?: "tracked" | "billing_only";
  revision: number;
  commercialEntitlement?: "active" | "unavailable" | "plan_included";
  actions: Record<PharmacyAction, boolean> & { readFiles?: boolean; manageRecords?: boolean; manageCustomers?: boolean; externalDispense?: boolean; viewExternalPrescriptions?: boolean; viewPurchases?: boolean; managePurchases?: boolean; viewSales?: boolean; sell?: boolean; collect?: boolean; viewReturns?: boolean; processReturn?: boolean; approveReturn?: boolean; settle?: boolean; viewSettlements?: boolean; openingBalances?: boolean; viewTill?: boolean; openTill?: boolean; closeTill?: boolean; moveTillCash?: boolean; viewReports?: boolean; transferStock?: boolean };
}
export function parsePharmacyCapabilities(value: unknown, locationId: string): PharmacyCapabilities {
  const result = value as PharmacyCapabilities | null;
  if (result?.inventoryMode !== undefined && !["tracked", "billing_only"].includes(result.inventoryMode)) throw new Error("Pharmacy inventory mode is incomplete");
  if (!result || result.locationId !== locationId || typeof result.enabled !== "boolean" || typeof result.moduleEnabled !== "boolean" ||
      !Number.isSafeInteger(result.revision) || result.revision < 0 || !["configured", "legacy_included"].includes(result.mode) ||
      !result.actions || pharmacyActions.some(action => typeof result.actions[action] !== "boolean")) throw new Error("Pharmacy access response is incomplete");
  if ([result.actions.readFiles, result.actions.manageRecords, result.actions.manageCustomers, result.actions.externalDispense, result.actions.viewExternalPrescriptions, result.actions.transferStock, result.actions.viewPurchases, result.actions.managePurchases, result.actions.viewSales, result.actions.sell, result.actions.collect, result.actions.viewReturns, result.actions.processReturn, result.actions.approveReturn, result.actions.settle, result.actions.viewSettlements, result.actions.openingBalances, result.actions.viewTill, result.actions.openTill, result.actions.closeTill, result.actions.moveTillCash, result.actions.viewReports].some(value => value !== undefined && typeof value !== "boolean")) throw new Error("Pharmacy action response is incomplete");
  if (result.organizationId !== undefined && (typeof result.organizationId !== "string" || !result.organizationId)) throw new Error("Pharmacy organization response is incomplete");
  if (result.commercialEntitlement !== undefined && !["active", "unavailable", "plan_included"].includes(result.commercialEntitlement)) throw new Error("Pharmacy product response is incomplete");
  if (result.importKinds !== undefined && (!Array.isArray(result.importKinds) || result.importKinds.some(kind => !["catalogue", "opening_stock", "customer_dues", "supplier_dues"].includes(kind)) || new Set(result.importKinds).size !== result.importKinds.length)) throw new Error("Pharmacy import response is incomplete");
  return result;
}
