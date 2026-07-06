"use client";

import { useAuthStore } from "@/store/authStore";
import { Card, CardHeader, CardTitle, CardContent, StatCard, Badge, Spinner, Table, Button, Dropdown, useToast } from "@/components/ui";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

export default function DashboardOverview() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [adminStats, setAdminStats] = useState({ clinics: 0, doctors: 0, receptionists: 0, appointments: 0, collections: 0, outstanding: 0 });
  const [doctorStats, setDoctorStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [patientStats, setPatientStats] = useState({ appointmentsCount: 0, unpaidBills: 0 });

  const [appointments, setAppointments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // For updating appt status in Doctor/Staff dashboard inline
  const handleUpdateStatus = async (apptId: string, status: string) => {
    try {
      await api.put(`/appointments/${apptId}/status`, { status });
      toast({ title: "Success", description: `Appointment updated to ${status}`, variant: "success" });
      fetchDashboardData();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to update status", variant: "error" });
    }
  };

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      if (user.role === "admin" || user.role === "receptionist") {
        const [clinicsRes, staffRes, apptsRes, invoicesRes] = await Promise.all([
          api.get("/onboarding/clinics"),
          api.get("/onboarding/staff"),
          api.get("/appointments"),
          api.get("/invoices")
        ]);

        const clList = clinicsRes.data.data || [];
        const docList = staffRes.data.data.doctors || [];
        const recList = staffRes.data.data.receptionists || [];
        const apptList = apptsRes.data.data || [];
        const invList = invoicesRes.data.data || [];

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
          outstanding: unpaid
        });
        setAppointments(apptList);
        setInvoices(invList);
      } else if (user.role === "doctor") {
        const res = await api.get("/appointments");
        const apptList = res.data.data || [];
        const doctorAppts = apptList.filter((a: any) => 
          (a.doctorId?.id || a.doctorId) === user.id || 
          (a.doctorId?.userId?.id || a.doctorId?.userId) === user.id
        );
        
        setDoctorStats({
          total: doctorAppts.length,
          completed: doctorAppts.filter((a: any) => a.status === "completed").length,
          pending: doctorAppts.filter((a: any) => ["pending", "confirmed", "checked-in", "in-consultation"].includes(a.status)).length
        });
        setAppointments(doctorAppts);
      } else if (user.role === "patient") {
        const [apptsRes, invoicesRes] = await Promise.all([
          api.get("/appointments"),
          api.get("/invoices")
        ]);
        const apptList = apptsRes.data.data || [];
        const invList = invoicesRes.data.data || [];

        setPatientStats({
          appointmentsCount: apptList.filter((a: any) => ["pending", "confirmed"].includes(a.status)).length,
          unpaidBills: invList.filter((i: any) => i.status === "unpaid").reduce((acc: number, curr: any) => acc + curr.totalAmount, 0)
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
  }, [user]);

  const recommendedFollowUps = appointments.filter((appt) => {
    if (appt.status !== "completed" || !appt.followUpRecommended) return false;
    const isAlreadyBooked = appointments.some(
      (a) => a.followUpForAppointmentId === appt.id && a.status !== "cancelled"
    );
    return !isAlreadyBooked;
  });

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text tracking-tight">Welcome back, {user.name}</h2>
          <p className="text-text-secondary mt-1">Here is what is happening in your workspace today.</p>
        </div>
        <Badge variant="primary" dot className="capitalize px-3 py-1 text-sm">{user.role}</Badge>
      </div>

      {user.role === "patient" && recommendedFollowUps.length > 0 && (
        <div className="space-y-4">
          {recommendedFollowUps.map((appt) => (
            <div
              key={appt.id}
              className="relative overflow-hidden rounded-2xl border border-warning-200 bg-gradient-to-r from-warning-50/50 to-primary-50/30 p-6 shadow-sm animate-fade-in dark:border-warning-900/30 dark:from-warning-950/20 dark:to-primary-950/10"
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-warning-400/10 blur-3xl pointer-events-none" />
              <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-primary-400/10 blur-3xl pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-100 px-3 py-1 text-xs font-bold text-warning-850 dark:bg-warning-950/60 dark:text-warning-300 border border-warning-200/50 dark:border-warning-900/40">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Medical Recommendation
                    </span>
                    <span className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-xs font-bold text-primary-850 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-200/50 dark:border-warning-900/40">
                      Within {appt.followUpTimeline}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-text">
                    Follow-Up Consultation with Dr. {appt.doctorId?.name}
                  </h3>

                  <p className="text-sm text-text-secondary">
                    Recommended at <strong className="text-text">{appt.clinicId?.name}</strong> ({appt.clinicId?.city}) following your visit on {new Date(appt.appointmentTime).toLocaleDateString(undefined, { dateStyle: "medium" })}.
                  </p>

                  {appt.followUpNotes && (
                    <div className="rounded-lg bg-surface border border-border/60 p-3.5 max-w-2xl">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-text-muted block mb-1">Doctor's Instructions</span>
                      <p className="text-sm italic text-text-secondary">
                        &ldquo;{appt.followUpNotes}&rdquo;
                      </p>
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  <button
                    onClick={() => {
                      const clinicId = appt.clinicId?.id || appt.clinicId;
                      const doctorId = appt.doctorId?.id || appt.doctorId;
                      router.push(`/browse/${clinicId}?doctorId=${doctorId}&followUp=true&prevAppointmentId=${appt.id}`);
                    }}
                    className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 active:scale-95 transition-all group"
                  >
                    Schedule Follow-up Now
                    <svg className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Admin / Receptionist KPI cards */}
          {(user.role === "admin" || user.role === "receptionist") && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                label="Today's Collections"
                value={`₹${adminStats.collections}`}
                icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-success-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <StatCard
                label="Outstanding Balances"
                value={`₹${adminStats.outstanding}`}
                icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-warning-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
              />
              <StatCard
                label="Active Clinic Locations"
                value={adminStats.clinics.toString()}
                icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-primary-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
              />
              <StatCard
                label="Total Practitioners"
                value={adminStats.doctors.toString()}
                icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-purple-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
              />
            </div>
          )}

          {/* Doctor KPI cards */}
          {user.role === "doctor" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                label="Today's Total Consultations"
                value={doctorStats.total.toString()}
                icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-primary-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
              />
              <StatCard
                label="Pending Queue Patients"
                value={doctorStats.pending.toString()}
                icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-warning-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <StatCard
                label="Completed Consultations"
                value={doctorStats.completed.toString()}
                icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-success-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
            </div>
          )}

          {/* Patient KPI cards */}
          {user.role === "patient" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                label="Upcoming Scheduled Visits"
                value={patientStats.appointmentsCount.toString()}
                icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-primary-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              />
              <StatCard
                label="Outstanding Medical Bills"
                value={`₹${patientStats.unpaidBills}`}
                icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-danger-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
            </div>
          )}

          {/* Detailed Lists Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {user.role === "admin" || user.role === "receptionist"
                    ? "Recent Appointment Bookings"
                    : user.role === "doctor"
                    ? "Today's Consultations Queue"
                    : "My Upcoming Appointments"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {appointments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted animate-fade-in">
                    <div className="w-10 h-10 rounded-xl bg-surface-alt flex items-center justify-center mb-3 border border-border/60">
                      <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <p className="font-semibold text-text text-sm">No scheduled bookings found</p>
                    <p className="text-xs text-text-muted mt-1">There are no matching appointments in the system records today.</p>
                  </div>
                ) : (
                  <Table
                    columns={
                      user.role === "doctor"
                        ? [
                            { key: "tokenNumber", header: "Token", width: "70px", render: (row: any) => <span className="font-bold text-primary-600">#{row.tokenNumber}</span> },
                            { key: "patient", header: "Patient", render: (row: any) => <span>{row.patientId?.userId?.name || "Patient Profile"}</span> },
                            { key: "time", header: "Time Slot", render: (row: any) => <span className="whitespace-nowrap font-medium">{new Date(row.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> },
                            { key: "status", header: "Status", render: (row: any) => <Badge variant={row.status === "completed" ? "success" : "warning"} className="capitalize">{row.status.replace("-", " ")}</Badge> },
                            {
                              key: "actions",
                              header: "Update Status",
                              width: "110px",
                              render: (row: any) => (
                                <Dropdown
                                  align="right"
                                  width="w-36"
                                  trigger={
                                    <Button size="xs" variant="outline">Modify ▾</Button>
                                  }
                                  items={[
                                    { label: "Check-In", onClick: () => handleUpdateStatus(row.id, "checked-in") },
                                    { label: "In Consultation", onClick: () => handleUpdateStatus(row.id, "in-consultation") },
                                    { label: "Complete", onClick: () => handleUpdateStatus(row.id, "completed") },
                                    { divider: true, label: "" },
                                    { label: "Cancel", onClick: () => handleUpdateStatus(row.id, "cancelled"), danger: true }
                                  ]}
                                />
                              )
                            }
                          ]
                        : [
                            { key: "tokenNumber", header: "Token", width: "70px", render: (row: any) => <span className="font-bold text-primary-600">#{row.tokenNumber}</span> },
                            { key: "patient", header: "Patient", render: (row: any) => <span>{row.patientId?.userId?.name || "Self"}</span> },
                            { key: "doctor", header: "Assigned Doctor", render: (row: any) => <span>Dr. {row.doctorId?.name}</span> },
                            { key: "time", header: "Date & Time", render: (row: any) => <span className="whitespace-nowrap">{new Date(row.appointmentTime).toLocaleDateString()} {new Date(row.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> },
                            { key: "status", header: "Status", render: (row: any) => <Badge variant={row.status === "completed" ? "success" : "warning"} className="capitalize">{row.status.replace("-", " ")}</Badge> }
                          ]
                    }
                    data={appointments.slice(0, 5)}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {user.role === "patient" ? "Outstanding Bills" : "Quick Operations"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {user.role === "patient" ? (
                  invoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-text-muted animate-fade-in">
                      <div className="w-10 h-10 rounded-xl bg-surface-alt flex items-center justify-center mb-3 border border-border/60">
                        <svg className="w-5 h-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <p className="font-semibold text-text text-sm">All outpatient bills paid</p>
                      <p className="text-xs text-text-muted mt-1">Excellent! You have no pending balances on your account.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {invoices.map((inv: any) => (
                        <div key={inv.id} className="flex justify-between items-center p-3.5 border border-border bg-surface-alt rounded-xl hover:border-primary-500/30 transition-all">
                          <div>
                            <p className="text-xs font-bold text-text-secondary">Invoice #{inv.invoiceNumber}</p>
                            <p className="text-base font-black text-text mt-0.5">₹{inv.totalAmount}</p>
                          </div>
                          <Button size="xs" onClick={() => router.push("/dashboard/bills")}>Pay Secure</Button>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    {user.role === "admin" && (
                      <>
                        <button onClick={() => router.push("/dashboard/staff")} className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group text-left cursor-pointer">
                          <span className="text-sm font-medium text-text group-hover:text-primary-600 transition-colors">Manage Staff</span>
                          <svg className="w-4 h-4 text-text-muted group-hover:text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <button onClick={() => router.push("/dashboard/clinics")} className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group text-left cursor-pointer">
                          <span className="text-sm font-medium text-text group-hover:text-primary-600 transition-colors">Manage Clinics</span>
                          <svg className="w-4 h-4 text-text-muted group-hover:text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <button onClick={() => router.push("/dashboard/audit")} className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group text-left cursor-pointer">
                          <span className="text-sm font-medium text-text group-hover:text-primary-600 transition-colors">View Audit Logs</span>
                          <svg className="w-4 h-4 text-text-muted group-hover:text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </>
                    )}
                    {user.role === "receptionist" && (
                      <>
                        <button onClick={() => router.push("/dashboard/queue")} className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group text-left cursor-pointer">
                          <span className="text-sm font-medium text-text group-hover:text-primary-600 transition-colors">Check-in / Manage Queue</span>
                          <svg className="w-4 h-4 text-text-muted group-hover:text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <button onClick={() => router.push("/dashboard/appointments")} className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group text-left cursor-pointer">
                          <span className="text-sm font-medium text-text group-hover:text-primary-600 transition-colors">Book Appointment</span>
                          <svg className="w-4 h-4 text-text-muted group-hover:text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </>
                    )}
                    {user.role === "doctor" && (
                      <>
                        <button onClick={() => router.push("/dashboard/queue")} className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-surface-alt hover:bg-surface-hover hover:border-primary-500/50 transition-colors group text-left cursor-pointer">
                          <span className="text-sm font-medium text-text group-hover:text-primary-600 transition-colors">My Consultation Queue</span>
                          <svg className="w-4 h-4 text-text-muted group-hover:text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
