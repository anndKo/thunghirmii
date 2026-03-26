/**
 * Chat security utilities:
 * - Image validation & sanitization
 * - Link detection & blocking
 */

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

// Allowed extensions
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

/**
 * Validate image file: check type, extension, magic bytes
 */
export async function validateImageFile(file: File): Promise<{ valid: boolean; error?: string }> {
  // 1. Check MIME type
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { valid: false, error: 'Ảnh không hợp lệ hoặc không an toàn. Chỉ chấp nhận JPG, PNG, WebP.' };
  }

  // 2. Check extension
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: 'Ảnh không hợp lệ hoặc không an toàn. Định dạng file không được hỗ trợ.' };
  }

  // 3. Check magic bytes to detect disguised files
  const header = await readFileHeader(file, 12);
  if (!isValidImageHeader(header, file.type)) {
    return { valid: false, error: 'Ảnh không hợp lệ hoặc không an toàn. File có thể bị giả mạo.' };
  }

  // 4. Check for suspicious file name patterns
  const lowerName = file.name.toLowerCase();
  if (/\.(exe|bat|cmd|sh|ps1|vbs|js|html|php|py|pl|rb|jar|msi|scr|com|pif)\.?/i.test(lowerName)) {
    return { valid: false, error: 'Ảnh không hợp lệ hoặc không an toàn.' };
  }

  return { valid: true };
}

function readFileHeader(file: File, bytes: number): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.onerror = () => resolve(new Uint8Array(0));
    reader.readAsArrayBuffer(file.slice(0, bytes));
  });
}

function isValidImageHeader(header: Uint8Array, mimeType: string): boolean {
  if (header.length < 4) return false;

  // JPEG: FF D8 FF
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
  }

  // PNG: 89 50 4E 47
  if (mimeType === 'image/png') {
    return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
  }

  // WebP: RIFF....WEBP
  if (mimeType === 'image/webp') {
    return header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
           header.length >= 12 && header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;
  }

  return false;
}

/**
 * Re-encode image through canvas to strip metadata and sanitize
 */
export function sanitizeImage(file: File, maxWidth = 1600, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    if (file.type === 'image/gif') {
      resolve(file);
      return;
    }

    const TARGET_MAX_KB = 500;
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      // Re-draw strips all metadata (EXIF, GPS, etc.)
      ctx.drawImage(img, 0, 0, width, height);

      const tryCompress = (q: number, attempt: number) => {
        // Use webp for better compression if supported, fallback to jpeg
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          const sizeKB = blob.size / 1024;

          if ((sizeKB <= TARGET_MAX_KB) || attempt >= 4 || q < 0.3) {
            const ext = outputType === 'image/png' ? 'png' : 'jpg';
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: outputType }));
            return;
          }

          if (sizeKB > TARGET_MAX_KB) {
            tryCompress(q * 0.7, attempt + 1);
          } else {
            const ext = outputType === 'image/png' ? 'png' : 'jpg';
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: outputType }));
          }
        }, outputType, q);
      };

      tryCompress(quality, 0);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Detect links in message text. Returns true if link found.
 */
export function containsLink(text: string): boolean {
  const normalized = text.toLowerCase();

  // Standard URL patterns
  if (/https?:\/\//i.test(text)) return true;
  if (/www\./i.test(text)) return true;

  // Domain patterns (.com, .net, .org, .vn, .io, etc.)
  if (/\b\S+\.(com|net|org|vn|io|co|info|biz|me|tv|cc|xyz|online|site|app|dev|tech|store|shop)\b/i.test(text)) return true;

  // Shortened URL services
  if (/\b(bit\.ly|tinyurl|goo\.gl|t\.co|is\.gd|buff\.ly|ow\.ly|rebrand\.ly|short\.io|cutt\.ly)\b/i.test(text)) return true;

  // Obfuscated patterns
  // "h t t p" with spaces
  if (/h\s+t\s+t\s+p/i.test(normalized)) return true;

  // "dot com" style
  if (/\bdot\s*(com|net|org|vn|io)\b/i.test(normalized)) return true;

  // "[dot]com" or "(dot)com"
  if (/[\[\(]dot[\]\)]\s*(com|net|org|vn|io)/i.test(normalized)) return true;

  // "hxxp" obfuscation
  if (/hxxps?:\/\//i.test(text)) return true;

  return false;
}

/**
 * Check if text is an internal system message (payment box, room request, etc.)
 * These are allowed to contain URLs.
 */
export function isSystemMessage(text: string): boolean {
  return text.startsWith('YÊU CẦU THUÊ PHÒNG') ||
         text.startsWith('HỘP THANH TOÁN') ||
         text.startsWith('HỘP ĐẶT CỌC') ||
         /^https?:\/\/.*\.(jpg|jpeg|png|webp|gif|mp4|mov|avi|webm)(\?.*)?$/i.test(text.trim());
}
