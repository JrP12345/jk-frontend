"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Zap, Building2, Shield, Sparkles, HelpCircle, ArrowRight } from "lucide-react";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import { billingService, SaaSPlan } from "@/services/billing.service";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const data = await billingService.getPlans();
        if (data && data.length > 0) {
          setPlans(data);
        } else {
          setPlans(defaultPlansFallback);
        }
      } catch (err) {
        setPlans(defaultPlansFallback);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Public Navbar */}
      <MarketplaceNavbar />

      {/* Hero Header */}
      <section className="relative pt-32 pb-16 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/30 via-slate-950 to-slate-950 pointer-events-none" />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5" /> Commercial SaaS Pricing
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
            Predictable Pricing for <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Modern Healthcare</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            Scale your clinics and hospital operations seamlessly with a 15-day free trial on all plans. No setup fees, cancel anytime.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex items-center p-1.5 rounded-2xl bg-slate-900 border border-slate-800 backdrop-blur-md">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                billingCycle === "monthly"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`relative px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                billingCycle === "annual"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Annual Billing
              <span className="ml-2 inline-block text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold uppercase">
                Save 17%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Plan Cards Grid */}
      <section className="max-w-7xl mx-auto px-4 pb-24 w-full">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan) => {
              const price = billingCycle === "annual" ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;
              const isEnterprise = plan.slug === "enterprise";

              return (
                <div
                  key={plan.id || plan.slug}
                  className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                    plan.isPopular
                      ? "bg-slate-900/90 border-2 border-cyan-500 shadow-2xl shadow-cyan-500/10 scale-105"
                      : "bg-slate-900/50 border border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {plan.isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold uppercase px-4 py-1 rounded-full shadow-md">
                      Most Popular
                    </div>
                  )}

                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                    <p className="text-sm text-slate-400 mb-6 min-h-[40px]">{plan.description}</p>

                    <div className="mb-8">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-white">
                          ₹{price.toLocaleString("en-IN")}
                        </span>
                        <span className="text-slate-400 text-sm">/ month</span>
                      </div>
                      {billingCycle === "annual" && (
                        <p className="text-xs text-emerald-400 mt-1 font-medium">
                          Billed annually (₹{plan.annualPrice.toLocaleString("en-IN")}/yr)
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-800 mb-8 text-sm">
                      <div className="flex items-center text-slate-300">
                        <Check className="w-4 h-4 text-cyan-400 mr-3 flex-shrink-0" />
                        <span>Up to <strong>{plan.limits?.maxClinics || 1} Clinic Branch(es)</strong></span>
                      </div>
                      <div className="flex items-center text-slate-300">
                        <Check className="w-4 h-4 text-cyan-400 mr-3 flex-shrink-0" />
                        <span>Up to <strong>{plan.limits?.maxDoctors || 2} Doctor Profiles</strong></span>
                      </div>
                      <div className="flex items-center text-slate-300">
                        <Check className="w-4 h-4 text-cyan-400 mr-3 flex-shrink-0" />
                        <span>Up to <strong>{plan.limits?.maxStaff || 5} Operational Staff</strong></span>
                      </div>
                      <div className="flex items-center text-slate-300">
                        <Check className="w-4 h-4 text-cyan-400 mr-3 flex-shrink-0" />
                        <span><strong>{(plan.limits?.maxPatients || 500).toLocaleString()}</strong> Patient Records</span>
                      </div>
                      {plan.features?.analytics && (
                        <div className="flex items-center text-slate-300">
                          <Check className="w-4 h-4 text-cyan-400 mr-3 flex-shrink-0" />
                          <span>Advanced Analytics & Dashboard</span>
                        </div>
                      )}
                      {plan.features?.auditLogs && (
                        <div className="flex items-center text-slate-300">
                          <Check className="w-4 h-4 text-cyan-400 mr-3 flex-shrink-0" />
                          <span>HIPAA / DISHA Audit Logs</span>
                        </div>
                      )}
                      {plan.features?.aiFeatures && (
                        <div className="flex items-center text-slate-300">
                          <Check className="w-4 h-4 text-cyan-400 mr-3 flex-shrink-0" />
                          <span>Clinical AI Copilot & Transcription</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Link
                    href={isEnterprise ? "/contact" : "/login"}
                    className={`w-full py-3.5 rounded-xl font-semibold text-center transition-all duration-200 flex items-center justify-center gap-2 ${
                      plan.isPopular
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90 shadow-lg shadow-cyan-500/25"
                        : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                    }`}
                  >
                    {isEnterprise ? "Contact Sales" : "Start 15-Day Free Trial"} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Feature Comparison Matrix */}
      <section className="bg-slate-900/60 border-t border-b border-slate-800 py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">Detailed Feature Matrix</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-white uppercase text-xs font-semibold">
                <tr>
                  <th className="py-4 px-6 rounded-l-xl">Feature</th>
                  <th className="py-4 px-6 text-center">Starter</th>
                  <th className="py-4 px-6 text-center">Professional</th>
                  <th className="py-4 px-6 text-center rounded-r-xl">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="py-4 px-6 font-medium text-white">Clinics / Branches</td>
                  <td className="py-4 px-6 text-center">1 Branch</td>
                  <td className="py-4 px-6 text-center font-semibold text-cyan-400">Up to 5 Branches</td>
                  <td className="py-4 px-6 text-center">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-white">Doctors & Practitioners</td>
                  <td className="py-4 px-6 text-center">Up to 2</td>
                  <td className="py-4 px-6 text-center font-semibold text-cyan-400">Up to 15</td>
                  <td className="py-4 px-6 text-center">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-white">Patient Record Capacity</td>
                  <td className="py-4 px-6 text-center">500 Records</td>
                  <td className="py-4 px-6 text-center">5,000 Records</td>
                  <td className="py-4 px-6 text-center font-semibold text-cyan-400">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-white">Clinical AI Engine</td>
                  <td className="py-4 px-6 text-center text-slate-500">—</td>
                  <td className="py-4 px-6 text-center"><Check className="w-5 h-5 text-cyan-400 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><Check className="w-5 h-5 text-cyan-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-white">Multi-Branch Support</td>
                  <td className="py-4 px-6 text-center text-slate-500">—</td>
                  <td className="py-4 px-6 text-center"><Check className="w-5 h-5 text-cyan-400 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><Check className="w-5 h-5 text-cyan-400 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800 py-8 px-4 text-center text-xs text-slate-500">
        © 2026 ANANTA Healthcare Infrastructure Platform. All rights reserved. Razorpay Secured.
      </footer>
    </div>
  );
}

const defaultPlansFallback: SaaSPlan[] = [
  {
    id: "1",
    name: "Starter",
    slug: "starter",
    description: "Essential healthcare tools for individual practitioners and small single-branch clinics.",
    monthlyPrice: 1999,
    annualPrice: 19990,
    currency: "INR",
    trialDays: 15,
    status: "active",
    displayOrder: 1,
    isPopular: false,
    limits: { maxHospitals: 1, maxClinics: 1, maxDoctors: 2, maxStaff: 5, maxPatients: 500, maxAppointments: 1000, maxStorageMB: 2048 },
    features: { analytics: true, auditLogs: false, multiBranch: false, dataExport: false, apiAccess: false, aiFeatures: false }
  },
  {
    id: "2",
    name: "Professional",
    slug: "professional",
    description: "Complete management suite for growing multi-doctor clinics and diagnostic centers.",
    monthlyPrice: 4999,
    annualPrice: 49990,
    currency: "INR",
    trialDays: 15,
    status: "active",
    displayOrder: 2,
    isPopular: true,
    limits: { maxHospitals: 3, maxClinics: 5, maxDoctors: 15, maxStaff: 25, maxPatients: 5000, maxAppointments: 10000, maxStorageMB: 10240 },
    features: { analytics: true, auditLogs: true, multiBranch: true, dataExport: true, apiAccess: false, aiFeatures: true }
  },
  {
    id: "3",
    name: "Enterprise",
    slug: "enterprise",
    description: "Advanced infrastructure with dedicated AI engines, unlimited branches, and custom SLA for hospitals.",
    monthlyPrice: 14999,
    annualPrice: 149990,
    currency: "INR",
    trialDays: 15,
    status: "active",
    displayOrder: 3,
    isPopular: false,
    limits: { maxHospitals: 99, maxClinics: 99, maxDoctors: 999, maxStaff: 999, maxPatients: 99999, maxAppointments: 999999, maxStorageMB: 102400 },
    features: { analytics: true, auditLogs: true, multiBranch: true, dataExport: true, apiAccess: true, aiFeatures: true }
  }
];
