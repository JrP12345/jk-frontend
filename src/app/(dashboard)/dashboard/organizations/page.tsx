"use client";
import { Suspense } from "react";
import OrganizationManagement from "@/components/organization/OrganizationManagement";
import { Spinner } from "@/components/ui";
export default function OrganizationsPage() { return <Suspense fallback={<Spinner label="Loading organizations" />}><OrganizationManagement /></Suspense>; }
