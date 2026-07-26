import { useState, useRef, useCallback } from "react";
import { aiSDK, AIQueryOptions, AISDKResponse } from "@/lib/aiSDK";

export function useAISession() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const activeCorrelationId = useRef<string | null>(null);

  const queryAI = useCallback(async (options: AIQueryOptions): Promise<AISDKResponse> => {
    return await aiSDK.query(options);
  }, []);

  const streamAI = useCallback(
    async (
      options: AIQueryOptions,
      onChunkText: (textChunk: string) => void,
      onDone: () => void,
      onError: (err: any) => void
    ) => {
      setIsStreaming(true);
      setStreamText("");

      const corrId = await aiSDK.stream(
        options,
        (chunk) => {
          setStreamText((prev) => prev + chunk.text);
          onChunkText(chunk.text);
        },
        () => {
          setIsStreaming(false);
          onDone();
        },
        (err) => {
          setIsStreaming(false);
          onError(err);
        }
      );

      activeCorrelationId.current = corrId;
    },
    []
  );

  const cancelStream = useCallback(() => {
    if (activeCorrelationId.current) {
      aiSDK.cancelStream(activeCorrelationId.current);
      setIsStreaming(false);
    }
  }, []);

  return {
    isStreaming,
    streamText,
    queryAI,
    streamAI,
    cancelStream,
  };
}
