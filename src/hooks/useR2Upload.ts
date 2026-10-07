import { useState } from 'react';
import api from '../lib/api';

export interface UploadResult {
  objectKey: string;
  intentId: string;
}

export interface UseR2UploadOptions {
  onError?: (err: unknown) => void;
  onSuccess?: (res: UploadResult) => void;
}

export function useR2Upload(options?: UseR2UploadOptions) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File, context?: { patientId?: string; contentClass?: 'avatar' | 'lab_report' | 'clinical_document' }): Promise<UploadResult> => {
    setUploading(true);
    setProgress(30);
    setError(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setProgress(60);
      const res = await api.post('/uploads/base64', {
        contentType: file.type || 'image/png',
        originalFilename: file.name,
        base64Data: base64,
        ...context,
      });

      const data = res.data;
      if (!data?.success) {
        throw new Error(data?.message || data?.error || 'Upload failed');
      }

      if (typeof data.data?.objectKey !== 'string' || !data.data.objectKey ||
          typeof data.data?.intentId !== 'string' || !data.data.intentId) {
        throw new Error('Upload response is incomplete');
      }
      setProgress(100);
      const result: UploadResult = {
        objectKey: data.data.objectKey,
        intentId: data.data.intentId,
      };

      if (options?.onSuccess) {
        options.onSuccess(result);
      }

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Cloud storage upload failed';
      setError(message);
      options?.onError?.(err);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploadFile,
    uploading,
    progress,
    error,
    reset: () => {
      setError(null);
      setProgress(0);
    }
  };
}
