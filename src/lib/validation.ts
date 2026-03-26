import { z } from 'zod';

// Validation schemas cho payment forms
export const paymentInfoSchema = z.object({
  bankName: z.string()
    .trim()
    .min(1, 'Tên ngân hàng không được để trống')
    .max(100, 'Tên ngân hàng không được quá 100 ký tự')
    .regex(/^[a-zA-Z0-9\s\u00C0-\u024F\u1E00-\u1EFF]+$/, 'Tên ngân hàng chứa ký tự không hợp lệ'),
  
  accountNumber: z.string()
    .trim()
    .min(1, 'Số tài khoản không được để trống')
    .max(30, 'Số tài khoản không được quá 30 ký tự')
    .regex(/^[0-9]+$/, 'Số tài khoản chỉ được chứa số'),
  
  accountHolder: z.string()
    .trim()
    .min(1, 'Tên chủ tài khoản không được để trống')
    .max(100, 'Tên chủ tài khoản không được quá 100 ký tự')
    .regex(/^[A-Z0-9\s\u00C0-\u024F\u1E00-\u1EFF]+$/, 'Tên chủ tài khoản chứa ký tự không hợp lệ')
    .transform(val => val.toUpperCase()),
  
  dueDay: z.string()
    .trim()
    .regex(/^[0-9]+$/, 'Ngày đáo hạn chỉ được chứa số')
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 31, 'Ngày đáo hạn từ 1-31'),
});

export const depositInfoSchema = z.object({
  bankName: z.string()
    .trim()
    .min(1, 'Tên ngân hàng không được để trống')
    .max(100, 'Tên ngân hàng không được quá 100 ký tự')
    .regex(/^[a-zA-Z0-9\s\u00C0-\u024F\u1E00-\u1EFF]+$/, 'Tên ngân hàng chứa ký tự không hợp lệ'),
  
  accountNumber: z.string()
    .trim()
    .min(1, 'Số tài khoản không được để trống')
    .max(30, 'Số tài khoản không được quá 30 ký tự')
    .regex(/^[0-9]+$/, 'Số tài khoản chỉ được chứa số'),
  
  accountHolder: z.string()
    .trim()
    .min(1, 'Tên chủ tài khoản không được để trống')
    .max(100, 'Tên chủ tài khoản không được quá 100 ký tự')
    .regex(/^[A-Z0-9\s\u00C0-\u024F\u1E00-\u1EFF]+$/, 'Tên chủ tài khoản chứa ký tự không hợp lệ')
    .transform(val => val.toUpperCase()),
  
  amount: z.string()
    .trim()
    .min(1, 'Số tiền không được để trống')
    .regex(/^[0-9,.]+$/, 'Số tiền chỉ được chứa số, dấu phẩy và dấu chấm')
    .transform(val => val.replace(/[,.]/g, ''))
    .refine(val => parseFloat(val) >= 100000, 'Số tiền tối thiểu 100,000 VNĐ'),
  
  transferContent: z.string()
    .trim()
    .max(500, 'Nội dung chuyển khoản không được quá 500 ký tự')
    .optional()
    .transform(val => val || undefined),
});

export const amountSchema = z.string()
  .trim()
  .regex(/^[0-9,.]+$/, 'Số tiền chỉ được chứa số, dấu phẩy và dấu chấm')
  .transform(val => val.replace(/[,.]/g, ''))
  .refine(val => parseFloat(val) >= 0, 'Số tiền phải lớn hơn 0')
  .optional();

export const noteSchema = z.string()
  .trim()
  .max(1000, 'Ghi chú không được quá 1000 ký tự')
  .optional()
  .transform(val => val || undefined);

// Utility functions
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  // Remove HTML tags
  const withoutHtml = input.replace(/<[^>]*>/g, '');
  
  // Remove potentially dangerous characters
  const sanitized = withoutHtml.replace(/[<>'"&\\/]/g, '');
  
  // Trim whitespace
  return sanitized.trim();
};

export const maskPhoneNumber = (phone: string): string => {
  if (!phone || phone.length < 4) return phone;
  
  // Mask middle digits: 0123456789 -> 012***6789
  const start = phone.slice(0, 3);
  const end = phone.slice(-4);
  const masked = '*'.repeat(Math.max(0, phone.length - 7));
  
  return start + masked + end;
};

export const validateFileUpload = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Chỉ được tải lên file hình ảnh' };
  }
  
  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File không được lớn hơn 5MB' };
  }
  
  // Check file name
  if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
    return { valid: false, error: 'Tên file chứa ký tự không hợp lệ' };
  }
  
  return { valid: true };
};

// Rate limiting helper
const rateLimitMap = new Map<string, { count: number; lastAttempt: number }>();

export const checkRateLimit = (key: string, maxAttempts: number = 5, windowMs: number = 60000): boolean => {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record) {
    rateLimitMap.set(key, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Reset if window expired
  if (now - record.lastAttempt > windowMs) {
    rateLimitMap.set(key, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Check if limit exceeded
  if (record.count >= maxAttempts) {
    return false;
  }
  
  // Increment count
  record.count++;
  record.lastAttempt = now;
  return true;
};

export const clearRateLimit = (key: string): void => {
  rateLimitMap.delete(key);
};