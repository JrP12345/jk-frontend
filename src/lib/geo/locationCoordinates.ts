/** Accept the latitude, longitude pair copied from a location's map pin. */
export function parseLocationCoordinates(value: string): { latitude: number | null; longitude: number | null } | null {
  if (!value.trim()) return { latitude: null, longitude: null };
  const parts = value.split(",").map(part => part.trim());
  if (parts.length !== 2 || parts.some(part => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(part))) return null;
  const [latitude, longitude] = parts.map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}
