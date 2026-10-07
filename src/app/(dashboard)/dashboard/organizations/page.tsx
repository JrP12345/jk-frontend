"use client";
import { Suspense } from "react";
import OrganizationManagement from "@/components/organization/OrganizationManagement";
import { LoadingState } from "@/components/ui";
export default function OrganizationsPage() { return <Suspense fallback={<LoadingState label="Loading organizations" />}><OrganizationManagement /></Suspense>; }
