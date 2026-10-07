type PublicProvider = { id: string; slug?: string };

export function locationPath(location: PublicProvider) {
  return location.slug ? `/browse/${encodeURIComponent(location.slug)}` : "/browse";
}

export function doctorPath(doctor: PublicProvider, location: PublicProvider) {
  if (!doctor.slug || !location.slug) return "/browse";
  const query = `location=${encodeURIComponent(location.slug)}`;
  return `/doctor/${encodeURIComponent(doctor.slug)}?${query}`;
}

export function hasMultipleLocations(location: { organizationLocationCount?: number }) {
  return (location.organizationLocationCount || 1) > 1;
}
