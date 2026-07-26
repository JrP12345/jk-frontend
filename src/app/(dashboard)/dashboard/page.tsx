"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatCard,
  Badge,
  Table,
  Button,
  Dropdown,
  useToast,
  SkeletonCard,
} from "@/components/ui";

export default function DashboardOverview() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();

  const [adminStats, setAdminStats] = useState({
    clinics: 0,
    doctors: 0,
    receptionists: 0,
    appointments: 0,
    collections: 0,
    outstanding: 0,
  });
  const [doctorStats, setDoctorStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [patientStats, setPatientStats] = useState({ appointmentsCount: 0, unpaidBills: 0 });

  const [appointments, setAppointments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clinicsList, setClinicsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Update appointment status inline
  const handleUpdateStatus = async (apptId: string, status: string) => {
    try {
      await api.put(`/appointments/${apptId}/status`, { status });
      toast({
        title: "Status Updated",
        description: `Appointment status updated to ${status.replace("-", " ")}.`,
        variant: "success",
      });
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update appointment status.",
        variant: "error",
      });
    }
  };

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      if (user.role === "admin" || user.role === "root" || user.role === "receptionist") {
        const [clinicsRes, staffRes, apptsRes, invoicesRes] = await Promise.allSettled([
          api.get("/onboarding/clinics"),
          api.get("/onboarding/staff"),
          api.get("/appointments"),
          api.get("/invoices"),
        ]);

        const clList = clinicsRes.status === "fulfilled" ? clinicsRes.value.data.data || [] : [];
        const staffData = staffRes.status === "fulfilled" ? staffRes.value.data.data || {} : {};
        const docList = staffData.doctors || [];
        const recList = staffData.receptionists || [];
        const apptList = apptsRes.status === "fulfilled" ? apptsRes.value.data.data || [] : [];
        const invList = invoicesRes.status === "fulfilled" ? invoicesRes.value.data.data || [] : [];

        setClinicsList(clList);

        const todayStr = new Date().toISOString().split("T")[0];
        const todaysPaid = invList.reduce((acc: number, curr: any) => {
          if (curr.status !== "paid") return acc;
          const dateStr = (curr.paymentDate || curr.createdAt || "").split("T")[0];
          return dateStr === todayStr ? acc + curr.totalAmount : acc;
        }, 0);

        const unpaid = invList.reduce((acc: number, curr: any) => {
          return curr.status === "unpaid" ? acc + curr.totalAmount : acc;
        }, 0);

        setAdminStats({
          clinics: clList.length,
          doctors: docList.length,
          receptionists: recList.length,
          appointments: apptList.length,
          collections: todaysPaid,
          outstanding: unpaid,
        });

        setAppointments(apptList);
        setInvoices(invList);
      } else if (user.role === "doctor") {
        const [apptsRes] = await Promise.allSettled([api.get("/appointments")]);
        const apptList = apptsRes.status === "fulfilled" ? apptsRes.value.data.data || [] : [];

        const total = apptList.length;
        const completed = apptList.filter((a: any) => a.status === "completed").length;
        const pending = apptList.filter((a: any) => a.status !== "completed" && a.status !== "cancelled").length;

        setDoctorStats({ total, completed, pending });
        setAppointments(apptList);
      } else if (user.role === "patient") {
        const [apptsRes, invoicesRes] = await Promise.allSettled([api.get("/appointments"), api.get("/invoices")]);
        const apptList = apptsRes.status === "fulfilled" ? apptsRes.value.data.data || [] : [];
        const invList = invoicesRes.status === "fulfilled" ? invoicesRes.value.data.data || [] : [];

        const unpaidCount = invList.filter((i: any) => i.status === "unpaid").reduce((acc: number, c: any) => acc + c.totalAmount, 0);

        setPatientStats({
          appointmentsCount: apptList.filter((a: any) => a.status !== "cancelled").length,
          unpaidBills: unpaidCount,
        });
        setAppointments(apptList);
        setInvoices(invList.filter((i: any) => i.status === "unpaid"));
      }
    } catch (err) {
      console.error("Failed to load dashboard statistics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user?.id, user?.role]);

  const recommendedFollowUps = appointments.filter((appt) => {
    if (appt.status !== "completed" || !appt.followUpRecommended) return false;
    const isAlreadyBooked = appointments.some(
      (a) => a.followUpForAppointmentId === appt.id && a.status !== "cancelled"
    );
    return !isAlreadyBooked;
  });

  if (!user) return null;

  // Clean user display name (strip trailing role string if duplicated)
  const cleanUserName = user.name.replace(/\s*\([^)]*\)/g, "");

  return (
    <div className="space-y-5 font-sans text-text antialiased animate-fade-up">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. CLEAN HEADER (NO DUPLICATE ROLE TEXTS)
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight">
              Welcome back, {cleanUserName}
            </h1>
            <Badge variant="primary" className="capitalize text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
              {user.role === "root" ? "Root Super-Admin" : user.role === "admin" ? "Org Admin" : user.role}
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-1">
            {user.role === "root" || user.role === "admin"
              ? "Real-time clinical operations and multi-center financial performance."
              : user.role === "doctor"
              ? "Your active consultation queue and daily schedule."
              : "Your upcoming medical visits and billing invoices."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            className="rounded-xl text-xs font-semibold cursor-pointer"
          >
            🔄 Refresh
          </Button>
          {(user.role === "admin" || user.role === "root") && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push("/dashboard/appointments")}
              className="rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              + New Booking
            </Button>
          )}
        </div>
      </div>

      {/* PATIENT MEDICAL FOLLOW-UP ALERTS */}
      {user.role === "patient" && recommendedFollowUps.length > 0 && (
        <div className="space-y-4">
          {recommendedFollowUps.map((appt) => (
            <div
              key={appt.id}
              className="relative overflow-hidden rounded-2xl border border-warning-500/30 bg-gradient-to-r from-warning-500/10 via-surface to-primary-500/10 p-4 sm:p-5 shadow-sm"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="warning" className="text-[10px] font-bold uppercase tracking-wider">
                      ⚠️ Medical Recommendation
                    </Badge>
                    <span className="text-xs text-text-muted">Within {appt.followUpTimeline || "2 weeks"}</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-text">
                    Follow-Up Consultation with Dr. {appt.doctorId?.name || "Specialist"}
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Recommended at <strong className="text-text">{appt.clinicId?.name}</strong> following your visit on{" "}
                    {new Date(appt.appointmentTime).toLocaleDateString(undefined, { dateStyle: "medium" })}.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const clinicId = appt.clinicId?.id || appt.clinicId;
                    const doctorId = appt.doctorId?.id || appt.doctorId;
                    router.push(`/browse/${clinicId}?doctorId=${doctorId}&followUp=true&prevAppointmentId=${appt.id}`);
                  }}
                  className="rounded-xl font-bold text-xs shrink-0 cursor-pointer"
                >
                  Schedule Follow-Up Now →
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          2. METRICS CARDS (2-COLUMN GRID ON MOBILE: grid-cols-2 lg:grid-cols-4)
         ────────────────────────────────────────────────────────────────────────── */}
      {(user.role === "admin" || user.role === "root" || user.role === "receptionist") && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <StatCard
                label="Today's Collections"
                value={`₹${adminStats.collections.toLocaleString()}`}
                icon={
                  <svg className="h-4 sm:h-5 w-4 sm:w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <StatCard
                label="Outstanding Balances"
                value={`₹${adminStats.outstanding.toLocaleString()}`}
                icon={
                  <svg className="h-4 sm:h-5 w-4 sm:w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                }
              />
              <StatCard
                label="Active Clinics"
                value={adminStats.clinics.toString()}
                icon={
                  <svg className="h-4 sm:h-5 w-4 sm:w-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
              />
              <StatCard
                label="Active Doctors"
                value={adminStats.doctors.toString()}
                icon={
                  <svg className="h-4 sm:h-5 w-4 sm:w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              />
            </>
          )}
        </div>
      )}

      {/* DOCTOR CLINICAL METRICS (2-COLUMN ON MOBILE) */}
      {user.role === "doctor" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            label="Total Consultations"
            value={doctorStats.total.toString()}
            icon={
              <svg className="h-4 sm:h-5 w-4 sm:w-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <StatCard
            label="Pending Queue"
            value={doctorStats.pending.toString()}
            icon={
              <svg className="h-4 sm:h-5 w-4 sm:w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Completed Visits"
            value={doctorStats.completed.toString()}
            icon={
              <svg className="h-4 sm:h-5 w-4 sm:w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
      )}

      {/* PATIENT CARE METRICS (2-COLUMN ON MOBILE) */}
      {user.role === "patient" && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard
            label="Scheduled Visits"
            value={patientStats.appointmentsCount.toString()}
            icon={
              <svg className="h-4 sm:h-5 w-4 sm:w-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatCard
            label="Unpaid Bills"
            value={`₹${patientStats.unpaidBills.toLocaleString()}`}
            icon={
              <svg className="h-4 sm:h-5 w-4 sm:w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          3. MAIN SECTION GRID (QUEUE TABLE + QUICK OPERATIONS)
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Columns: Live Appointments Queue Table */}
        <Card className="lg:col-span-2 rounded-2xl border border-border bg-surface">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm sm:text-base font-bold">
              {user.role === "admin" || user.role === "root"
                ? "Live Appointments Queue"
                : user.role === "doctor"
                ? "Today's Patient Roster"
                : "My Scheduled Appointments"}
            </CardTitle>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => router.push("/dashboard/appointments")}
              className="text-xs font-semibold text-primary-600 hover:underline cursor-pointer"
            >
              View All →
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-text-muted">
                <div className="w-10 h-10 rounded-2xl bg-surface-alt flex items-center justify-center mb-2 border border-border/60">
                  <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="font-bold text-text text-xs">No Active Bookings</p>
                <p className="text-[11px] text-text-muted mt-0.5">There are no matching appointments in system records currently.</p>
              </div>
            ) : (
              <Table
                loading={loading}
                columns={
                  user.role === "doctor"
                    ? [
                        {
                          key: "tokenNumber",
                          header: "Token",
                          width: "75px",
                          render: (row: any) => <span className="font-bold text-primary-600">#{row.tokenNumber}</span>,
                        },
                        {
                          key: "patient",
                          header: "Patient Name",
                          render: (row: any) => <span className="font-bold text-text">{row.patientId?.userId?.name || "Patient Profile"}</span>,
                        },
                        {
                          key: "time",
                          header: "Time Slot",
                          render: (row: any) => (
                            <span className="whitespace-nowrap text-xs text-text-secondary font-medium">
                              {new Date(row.appointmentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          ),
                        },
                        {
                          key: "status",
                          header: "Status",
                          render: (row: any) => (
                            <Badge
                              variant={
                                row.status === "completed"
                                  ? "success"
                                  : row.status === "in-consultation"
                                  ? "primary"
                                  : row.status === "cancelled"
                                  ? "danger"
                                  : "warning"
                              }
                              className="capitalize text-[10px] font-bold"
                            >
                              {row.status.replace("-", " ")}
                            </Badge>
                          ),
                        },
                        {
                          key: "actions",
                          header: "Actions",
                          width: "110px",
                          render: (row: any) => (
                            <Dropdown
                              align="right"
                              width="w-36"
                              trigger={<Button size="xs" variant="outline" className="text-xs font-semibold rounded-lg cursor-pointer">Modify ▾</Button>}
                              items={[
                                { label: "Check-In", onClick: () => handleUpdateStatus(row.id, "checked-in") },
                                { label: "In Consultation", onClick: () => handleUpdateStatus(row.id, "in-consultation") },
                                { label: "Complete Visit", onClick: () => handleUpdateStatus(row.id, "completed") },
                                { divider: true, label: "" },
                                { label: "Cancel", onClick: () => handleUpdateStatus(row.id, "cancelled"), danger: true },
                              ]}
                            />
                          ),
                        },
                      ]
                    : [
                        {
                          key: "tokenNumber",
                          header: "Token",
                          width: "75px",
                          render: (row: any) => <span className="font-bold text-primary-600">#{row.tokenNumber}</span>,
                        },
                        {
                          key: "patient",
                          header: "Patient",
                          render: (row: any) => <span className="font-semibold text-text">{row.patientId?.userId?.name || "Self"}</span>,
                        },
                        {
                          key: "doctor",
                          header: "Doctor",
                          render: (row: any) => <span className="text-xs text-text-secondary">Dr. {row.doctorId?.name}</span>,
                        },
                        {
                          key: "time",
                          header: "Date & Time",
                          render: (row: any) => (
                            <span className="whitespace-nowrap text-xs text-text-secondary">
                              {new Date(row.appointmentTime).toLocaleDateString()}{" "}
                              {new Date(row.appointmentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          ),
                        },
                        {
                          key: "status",
                          header: "Status",
                          render: (row: any) => (
                            <Badge
                              variant={
                                row.status === "completed"
                                  ? "success"
                                  : row.status === "in-consultation"
                                  ? "primary"
                                  : row.status === "cancelled"
                                  ? "danger"
                                  : "warning"
                              }
                              className="capitalize text-[10px] font-bold"
                            >
                              {row.status.replace("-", " ")}
                            </Badge>
                          ),
                        },
                      ]
                }
                data={appointments.slice(0, 5)}
              />
            )}
          </CardContent>
        </Card>

        {/* Right Column: Role Quick Operations */}
        <Card className="rounded-2xl border border-border bg-surface">
          <CardHeader>
            <CardTitle className="text-sm sm:text-base font-bold">
              {user.role === "patient" ? "Unpaid Invoices" : "Quick Operations"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0">
            {user.role === "patient" ? (
              invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-text-muted">
                  <div className="w-10 h-10 rounded-2xl bg-surface-alt flex items-center justify-center mb-2 border border-border/60">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="font-bold text-text text-xs">All Bills Paid</p>
                  <p className="text-[11px] text-text-muted mt-0.5">Zero outstanding invoice balances.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {invoices.map((inv: any) => (
                    <div
                      key={inv.id}
                      className="flex justify-between items-center p-3 border border-border bg-surface-alt rounded-xl hover:border-primary-500/30 transition-all"
                    >
                      <div>
                        <p className="text-[11px] font-bold text-text-secondary">Invoice #{inv.invoiceNumber}</p>
                        <p className="text-sm font-black text-text mt-0.5">₹{inv.totalAmount}</p>
                      </div>
                      <Button size="xs" onClick={() => router.push("/dashboard/bills")} className="rounded-lg font-bold cursor-pointer">
                        Pay Secure
                      </Button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-2">
                {(user.role === "admin" || user.role === "root") && (
                  <>
                    {user.role === "root" && (
                      <button
                        onClick={() => router.push("/dashboard/organizations")}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group/btn text-left cursor-pointer"
                      >
                        <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors">
                          🏛️ All Platform Organizations
                        </span>
                        <svg className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => router.push("/dashboard/staff")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group/btn text-left cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors">
                        👥 Manage Staff
                      </span>
                      <svg className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => router.push("/dashboard/clinics")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group/btn text-left cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors">
                        🏥 Manage Clinics
                      </span>
                      <svg className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => router.push("/dashboard/audit")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group/btn text-left cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors">
                        📋 View Audit Logs
                      </span>
                      <svg className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
                {user.role === "receptionist" && (
                  <>
                    <button
                      onClick={() => router.push("/dashboard/queue")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group/btn text-left cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors">
                        🎫 Manage Queue Tokens
                      </span>
                      <svg className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => router.push("/dashboard/appointments")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group/btn text-left cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors">
                        📅 Book Appointment
                      </span>
                      <svg className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
                {user.role === "doctor" && (
                  <>
                    <button
                      onClick={() => router.push("/dashboard/queue")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group/btn text-left cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors">
                        🩺 Open Consultation Queue
                      </span>
                      <svg className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => router.push("/dashboard/patients")}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group/btn text-left cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-text group-hover/btn:text-primary-600 transition-colors">
                        🛡️ Search Patient EHR Records
                      </span>
                      <svg className="w-4 h-4 text-text-muted group-hover/btn:text-primary-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. CLINIC LOCATIONS OVERVIEW GRID (FOR ROOT & ADMINS)
         ────────────────────────────────────────────────────────────────────────── */}
      {(user.role === "admin" || user.role === "root") && clinicsList.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-text">Active Clinics Overview</h2>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => router.push("/dashboard/clinics")}
              className="text-xs font-semibold text-primary-600 hover:underline cursor-pointer"
            >
              Manage Clinics →
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clinicsList.map((cl) => (
              <Card
                key={cl.id}
                onClick={() => router.push("/dashboard/clinics")}
                className="group cursor-pointer hover:shadow-md hover:border-primary-500/40 transition-all duration-200 p-3.5 rounded-2xl border border-border bg-surface flex flex-col justify-between"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
                    <span className="text-base">🏥</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-text group-hover:text-primary-600 transition-colors truncate">
                      {cl.name}
                    </h3>
                    <p className="text-[11px] text-text-muted truncate">📍 {cl.city}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-text-secondary pt-2 border-t border-border/40">
                  <span className="truncate">{cl.address || "Main Branch"}</span>
                  <Badge variant="success" className="text-[9px] font-bold shrink-0 px-2 py-0.2">
                    Active
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
