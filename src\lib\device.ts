export interface DeviceInfo {
  browser: string;
  os: string;
  device: 'Mobile' | 'Desktop' | 'Tablet';
}

export function parseUserAgent(ua: string): DeviceInfo {
  const lower = ua.toLowerCase();

  let os = 'Windows';
  if (lower.includes('android')) os = 'Android';
  else if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('ipod')) os = 'iOS';
  else if (lower.includes('macintosh') || lower.includes('mac os')) os = 'macOS';
  else if (lower.includes('linux')) os = 'Linux';

  let browser = 'Chrome';
  if (lower.includes('safari') && !lower.includes('chrome') && !lower.includes('chromium')) browser = 'Safari';
  else if (lower.includes('firefox')) browser = 'Firefox';
  else if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('opera') || lower.includes('opr/')) browser = 'Opera';

  let device: 'Mobile' | 'Desktop' | 'Tablet' = 'Desktop';
  if (lower.includes('tablet') || lower.includes('ipad')) device = 'Tablet';
  else if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) device = 'Mobile';

  return { browser, os, device };
}
