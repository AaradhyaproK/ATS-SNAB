const REGION = import.meta.env.VITE_AWS_S3_REGION || 'ap-south-1';
const BUCKET_NAME = import.meta.env.VITE_AWS_S3_BUCKET_NAME || 'interviewxpert-storage';

export interface S3FileItem {
  key: string;
  url: string;
  size: number;
  lastModified: Date;
  category: 'Video' | 'Resume' | 'Image' | 'Audio' | 'Other';
  ageInDays: number;
}

export const isS3Configured = (): boolean => {
  return true; // Supported via secure backend serverless endpoint
};

/**
 * Upload blob/file directly to Amazon S3 Bucket via secure serverless endpoint
 * (Zero AWS credentials in client browser)
 */
export const uploadToS3 = async (
  blob: Blob | File,
  resourceType: 'video' | 'image' | 'auto' | 'raw' = 'auto',
  customFileName?: string
): Promise<string> => {
  const mimeType = blob.type || (resourceType === 'video' ? 'video/webm' : 'application/pdf');
  let folder = 'documents/';
  
  if (resourceType === 'video' || mimeType.startsWith('video/')) {
    folder = 'videos/';
  } else if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('officedocument') || mimeType.includes('text') || resourceType === 'raw' || (blob as File).name?.match(/\.(pdf|docx?|txt)$/i)) {
    folder = 'resumes/';
  } else if (mimeType.startsWith('image/')) {
    folder = 'images/';
  } else if (mimeType.startsWith('audio/')) {
    folder = 'audio/';
  }

  const fileExtension = mimeType.split('/')[1]?.split(';')[0] || (resourceType === 'video' ? 'webm' : 'pdf');
  const baseName = customFileName || (blob as File).name || `file_${Date.now()}.${fileExtension}`;
  const cleanName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Secure Serverless S3 Uploader (zero client secrets)
  try {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const endpoint = apiBase ? `${apiBase}/api/upload-s3` : '/api/upload-s3';

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Data,
        fileName: cleanName,
        mimeType,
        folder
      })
    });

    const data = await resp.json().catch(() => null);

    if (resp.ok && data?.url) {
      console.log("✅ Uploaded successfully via Serverless S3:", data.url);
      return data.url;
    }

    if (data?.error) {
      throw new Error(data.error);
    }
  } catch (serverlessErr: any) {
    console.error("Serverless S3 Upload Error:", serverlessErr);
    throw serverlessErr;
  }

  throw new Error("S3 Upload failed: Serverless upload endpoint unavailable.");
};


/**
 * List all objects stored in S3 Bucket with categorization & age calculation
 */
export const listS3Objects = async (prefix?: string): Promise<S3FileItem[]> => {
  // 1. Try secure Serverless S3 Manager (zero client secrets)
  try {
    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const endpoint = apiBase ? `${apiBase}/api/s3-manage` : '/api/s3-manage';

    const resp = await fetch(prefix ? `${endpoint}?prefix=${encodeURIComponent(prefix)}` : endpoint);
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data?.files)) {
        return data.files.map((f: any) => ({
          ...f,
          lastModified: new Date(f.lastModified)
        }));
      }
    }
    return [];
  } catch (error) {
    console.error("Error listing Amazon S3 objects via backend:", error);
    return [];
  }
};

/**
 * Delete a single file from Amazon S3
 */
export const deleteS3Object = async (key: string): Promise<boolean> => {
  return (await deleteS3Objects([key])) > 0;
};

/**
 * Delete multiple files from Amazon S3 via secure serverless endpoint
 */
export const deleteS3Objects = async (keys: string[]): Promise<number> => {
  if (keys.length === 0) return 0;

  try {
    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const endpoint = apiBase ? `${apiBase}/api/s3-manage` : '/api/s3-manage';

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', keys })
    });

    if (resp.ok) {
      const data = await resp.json();
      return data?.count || keys.length;
    }
    return 0;
  } catch (error) {
    console.error("Error bulk deleting S3 objects via backend:", error);
    return 0;
  }
};
/**
 * Extract S3 Object Key from a full Amazon S3 URL
 */
export const extractS3KeyFromUrl = (url?: string): string | null => {
  if (!url || typeof url !== 'string') return null;

  try {
    // Pattern 1: https://bucket-name.s3.region.amazonaws.com/key/path
    if (url.includes('.amazonaws.com/')) {
      const parts = url.split('.amazonaws.com/');
      if (parts[1]) {
        return decodeURIComponent(parts[1].split('?')[0]);
      }
    }

    // Pattern 2: https://s3.region.amazonaws.com/bucket-name/key/path
    if (url.includes('s3.') && url.includes('.com/')) {
      const afterDomain = url.split('.com/')[1];
      if (afterDomain) {
        const segments = afterDomain.split('/');
        if (segments[0] === BUCKET_NAME) {
          return decodeURIComponent(segments.slice(1).join('/').split('?')[0]);
        }
        return decodeURIComponent(afterDomain.split('?')[0]);
      }
    }

    // Pattern 3: Direct key (e.g. resumes/123_abc.pdf)
    if (url.startsWith('resumes/') || url.startsWith('videos/') || url.startsWith('documents/') || url.startsWith('images/')) {
      return url;
    }
  } catch (err) {
    console.error("Error parsing S3 URL key:", err);
  }

  return null;
};

/**
 * Delete a file from Amazon S3 by URL or Key
 */
export const deleteFileFromS3ByUrl = async (fileUrl?: string): Promise<boolean> => {
  if (!fileUrl) return false;
  const key = extractS3KeyFromUrl(fileUrl);
  if (!key) {
    console.warn("[S3 Delete] Could not extract valid S3 key from URL:", fileUrl);
    return false;
  }
  console.log(`[S3 Delete] Deleting object key "${key}" from S3 Bucket "${BUCKET_NAME}"...`);
  return await deleteS3Object(key);
};

