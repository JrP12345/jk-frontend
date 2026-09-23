import { useState, useRef, useCallback, useEffect } from "react";
import { aiSDK, AIQueryOptions, AISDKResponse } from "@/lib/aiSDK";

export type AIStreamStatus = "idle" | "streaming" | "completed" | "disconnected" | "error";

export function useAISession() {
  const [status, setStatus] = useState<AIStreamStatus>("idle");
  const [streamText, setStreamText] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const activeCorrelationId = useRef<string | null>(null);
  const lastOptions = useRef<AIQueryOptions | null>(null);
  const lastCallbacks = useRef<{
    onChunkText?: (textChunk: string) => void;
    onDone?: () => void;
    onError?: (err: any) => void;
  }>({});

  // Automatically abort any active streams on component unmount
  useEffect(() => {
    return () => {
      if (activeCorrelationId.current) {
        aiSDK.cancelStream(activeCorrelationId.current);
        activeCorrelationId.current = null;
      }
    };
  }, []);

  const queryAI = useCallback(async (options: AIQueryOptions): Promise<AISDKResponse> => {
    return await aiSDK.query(options);
  }, []);

  const streamAI = useCallback(
    async (
      options: AIQueryOptions,
      onChunkText?: (textChunk: string) => void,
      onDone?: () => void,
      onError?: (err: any) => void
    ) => {
      if (activeCorrelationId.current) {
        aiSDK.cancelStream(activeCorrelationId.current);
      }

      lastOptions.current = options;
      lastCallbacks.current = { onChunkText, onDone, onError };
      setStatus("streaming");
      setStreamText("");
      setLastError(null);

      const corrId = await aiSDK.stream(
        options,
        (chunk) => {
          setStreamText((prev) => prev + chunk.text);
          if (onChunkText) onChunkText(chunk.text);
        },
        () => {
          setStatus("completed");
          if (onDone) onDone();
        },
        (err) => {
          const isDisconnected = err?.message?.includes("Failed to fetch") || err?.message?.includes("NetworkError");
          setStatus(isDisconnected ? "disconnected" : "error");
          setLastError(err?.message || "AI stream encountered an error");
          if (onError) onError(err);
        }
      );

      activeCorrelationId.current = corrId;
    },
    []
  );

  const cancelStream = useCallback(() => {
    if (activeCorrelationId.current) {
      aiSDK.cancelStream(activeCorrelationId.current);
      activeCorrelationId.current = null;
      setStatus("idle");
    }
  }, []);

  const retryStream = useCallback(async () => {
    if (lastOptions.current) {
      const { onChunkText, onDone, onError } = lastCallbacks.current;
      await streamAI(lastOptions.current, onChunkText, onDone, onError);
    }
  }, [streamAI]);

  return {
    isStreaming: status === "streaming",
    status,
    streamText,
    error: lastError,
    queryAI,
    streamAI,
    cancelStream,
    retryStream,
  };
}
