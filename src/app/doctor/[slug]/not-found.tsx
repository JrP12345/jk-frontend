import Link from "next/link";

export default function DoctorNotFound() {
  return <main className="mx-auto max-w-2xl px-4 py-24"><h1 className="text-2xl font-bold">Doctor profile unavailable</h1><p className="mt-3 text-text-secondary">This doctor or practice location may no longer be published. Browse available locations to find care.</p><Link href="/browse" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary-600 px-5 font-semibold text-white">Browse locations</Link></main>;
}
