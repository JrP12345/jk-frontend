import { useState } from 'react';
import { API_URL } from './api';

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

      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") || localStorage.getItem("token") || "" : "";
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/upload-base64`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contentType: file.type || 'image/png',
          originalFilename: file.name,
          base64Data: base64,
          base64,
          fileName,
          folder: 'healthos',
        }),
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Upload failed');
      }

      setProgress(100);
      const url = data.data.url || data.data.publicUrl || '';
      const result: UploadResult = {
        url,
        publicUrl: url,
        key: data.data.key || fileName,
      };

      if (options?.onSuccess) {
        options.onSuccess(result);
      }

      return result;
    } catch (err: any) {
      console.warn('R2 cloud upload unconfigured/failed, using local base64 data URL fallback');
      setProgress(100);
      const base64Url = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const fallbackResult: UploadResult = {
        url: base64Url,
        publicUrl: base64Url,
        key: file.name,
      };
      if (options?.onSuccess) {
        options.onSuccess(fallbackResult);
      }
      return fallbackResult;
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
