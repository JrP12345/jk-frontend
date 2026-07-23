"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Spinner, useToast, Table } from "@/components/ui";
import { NEWS2Service } from "@/services/news2.service";

interface NEWS2CalculatorProps {
  encounterId: string;
  patientId: string;
}

export function NEWS2Calculator({ encounterId, patientId }: NEWS2CalculatorProps) {
  const [spo2, setSpo2] = useState("98");
  const [hr, setHr] = useState("72");
  const [rr, setRr] = useState("16");
  const [temp, setTemp] = useState("36.8");
  const [sbp, setSbp] = useState("120");

  const [evaluating, setEvaluating] = useState(false);
  const [news2Result, setNews2Result] = useState<any | null>(null);
  const [activeAlert, setActiveAlert] = useState<any | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  const [scoresHistory, setScoresHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [vitalTrends, setVitalTrends] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchHistoryAndTrends = async () => {
    setLoadingHistory(true);
    try {
      const [scoresData, trendsData] = await Promise.all([
        NEWS2Service.getScores(encounterId),
        NEWS2Service.getPatientVitalTrends(patientId).catch(() => null),
      ]);
      setScoresHistory(scoresData || []);
      setVitalTrends(trendsData);
    } catch {
      setScoresHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistoryAndTrends();
  }, [encounterId, patientId]);

  const validateVitals = (): boolean => {
    const s = Number(spo2);
    const h = Number(hr);
    const r = Number(rr);
    const t = Number(temp);
    const b = Number(sbp);

    if (isNaN(s) || s < 50 || s > 100) {
      setValidationError("SpO2 must be a valid percentage between 50% and 100%");
      return false;
    }
    if (isNaN(h) || h < 20 || h > 250) {
      setValidationError("Heart Rate must be between 20 and 250 bpm");
      return false;
    }
    if (isNaN(r) || r < 4 || r > 60) {
      setValidationError("Respiration Rate must be between 4 and 60 breaths/min");
      return false;
    }
    if (isNaN(t) || t < 30 || t > 45) {
      setValidationError("Temperature must be between 30°C and 45°C");
      return false;
    }
    if (isNaN(b) || b < 40 || b > 300) {
      setValidationError("Systolic BP must be between 40 and 300 mmHg");
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleEvaluateScore = async () => {
    if (!validateVitals()) return;

    setEvaluating(true);
    try {
      const data = await NEWS2Service.evaluateScore(encounterId, "NEWS2");
      const scoreObj = data.score || data;
      setNews2Result(scoreObj);
      if (data.alert) {
        setActiveAlert(data.alert);
      } else {
        setActiveAlert(null);
      }

      toast({
        title: "NEWS2 Evaluation Complete",
        description: `Score: ${scoreObj.totalScore || 0} (${scoreObj.riskCategory || "Low"} Risk)`,
        variant: scoreObj.riskCategory === "High" ? "error" : "success",
      });

      fetchHistoryAndTrends();
    } catch (err: any) {
      toast({
        title: "Evaluation Error",
        description: err.response?.data?.message || err.message || "Failed to evaluate NEWS2 score",
        variant: "error",
      });
    } finally {
      setEvaluating(false);
    }
  };

  const handleAcknowledgeAlert = async () => {
    if (!activeAlert || !activeAlert._id && !activeAlert.id) return;
    const alertId = activeAlert._id || activeAlert.id;
    setAcknowledging(true);
    try {
      await NEWS2Service.acknowledgeAlert(alertId);
      setActiveAlert(null);
      toast({
        title: "Alert Acknowledged",
        description: "High-risk clinical deterioration alert acknowledged by clinician.",
        variant: "success",
      });
      fetchHistoryAndTrends();
    } catch (err: any) {
      toast({
        title: "Acknowledgment Error",
        description: err.response?.data?.message || "Failed to acknowledge alert",
        variant: "error",
      });
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* High Risk Active Alert Emergency Banner */}
      {activeAlert && !activeAlert.acknowledged && (
        <div className="p-4 rounded-xl bg-error-500/15 border-2 border-error-500 text-error-800 dark:text-error-200 animate-pulse flex items-center justify-between">
          <div className="space-y-1">
            <div className="font-extrabold text-base flex items-center gap-2">
              ⚠️ HIGH-RISK CLINICAL DETERIORATION ALERT
            </div>
            <p className="text-xs font-medium">
              NEWS2 Score: <b>{activeAlert.score || news2Result?.totalScore || 8}</b>. Requires immediate medical response team escalation.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={handleAcknowledgeAlert} loading={acknowledging}>
            Acknowledge Alert
          </Button>
        </div>
      )}

      {/* Vital Input Calculator Card */}
      <Card className="shadow-md">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base font-bold">NEWS2 Clinical Monitoring & Deterioration Engine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {validationError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-600 dark:text-red-400 font-semibold">
              {validationError}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Input label="SpO2 (%)" value={spo2} onChange={(e) => setSpo2(e.target.value)} placeholder="98" />
            <Input label="Heart Rate (bpm)" value={hr} onChange={(e) => setHr(e.target.value)} placeholder="72" />
            <Input label="Respiration Rate (/min)" value={rr} onChange={(e) => setRr(e.target.value)} placeholder="16" />
            <Input label="Temp (°C)" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="36.8" />
            <Input label="Systolic BP (mmHg)" value={sbp} onChange={(e) => setSbp(e.target.value)} placeholder="120" />
          </div>

          <Button onClick={handleEvaluateScore} loading={evaluating} fullWidth size="lg">
            Evaluate & Persist NEWS2 Risk Score
          </Button>

          {news2Result && (
            <div className="p-4 rounded-xl border border-border bg-surface-hover space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-text">Evaluated NEWS2 Score:</span>
                <span className="text-2xl font-extrabold text-primary-600">{news2Result.totalScore ?? news2Result.score ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Risk Classification:</span>
                <Badge variant={news2Result.riskCategory === "High" ? "error" : news2Result.riskCategory === "Medium" ? "warning" : "success"}>
                  {news2Result.riskCategory || "Low"} Risk
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historical Scores Trajectory */}
      <Card className="shadow-md">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base font-bold">NEWS2 Score History & Trajectory</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingHistory ? (
            <div className="py-8 text-center"><Spinner size="md" label="Loading score history..." /></div>
          ) : scoresHistory.length > 0 ? (
            <Table
              columns={[
                { header: "Evaluated At", accessor: (row) => new Date(row.evaluatedAt || row.createdAt).toLocaleString() },
                { header: "Total Score", accessor: (row) => <span className="font-bold">{row.totalScore}</span> },
                { header: "Risk Category", accessor: (row) => <Badge variant={row.riskCategory === "High" ? "error" : row.riskCategory === "Medium" ? "warning" : "success"}>{row.riskCategory}</Badge> },
                { header: "Algorithm", accessor: (row) => row.algorithmId || "NEWS2" },
              ]}
              data={scoresHistory}
            />
          ) : (
            <div className="py-6 text-center text-xs text-text-muted">No historical NEWS2 evaluations recorded for this encounter yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
