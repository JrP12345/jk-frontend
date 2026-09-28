const categoryLabels: Record<string, string> = {
  auth: "Account activity",
  organization: "Organization",
  team: "Team",
  task: "Tasks",
  patient: "Patient care",
  billing: "Billing",
  security: "Security",
  system: "System",
};

export function notificationCategoryLabel(category: string): string {
  const key = category.toLowerCase();
  return categoryLabels[key] ?? category.replace(/[_-]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}
