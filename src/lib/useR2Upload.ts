import { useState } from 'react';

interface UploadOptions {
  onSuccess?: (publicUrl: string, fileKey: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to securely upload files directly to Cloudflare R2 using presigned URLs.
 */
export function useR2Upload(options?: UploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setProgress(0);

    try {
      // 1. Convert File to Base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });

      setProgress(50);

      // 2. Upload Base64 to backend
      const response = await fetch('http://localhost:5000/api/upload-base64', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          contentType: file.type,
          originalFilename: file.name,
          base64Data,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to upload file to server');
      }

      const { data } = await response.json();
      const { fileKey, publicUrl } = data;

      setProgress(100);
      options?.onSuccess?.(publicUrl, fileKey);
      
      return { publicUrl, fileKey };
    } catch (error) {
      options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadFile,
    isUploading,
    progress,
  };
}
