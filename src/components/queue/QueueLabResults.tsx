"use client";

import { FlaskConical } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import styles from "./QueueLabResults.module.css";

interface LabResult {
  testName: string;
  value: string;
  unit?: string;
  isAbnormal?: boolean;
}

export default function QueueLabResults({ results, onOpen }: { results: LabResult[]; onOpen: () => void }) {
  if (!results.length) return null;
  const allPending = results.every(result => typeof result.value === "string" && /^pending\b/i.test(result.value.trim()) && !result.isAbnormal);
  const flagged = results.filter(result => result.isAbnormal).length;
  return <section className={styles.panel} aria-label="Patient lab reports">
    <div className={styles.header}>
      <div className={styles.heading}><FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{results.length} lab {results.length === 1 ? "test" : "tests"}</span>
        {allPending && <Badge variant="neutral">Results pending</Badge>}
        {flagged > 0 && <Badge variant="danger">{flagged} abnormal</Badge>}
      </div>
      <Button type="button" variant="outline" size="xs" onClick={onOpen}>View reports</Button>
    </div>
    {allPending ? <p className={styles.requested}>{results.map(result => result.testName).join(" · ")}</p> :
      <dl className={styles.results}>{results.map((result, index) => <div key={`${result.testName}-${index}`}>
        <dt>{result.testName}</dt><dd className={result.isAbnormal ? styles.abnormal : undefined}>
          {result.value}{result.unit ? ` ${result.unit}` : ""}{result.isAbnormal && <span>Abnormal</span>}
        </dd>
      </div>)}</dl>}
  </section>;
}
