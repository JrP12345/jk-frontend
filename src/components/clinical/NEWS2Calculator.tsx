"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Skeleton, Table, useToast } from "@/components/ui";
import { NEWS2Service } from "@/services/news2.service";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { useLatestRead } from "@/hooks/useLatestRead";
import styles from "./NEWS2Calculator.module.css";

interface Score {
  id?: string; _id?: string; totalScore?: number; score?: number; riskCategory?: string;
  evaluatedAt?: string; createdAt?: string; algorithmId?: string; isComplete?: boolean;
  missingParameters?: string[];
  parameterBreakdown?: Array<{ parameter: string; rawValue?: unknown; unit?: string; subScore?: number }>;
}
interface ScoreAlert { id?: string; _id?: string; score?: number; message?: string; recommendedAction?: string; acknowledged?: boolean }
const scoreValue = (score?: Score | null) => score?.totalScore ?? score?.score ?? "—";
const dateLabel = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : "Not recorded";
const riskVariant = (risk?: string) => risk === "High" ? "error" : risk === "Medium" ? "warning" : risk === "Low" ? "success" : "neutral";

export function NEWS2Calculator({ encounterId, patientId }: { encounterId: string; patientId: string }) {
  const user = useAuthStore(state => state.user);
  const canEvaluate = hasAnyPermission(user, "EVALUATE_NEWS2");
  const { toast } = useToast();
  const [evaluating, setEvaluating] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedScope, setLoadedScope] = useState("");
  const [evaluated, setEvaluated] = useState<{ scope: string; score: Score; alert: ScoreAlert | null } | null>(null);
  const scope = JSON.stringify([encounterId, patientId]);
  const ready = loadedScope === scope;
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const request = beginRead(); setLoading(true); setError(false);
    try {
      const records = await NEWS2Service.getScores(encounterId);
      if (request.isCurrent()) setScores(Array.isArray(records) ? records : []);
    } catch { if (request.isCurrent()) { setScores([]); setError(true); } }
    finally { if (request.isCurrent()) { setLoadedScope(scope); setLoading(false); } }
  }, [beginRead, encounterId, scope]);
  useEffect(() => { void load(); return () => { beginRead(); }; }, [load, beginRead]);
  const currentEvaluation = evaluated?.scope === scope ? evaluated : null;
  const history = ready ? scores : [];
  const latest = currentEvaluation?.score || [...history].sort((a, b) => (Date.parse(b.evaluatedAt || b.createdAt || "") || 0) - (Date.parse(a.evaluatedAt || a.createdAt || "") || 0))[0];
  const activeAlert = currentEvaluation?.alert;

  async function evaluate() {
    if (!canEvaluate || evaluating) return;
    setEvaluating(true);
    try {
      // The server evaluates saved encounter observations; browser defaults are never submitted.
      const data = await NEWS2Service.evaluateScore(encounterId, "NEWS2");
      const score: Score = data.score || data;
      setEvaluated({ scope, score, alert: data.alert || null });
      toast({ title: "NEWS2 evaluated", description: "Score: " + scoreValue(score) + " (" + (score.riskCategory || "Not classified") + ")", variant: score.riskCategory === "High" ? "error" : "success" });
      void load();
    } catch (failure: unknown) {
      toast({ title: "Evaluation unavailable", description: (failure as { response?: { data?: { message?: string } } }).response?.data?.message || "Check the saved encounter observations and try again.", variant: "error" });
    } finally { setEvaluating(false); }
  }
  async function acknowledge() {
    const id = activeAlert?.id || activeAlert?._id;
    if (!id || acknowledging || !canEvaluate) return;
    setAcknowledging(true);
    try {
      await NEWS2Service.acknowledgeAlert(id);
      setEvaluated(current => current?.scope === scope ? { ...current, alert: null } : current);
      toast({ title: "Alert acknowledged", variant: "success" });
      void load();
    } catch { toast({ title: "Acknowledgment unavailable", description: "Please try again.", variant: "error" }); }
    finally { setAcknowledging(false); }
  }

  return <div className={styles.workspace}>
    {activeAlert && !activeAlert.acknowledged && <div className={styles.alert} role="alert"><div><h3>Clinical alert</h3><p>{activeAlert.message || "Review the recorded NEWS2 result."}</p>{activeAlert.recommendedAction && <p>{activeAlert.recommendedAction}</p>}<p>Score: {activeAlert.score ?? scoreValue(latest)}</p></div>{canEvaluate && <Button variant="danger" size="sm" onClick={acknowledge} loading={acknowledging}>Acknowledge</Button>}</div>}
    <div className={styles.columns}>
      <section className={styles.panel} aria-label="NEWS2 evaluation">
        <header><div><h2>NEWS2</h2><p>Early warning score</p></div>{canEvaluate && <Button size="sm" onClick={evaluate} loading={evaluating}>Evaluate score</Button>}</header>
        <p className={styles.description}>Calculated from observations saved to this encounter.</p>
        {(loading || !ready) && !latest ? <div role="status" aria-label="Loading latest NEWS2 score"><Skeleton height="96px" /></div> : latest ? <>
          <div className={styles.result}><div><span>Latest score</span><strong>{scoreValue(latest)}</strong></div><div><Badge variant={riskVariant(latest.riskCategory)}>{latest.riskCategory || "Not classified"}</Badge>{latest.isComplete === false && <Badge variant="warning">Incomplete</Badge>}</div></div>
          <p className={styles.date}>Evaluated {dateLabel(latest.evaluatedAt || latest.createdAt)}</p>
          {latest.isComplete === false && <Alert variant="warning" title="Missing observations">{latest.missingParameters?.length ? latest.missingParameters.join(", ") : "Some observations are missing from this evaluation."}</Alert>}
        </> : <p className={styles.empty}>{error ? "Latest score unavailable." : "No evaluation recorded yet."}</p>}
        {!canEvaluate && <p className={styles.description}>Evaluation requires NEWS2 permission.</p>}
      </section>
      <section className={styles.panel} aria-label="NEWS2 score history">
        <header><h2>Score history</h2><Button variant="ghost" size="sm" onClick={load} disabled={loading}>Refresh</Button></header>
        {ready && error ? <Alert variant="error" title="Score history unavailable" action={<Button variant="outline" size="sm" onClick={load}>Try again</Button>}>The history could not be loaded.</Alert> : ready && !loading && !history.length ? <p className={styles.empty}>No scores recorded for this encounter.</p> : <Table<Score>
          variant="flat" density="compact" fitContent searchable={false} showColumnVisibility={false} pagination={false}
          columns={[{ header: "Evaluated", accessor: row => dateLabel(row.evaluatedAt || row.createdAt) }, { header: "Score", accessor: row => <strong>{scoreValue(row)}</strong> }, { header: "Risk", accessor: row => <Badge variant={riskVariant(row.riskCategory)}>{row.riskCategory || "Not classified"}</Badge> }]}
          data={history} loading={loading || !ready} emptyMessage="No scores recorded for this encounter." />}
      </section>
    </div>
    {latest?.parameterBreakdown?.length ? <section className={styles.panel} aria-label="Observations used for latest score"><header><h2>Observations used</h2></header><p className={styles.description}>Recorded values from the latest evaluation.</p><dl className={styles.observations}>{latest.parameterBreakdown.map((item, index) => <div key={index}><dt>{item.parameter}</dt><dd>{item.rawValue === undefined || item.rawValue === null ? "Not recorded" : String(item.rawValue)} {item.unit || ""}</dd>{item.subScore !== undefined && <span>Score {item.subScore}</span>}</div>)}</dl></section> : null}
  </div>;
}
