import api from "./api";

export interface AIQueryOptions {
  query: string;
  modelAlias?: "CLINICAL_FAST" | "CLINICAL_ACCURATE" | "CLINICAL_REASONING";
  sessionId?: string;
  currentRoute?: string;
  activePatientId?: string;
}

export interface AISDKResponse {
  correlationId: string;
  text: string;
  citations: string[];
  suggestedActions?: any[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUSD: number;
    latencyMs: number;
  };
  provider: string;
  model: string;
}

export interface StreamChunk {
  correlationId: string;
  chunkIndex: number;
  text: string;
  isComplete: boolean;
}

export class ANANTAAISDK {
  private activeStreams: Map<string, AbortController> = new Map();

  /**
   * Synchronous query execution through the Enterprise AI Gateway.
   */
  async query(options: AIQueryOptions): Promise<AISDKResponse> {
    const res = await api.post("/ai/gateway/query", options);
    return res.data?.data || res.data;
  }

  /**
   * Token-by-token real-time Server-Sent Events (SSE) streaming.
   */
  async stream(
    options: AIQueryOptions,
    onChunk: (chunk: StreamChunk) => void,
    onComplete: () => void,
    onError: (err: any) => void
  ): Promise<string> {
    const controller = new AbortController();
    const correlationId = `corr_sdk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.activeStreams.set(correlationId, controller);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/ai/gateway/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""}`
        },
        body: JSON.stringify(options),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Stream request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Response body is not readable");
      }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.replace("data: ", "").trim();
            if (jsonStr) {
              try {
                const chunk: StreamChunk = JSON.parse(jsonStr);
                onChunk(chunk);
                if (chunk.isComplete) {
                  onComplete();
                }
              } catch {}
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log(`[ANANTA AI SDK] Stream ${correlationId} cancelled by user.`);
      } else {
        onError(err);
      }
    } finally {
      this.activeStreams.delete(correlationId);
    }

    return correlationId;
  }

  /**
   * Cancels an in-flight SSE stream by correlation ID.
   */
  cancelStream(correlationId: string): void {
    if (this.activeStreams.has(correlationId)) {
      this.activeStreams.get(correlationId)?.abort();
      this.activeStreams.delete(correlationId);
    }
  }

  /**
   * Fetches operations health status of registered AI providers.
   */
  async getHealthStatus(): Promise<any> {
    const res = await api.get("/ai/health");
    return res.data?.data || res.data;
  }
}

export const aiSDK = new ANANTAAISDK();
