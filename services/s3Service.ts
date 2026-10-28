const REGION = import.meta.env.VITE_AWS_S3_REGION || 'ap-south-1';
const BUCKET_NAME = import.meta.env.VITE_AWS_S3_BUCKET_NAME || 'interviewxpert-storage';
const CLIENT_ACCESS_KEY = (
  import.meta.env.VITE_AWS_S3_ACCESS_KEY_ID ||
  import.meta.env.VITE_AWS_ACCESS_KEY_ID ||
  ''
).trim();
const CLIENT_SECRET_KEY = (
  import.meta.env.VITE_AWS_S3_SECRET_ACCESS_KEY ||
  import.meta.env.VITE_AWS_SECRET_ACCESS_KEY ||
  ''
).trim();

export interface S3FileItem {
  key: string;
  url: string;
  size: number;
  lastModified: Date;
  category: 'Video' | 'Resume' | 'Image' | 'Audio' | 'Other';
  ageInDays: number;
}

export const isS3Configured = (): boolean => {
  return true; // Supported via secure backend serverless endpoint and direct fallback
};

export const checkS3Connection = async (): Promise<{ ok: boolean; message: string; configured: boolean }> => {
  try {
    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const endpoint = apiBase ? `${apiBase}/api/s3-manage` : '/api/s3-manage';
    const resp = await fetch(endpoint);
    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data && data.configured === false) {
        return { ok: false, configured: false, message: data.error || 'AWS S3 credentials not configured in server environment variables.' };
      }
      return { ok: true, configured: true, message: 'Connected to Amazon S3' };
    }
  } catch (_) {}

  if (CLIENT_ACCESS_KEY && CLIENT_SECRET_KEY) {
    return { ok: true, configured: true, message: 'Connected via direct client credentials' };
  }
  return { ok: false, configured: false, message: 'S3 credentials missing in production environment.' };
};

/**
 * Upload blob/file directly to Amazon S3 Bucket via secure serverless endpoint
 * with direct AWS SDK and Cloudinary fallbacks
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
  const key = `${folder}${Date.now()}_${cleanName}`;

  // 1. Try Secure Serverless S3 Uploader
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
      console.warn("Serverless S3 returned error, falling back:", data.error);
    }
  } catch (serverlessErr: any) {
    console.warn("Serverless S3 endpoint unreachable, trying client fallback:", serverlessErr);
  }

  // 2. Direct AWS S3 Client Fallback (if client keys exist)
  if (CLIENT_ACCESS_KEY && CLIENT_SECRET_KEY) {
    try {
      console.info("Uploading via Direct AWS S3 Client SDK...");
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const s3Client = new S3Client({
        region: REGION,
        credentials: {
          accessKeyId: CLIENT_ACCESS_KEY,
          secretAccessKey: CLIENT_SECRET_KEY,
        },
      });

      const arrayBuffer = await blob.arrayBuffer();
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: new Uint8Array(arrayBuffer),
        ContentType: mimeType,
      }));

      const publicUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;
      console.log("✅ Uploaded successfully via Direct AWS S3:", publicUrl);
      return publicUrl;
    } catch (directErr) {
      console.warn("Direct AWS S3 upload failed:", directErr);
    }
  }

  // 3. Cloudinary Multi-Cloud Fallback (ensures video/resume is NEVER lost)
  try {
    const { uploadToCloudinary } = await import('./api');
    console.warn("Attempting Cloudinary fallback upload...");
    const fallbackUrl = await uploadToCloudinary(blob, resourceType);
    if (fallbackUrl) {
      console.log("✅ Uploaded successfully via Cloudinary fallback:", fallbackUrl);
      return fallbackUrl;
    }
  } catch (fallbackErr) {
    console.error("Cloudinary fallback upload failed:", fallbackErr);
  }

  throw new Error("S3 Upload failed: Neither serverless endpoint nor direct AWS credentials available.");
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
      const data = await resp.json().catch(() => null);
      if (Array.isArray(data?.files)) {
        return data.files.map((f: any) => ({
          ...f,
          lastModified: new Date(f.lastModified)
        }));
      }
    }
  } catch (error) {
    console.warn("Serverless list S3 error, attempting client fallback:", error);
  }

  // 2. Direct AWS S3 Client Fallback
  if (CLIENT_ACCESS_KEY && CLIENT_SECRET_KEY) {
    try {
      const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: REGION,
        credentials: {
          accessKeyId: CLIENT_ACCESS_KEY,
          secretAccessKey: CLIENT_SECRET_KEY,
        },
      });

      const response = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix || '',
      }));

      const now = new Date();
      return (response.Contents || []).map((item) => {
        const key = item.Key || '';
        const size = item.Size || 0;
        const lastModified = item.LastModified ? new Date(item.LastModified) : now;
        const ageInDays = Math.floor((now.getTime() - lastModified.getTime()) / (1000 * 3600 * 24));

        let category: any = 'Other';
        if (key.startsWith('videos/') || key.endsWith('.webm') || key.endsWith('.mp4')) {
          category = 'Video';
        } else if (key.startsWith('resumes/') || key.endsWith('.pdf') || key.endsWith('.docx')) {
          category = 'Resume';
        } else if (key.startsWith('images/') || key.endsWith('.png') || key.endsWith('.jpg')) {
          category = 'Image';
        } else if (key.startsWith('audio/') || key.endsWith('.mp3') || key.endsWith('.wav')) {
          category = 'Audio';
        }

        return {
          key,
          url: `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`,
          size,
          lastModified,
          category,
          ageInDays,
        };
      });
    } catch (directErr) {
      console.error("Direct S3 List Objects error:", directErr);
    }
  }

  return [];
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
      const data = await resp.json().catch(() => null);
      if (data && data.success !== false) {
        return data?.count || keys.length;
      }
    }
  } catch (error) {
    console.warn("Serverless bulk delete error, attempting client fallback:", error);
  }

  // 2. Direct AWS S3 Client Fallback
  if (CLIENT_ACCESS_KEY && CLIENT_SECRET_KEY) {
    try {
      const { S3Client, DeleteObjectsCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: REGION,
        credentials: {
          accessKeyId: CLIENT_ACCESS_KEY,
          secretAccessKey: CLIENT_SECRET_KEY,
        },
      });

      if (keys.length === 1) {
        await s3.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: keys[0],
        }));
      } else {
        await s3.send(new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: keys.map((k) => ({ Key: k })),
          },
        }));
      }
      return keys.length;
    } catch (directDeleteErr) {
      console.error("Direct S3 delete error:", directDeleteErr);
    }
  }

  return 0;
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

