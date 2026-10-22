export const pharmacyEntryPermissions = ["PHARMACY_TRANSFER", "PHARMACY_VIEW_STOCK", "PHARMACY_VIEW_RX_QUEUE", "PHARMACY_MANAGE_SETTINGS", "PHARMACY_PURCHASE", "PHARMACY_SELL", "PHARMACY_COLLECT_PAYMENT", "PHARMACY_RETURN", "PHARMACY_APPROVE_REFUND", "PHARMACY_CLOSE_TILL", "PHARMACY_VIEW_REPORTS", "MANAGE_ORGANIZATION", "MANAGE_MEDICINES", "VIEW_EHR"];
export const pharmacyActions = ["viewStock", "viewCost", "manageCatalog", "receiveStock", "adjustStock", "viewRxQueue", "dispense", "recoverDispense", "readRegister", "exportRegister", "readMovements", "manageSettings"] as const;
export type PharmacyAction = typeof pharmacyActions[number];
export interface PharmacyCapabilities {
  importKinds?: Array<"catalogue" | "opening_stock" | "customer_dues" | "supplier_dues">;
  locationId: string;
  enabled: boolean;
  moduleEnabled: boolean;
  mode: "configured" | "legacy_included";
  revision: number;
  commercialEntitlement?: "active" | "unavailable" | "plan_included";
  actions: Record<PharmacyAction, boolean> & { viewPurchases?: boolean; managePurchases?: boolean; viewSales?: boolean; sell?: boolean; collect?: boolean; viewReturns?: boolean; processReturn?: boolean; approveReturn?: boolean; settle?: boolean; viewSettlements?: boolean; openingBalances?: boolean; viewTill?: boolean; openTill?: boolean; closeTill?: boolean; moveTillCash?: boolean; viewReports?: boolean; transferStock?: boolean };
}
export function parsePharmacyCapabilities(value: unknown, locationId: string): PharmacyCapabilities {
  const result = value as PharmacyCapabilities | null;
  if (!result || result.locationId !== locationId || typeof result.enabled !== "boolean" || typeof result.moduleEnabled !== "boolean" ||
      !Number.isSafeInteger(result.revision) || result.revision < 0 || !["configured", "legacy_included"].includes(result.mode) ||
      !result.actions || pharmacyActions.some(action => typeof result.actions[action] !== "boolean")) throw new Error("Pharmacy access response is incomplete");
  if ([result.actions.transferStock, result.actions.viewPurchases, result.actions.managePurchases, result.actions.viewSales, result.actions.sell, result.actions.collect, result.actions.viewReturns, result.actions.processReturn, result.actions.approveReturn, result.actions.settle, result.actions.viewSettlements, result.actions.openingBalances, result.actions.viewTill, result.actions.openTill, result.actions.closeTill, result.actions.moveTillCash, result.actions.viewReports].some(value => value !== undefined && typeof value !== "boolean")) throw new Error("Pharmacy action response is incomplete");
  if (result.commercialEntitlement !== undefined && !["active", "unavailable", "plan_included"].includes(result.commercialEntitlement)) throw new Error("Pharmacy product response is incomplete");
  if (result.importKinds !== undefined && (!Array.isArray(result.importKinds) || result.importKinds.some(kind => !["catalogue", "opening_stock", "customer_dues", "supplier_dues"].includes(kind)) || new Set(result.importKinds).size !== result.importKinds.length)) throw new Error("Pharmacy import response is incomplete");
  return result;
}
