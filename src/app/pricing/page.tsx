"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";

import { billingService, SaaSPlan } from "@/services/billing.service";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const data = await billingService.getPlans();
        if (data && data.length > 0) {
          setPlans(data);
        } else {
          setPlans([]);
          setError("No active pricing plans are configured.");
        }
      } catch (err) {
        setPlans([]);
        setError("Pricing plans could not be loaded. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  return (
    <div className="min-h-screen bg-background text-text flex flex-col font-sans selection:bg-primary selection:text-text animate-page-enter">
      {/* Public Navbar */}
      <MarketplaceNavbar />

      {/* Hero Header */}
      <section className="relative pt-32 pb-16 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 brand-wash pointer-events-none" />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-accent/30 text-accent text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5" /> Commercial SaaS Pricing
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-text mb-6">
            Predictable Pricing for <span className="text-accent">Modern Healthcare</span>
          </h1>
          <p className="text-lg sm:text-xl text-text-muted max-w-2xl mx-auto mb-10">
            Scale your clinics and hospital operations seamlessly with a 15-day free trial on all plans. No setup fees, cancel anytime.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex max-w-full items-center p-1 sm:p-1.5 rounded-2xl bg-surface border border-border ">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-3.5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 min-h-[44px] flex items-center justify-center ${
                billingCycle === "monthly"
                  ? "bg-primary text-brand-mist shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`relative px-3.5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 min-h-[44px] flex items-center justify-center ${
                billingCycle === "annual"
                  ? "bg-primary text-brand-mist shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Annual Billing
              <span className={`ml-1.5 sm:ml-2 inline-block text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full border font-bold uppercase ${billingCycle === "annual" ? "bg-brand-ink/20 text-brand-mist border-brand-mist/30" : "bg-success-subtle text-success-text border-success/30"}`}>
                Save 17%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Plan Cards Grid */}
      <section className="max-w-7xl mx-auto px-4 pb-24 w-full">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch animate-fade-in" aria-busy="true" aria-label="Loading pricing tiers">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-3xl p-6 sm:p-8 bg-surface/50 border border-border space-y-6">
                <div className="space-y-2">
                  <div className="h-6 w-28 bg-surface-alt rounded-lg animate-pulse" />
                  <div className="h-4 w-44 bg-surface-alt/60 rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-10 w-32 bg-surface-alt rounded-lg animate-pulse" />
                  <div className="h-3 w-20 bg-surface-alt/50 rounded animate-pulse" />
                </div>
                <div className="space-y-3 pt-4 border-t border-border/80">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="h-4 bg-surface-alt/40 rounded animate-pulse" style={{ width: `${60 + (j * 10)}%` }} />
                  ))}
                </div>
                <div className="h-12 w-full bg-surface-alt rounded-xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-20 text-center text-text-muted">{error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan) => {
              const price = billingCycle === "annual" ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;
              const isEnterprise = plan.slug === "enterprise";

              return (
                <div
                  key={plan.id || plan.slug}
                  className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
                    plan.isPopular
                      ? "bg-surface/90 border-2 border-accent shadow-sm md:scale-105"
                      : "bg-surface/50 border border-border hover:border-border"
                  }`}
                >
                  {plan.isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-brand-mist text-[11px] sm:text-xs font-bold uppercase px-3 sm:px-4 py-1 rounded-full shadow-md whitespace-nowrap">
                      Most Popular
                    </div>
                  )}

                  <div>
                    <h3 className="text-2xl font-bold text-text mb-2">{plan.name}</h3>
                    <p className="text-sm text-text-muted mb-6 min-h-[40px]">{plan.description}</p>

                    <div className="mb-8">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-text">
                          ₹{price.toLocaleString("en-IN")}
                        </span>
                        <span className="text-text-muted text-sm">/ month</span>
                      </div>
                      {billingCycle === "annual" && (
                        <p className="text-xs text-success-text mt-1 font-medium">
                          Billed annually (₹{plan.annualPrice.toLocaleString("en-IN")}/yr)
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border mb-8 text-sm">
                      <div className="flex items-center text-text-secondary">
                        <Check className="w-4 h-4 text-accent mr-3 flex-shrink-0" />
                        <span>Up to <strong>{plan.limits?.maxClinics || 1} Clinic Branch(es)</strong></span>
                      </div>
                      <div className="flex items-center text-text-secondary">
                        <Check className="w-4 h-4 text-accent mr-3 flex-shrink-0" />
                        <span>Up to <strong>{plan.limits?.maxDoctors || 2} Doctor Profiles</strong></span>
                      </div>
                      <div className="flex items-center text-text-secondary">
                        <Check className="w-4 h-4 text-accent mr-3 flex-shrink-0" />
                        <span>Up to <strong>{plan.limits?.maxStaff || 5} Operational Staff</strong></span>
                      </div>
                      <div className="flex items-center text-text-secondary">
                        <Check className="w-4 h-4 text-accent mr-3 flex-shrink-0" />
                        <span><strong>{(plan.limits?.maxPatients || 500).toLocaleString()}</strong> Patient Records</span>
                      </div>
                      {plan.features?.analytics && (
                        <div className="flex items-center text-text-secondary">
                          <Check className="w-4 h-4 text-accent mr-3 flex-shrink-0" />
                          <span>Advanced Analytics & Dashboard</span>
                        </div>
                      )}
                      {plan.features?.auditLogs && (
                        <div className="flex items-center text-text-secondary">
                          <Check className="w-4 h-4 text-accent mr-3 flex-shrink-0" />
                          <span>HIPAA / DISHA Audit Logs</span>
                        </div>
                      )}
                      {plan.features?.aiFeatures && (
                        <div className="flex items-center text-text-secondary">
                          <Check className="w-4 h-4 text-accent mr-3 flex-shrink-0" />
                          <span>Clinical AI Copilot & Transcription</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Link
                    href={isEnterprise ? "/contact" : `/onboarding?mode=new_org&plan=${encodeURIComponent(plan.id || "standard")}`}
                    className={`w-full py-3.5 rounded-xl font-semibold text-center transition-all duration-200 flex items-center justify-center gap-2 min-h-[44px] ${
                      plan.isPopular
                        ? "bg-primary text-brand-mist hover:opacity-90 shadow-sm"
                        : "bg-surface-alt hover:bg-surface-alt text-text border border-border"
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
      <section className="bg-surface/60 border-t border-b border-border py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-text mb-12">Detailed Feature Matrix</h2>

          <div className="overflow-x-auto touch-scroll" tabIndex={0} role="region" aria-label="Plan feature comparison">
            <table className="w-full text-left text-sm text-text-secondary min-w-[560px] sm:min-w-full">
              <thead className="bg-background/80 text-text uppercase text-xs font-semibold">
                <tr>
                  <th className="py-4 px-6 rounded-l-xl">Feature</th>
                  <th className="py-4 px-6 text-center">Starter</th>
                  <th className="py-4 px-6 text-center">Professional</th>
                  <th className="py-4 px-6 text-center rounded-r-xl">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-4 px-6 font-medium text-text">Clinics / Branches</td>
                  <td className="py-4 px-6 text-center">1 Branch</td>
                  <td className="py-4 px-6 text-center font-semibold text-accent">Up to 5 Branches</td>
                  <td className="py-4 px-6 text-center">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-text">Doctors & Practitioners</td>
                  <td className="py-4 px-6 text-center">Up to 2</td>
                  <td className="py-4 px-6 text-center font-semibold text-accent">Up to 15</td>
                  <td className="py-4 px-6 text-center">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-text">Patient Record Capacity</td>
                  <td className="py-4 px-6 text-center">500 Records</td>
                  <td className="py-4 px-6 text-center">5,000 Records</td>
                  <td className="py-4 px-6 text-center font-semibold text-accent">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-text">Clinical AI Engine</td>
                  <td className="py-4 px-6 text-center text-text-muted">—</td>
                  <td className="py-4 px-6 text-center"><Check className="w-5 h-5 text-accent mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><Check className="w-5 h-5 text-accent mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-text">Multi-Branch Support</td>
                  <td className="py-4 px-6 text-center text-text-muted">—</td>
                  <td className="py-4 px-6 text-center"><Check className="w-5 h-5 text-accent mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><Check className="w-5 h-5 text-accent mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-8 px-4 text-center text-xs text-text-muted">
        © 2026 Ekavyu Healthcare Infrastructure Platform. All rights reserved. Razorpay Secured.
      </footer>
    </div>
  );
}
