// Convert number to Vietnamese text (đọc số tiền bằng chữ tiếng Việt)

const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function readThreeDigits(n: number): string {
  if (n === 0) return '';
  
  const hundred = Math.floor(n / 100);
  const ten = Math.floor((n % 100) / 10);
  const one = n % 10;
  
  let result = '';
  
  if (hundred > 0) {
    result += ones[hundred] + ' trăm';
    if (ten === 0 && one > 0) {
      result += ' lẻ';
    }
  }
  
  if (ten > 1) {
    result += ' ' + ones[ten] + ' mươi';
    if (one === 1) {
      result += ' mốt';
    } else if (one === 4) {
      result += ' tư';
    } else if (one === 5) {
      result += ' lăm';
    } else if (one > 0) {
      result += ' ' + ones[one];
    }
  } else if (ten === 1) {
    result += ' mười';
    if (one === 5) {
      result += ' lăm';
    } else if (one > 0) {
      result += ' ' + ones[one];
    }
  } else if (one > 0) {
    result += ' ' + ones[one];
  }
  
  return result.trim();
}

export function numberToVietnamese(num: number | string): string {
  const n = typeof num === 'string' ? parseInt(num.replace(/[^\d]/g, ''), 10) : num;
  
  if (isNaN(n) || n === 0) return '';
  if (n < 0) return 'âm ' + numberToVietnamese(-n);
  
  // Split into groups of 3 digits from right
  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const text = readThreeDigits(groups[i]);
    if (text) {
      parts.push(text + (units[i] ? ' ' + units[i] : ''));
    }
  }
  
  if (parts.length === 0) return '';
  
  // Capitalize first letter
  const result = parts.join(' ') + ' đồng';
  return result.charAt(0).toUpperCase() + result.slice(1);
}
