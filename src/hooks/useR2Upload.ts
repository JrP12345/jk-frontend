import { useState } from 'react';
import api from '../lib/api';

export interface UploadResult {
  url: string;
  publicUrl: string;
  key: string;
}

export interface UseR2UploadOptions {
  onError?: (err: any) => void;
  onSuccess?: (res: UploadResult) => void;
}

export function useR2Upload(options?: UseR2UploadOptions) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = async (file: File): Promise<UploadResult> => {
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
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      const res = await api.post('/upload-base64', {
        contentType: file.type || 'image/png',
        originalFilename: file.name,
        base64Data: base64,
        base64,
        fileName,
        folder: 'healthos',
      });

      const data = res.data;
      if (!data?.success) {
        throw new Error(data?.message || data?.error || 'Upload failed');
      }

      setProgress(100);
      const url = data.data?.url || data.data?.publicUrl || '';
      const result: UploadResult = {
        url,
        publicUrl: url,
        key: data.data?.key || data.data?.fileKey || fileName,
      };

      if (options?.onSuccess) {
        options.onSuccess(result);
      }

      return result;
    } catch (err: any) {
      const message = err?.message || 'Cloud storage upload failed';
      setError(message);
      options?.onError?.(err);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploadImage,
    uploadFile: uploadImage,
    uploading,
    isUploading: uploading,
    progress,
    error,
    reset: (..._args: any[]) => {
      setError(null);
      setProgress(0);
    }
  };
}
