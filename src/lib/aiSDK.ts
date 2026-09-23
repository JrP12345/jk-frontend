import api, { getApiUrl } from "./api";

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
   * Helper to retrieve CSRF token from document.cookie if set.
   */
  private getCsrfToken(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/(?:^|;\s*)(?:_csrf|ananta_csrf|csrf_token)=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /**
   * Synchronous query execution through the Enterprise AI Gateway.
   */
  async query(options: AIQueryOptions): Promise<AISDKResponse> {
    const res = await api.post("/ai/gateway/query", options);
    return res.data?.data || res.data;
  }

  /**
   * Token-by-token real-time Server-Sent Events (SSE) streaming.
   * Uses cookie credentials (credentials: "include"), transparent 401 refresh/retry,
   * CSRF protection, and AbortController lifecycle management.
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

    const makeStreamRequest = async (isRetry = false): Promise<void> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      };

      const csrf = this.getCsrfToken();
      if (csrf) {
        headers["x-csrf-token"] = csrf;
      }

      let response: Response;
      try {
        response = await fetch(`${getApiUrl()}/ai/gateway/stream`, {
          method: "POST",
          headers,
          credentials: "include", // Send HttpOnly session cookies (Finding: Step 3.1)
          body: JSON.stringify(options),
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        if (fetchErr.name === "AbortError") {
          console.log(`[ANANTA AI SDK] Stream ${correlationId} aborted.`);
          return;
        }
        throw fetchErr;
      }

      // Transparent token refresh on 401 Unauthorized
      if (response.status === 401 && !isRetry) {
        console.warn(`[ANANTA AI SDK] 401 received on stream. Attempting session refresh...`);
        try {
          await api.post("/auth/refresh");
          return await makeStreamRequest(true);
        } catch (refreshErr) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("auth-expired"));
          }
          throw new Error("Session expired. Please log in again.");
        }
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let errorMsg = `Stream request failed with status ${response.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.message) errorMsg = parsed.message;
        } catch {}
        throw new Error(errorMsg);
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
    };

    try {
      await makeStreamRequest();
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
   * Cancels all active in-flight streams (e.g. on user logout, route navigation, or unmount).
   */
  cancelAllStreams(): void {
    this.activeStreams.forEach((controller) => {
      try {
        controller.abort();
      } catch {}
    });
    this.activeStreams.clear();
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
