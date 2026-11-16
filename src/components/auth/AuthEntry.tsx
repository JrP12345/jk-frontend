"use client";

import { useEffect, useRef, useState } from "react";
import LoginForm from "./LoginForm";
import PatientRegistrationForm from "./PatientRegistrationForm";

type EntryView = "signin" | "register";

/** Switch forms locally; identity and permissions still come from the auth API. */
export default function AuthEntry({ initialView = "signin", initialAudience = "patient" }: { initialView?: EntryView; initialAudience?: "patient" | "staff" }) {
  const [view, setView] = useState(initialView);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const restore = () => setView(new URLSearchParams(window.location.search).get("mode") === "register" ? "register" : "signin");
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const switchView = (next: EntryView) => {
    const url = new URL(window.location.href);
    if (next === "register") url.searchParams.set("mode", "register");
    else url.searchParams.delete("mode");
    url.searchParams.delete("audience");
    // Native history integrates with App Router without fetching another form.
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setView(next);
    requestAnimationFrame(() => {
      const heading = content.current?.querySelector("h1");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
    });
  };

  return <div ref={content}>
    {view === "register"
      ? <PatientRegistrationForm onSignIn={() => switchView("signin")} />
      : <LoginForm initialAudience={initialAudience} onRegister={() => switchView("register")} />}
  </div>;
}
