export interface GeoInfo {
  country: string;
  countryCode: string;
  city: string;
  flagUrl: string;
}

export function getCountryFlagUrl(countryCode: string): string {
  const code = (countryCode || 'UN').toLowerCase().trim();
  if (code.length === 2 && code !== 'un') {
    return `https://flagcdn.com/24x18/${code}.png`;
  }
  return 'https://flagcdn.com/24x18/un.png';
}

export function parseReferrer(rawReferrer: string): { source: string; label: string; icon: string } {
  if (!rawReferrer || rawReferrer === '' || rawReferrer.includes('Direct') || rawReferrer.includes('direct')) {
    return { source: 'direct', label: 'Direct Entry / URL', icon: '🔗' };
  }
  if (rawReferrer.includes('google')) {
    return { source: 'google', label: 'Google Search', icon: '🔍' };
  }
  if (rawReferrer.includes('linkedin')) {
    return { source: 'linkedin', label: 'LinkedIn B2B', icon: '💼' };
  }
  if (rawReferrer.includes('facebook') || rawReferrer.includes('fb')) {
    return { source: 'facebook', label: 'Facebook Ads', icon: '📱' };
  }
  if (rawReferrer.includes('twitter') || rawReferrer.includes('x.com')) {
    return { source: 'twitter', label: 'X (Twitter)', icon: '🐦' };
  }
  try {
    const url = new URL(rawReferrer);
    return { source: 'referral', label: url.hostname, icon: '🌐' };
  } catch {
    return { source: 'referral', label: rawReferrer, icon: '🌐' };
  }
}

const fallbackCountryNames: Record<string, string> = {
  'PK': 'Pakistan', 'US': 'United States', 'GB': 'United Kingdom', 'UK': 'United Kingdom',
  'IN': 'India', 'SA': 'Saudi Arabia', 'AE': 'United Arab Emirates', 'CA': 'Canada',
  'AU': 'Australia', 'DE': 'Germany', 'FR': 'France', 'TR': 'Turkey',
  'NG': 'Nigeria', 'EG': 'Egypt', 'BD': 'Bangladesh', 'MY': 'Malaysia',
  'SG': 'Singapore', 'NL': 'Netherlands', 'IT': 'Italy', 'ES': 'Spain',
  'BR': 'Brazil', 'ID': 'Indonesia', 'JP': 'Japan', 'KR': 'South Korea',
  'RU': 'Russia', 'MX': 'Mexico', 'ZA': 'South Africa', 'KE': 'Kenya',
  'CN': 'China', 'AF': 'Afghanistan', 'IR': 'Iran', 'IQ': 'Iraq',
  'JO': 'Jordan', 'KW': 'Kuwait', 'QA': 'Qatar', 'BH': 'Bahrain',
  'OM': 'Oman', 'YE': 'Yemen', 'LB': 'Lebanon', 'SY': 'Syria',
  'PH': 'Philippines', 'TH': 'Thailand', 'VN': 'Vietnam', 'NZ': 'New Zealand',
  'IE': 'Ireland', 'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland',
  'PL': 'Poland', 'CH': 'Switzerland', 'AT': 'Austria', 'BE': 'Belgium', 'PT': 'Portugal'
};

export function getCountryName(countryCode: string): string {
  if (!countryCode || countryCode === 'UN') return 'Unknown';
  const upper = countryCode.toUpperCase().trim();
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    const name = regionNames.of(upper);
    if (name) return name;
  } catch {}
  return fallbackCountryNames[upper] || upper;
}

export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const clean = ip.trim().toLowerCase();
  if (clean === '::1' || clean === '127.0.0.1' || clean === 'localhost') return true;
  if (clean.startsWith('10.')) return true;
  if (clean.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true;
  if (clean.startsWith('169.254.')) return true;
  if (clean.startsWith('fc00:') || clean.startsWith('fe80:')) return true;
  return false;
}

// Cache geo results to avoid repeated API calls for same IP
const geoCache = new Map<string, { country: string; countryCode: string; city: string; flag: string }>();

export interface EdgeGeoHints {
  countryCode?: string;
  city?: string;
  region?: string;
}

export async function lookupGeoAsync(
  ip: string,
  hints?: EdgeGeoHints
): Promise<{ country: string; countryCode: string; city: string; flag: string }> {
  const cleanIp = (ip || '').trim();

  // 1. If edge headers already provided reliable country AND city from Vercel / Cloudflare
  if (hints?.countryCode && hints.countryCode.length === 2 && hints.countryCode.toUpperCase() !== 'XX' && hints.city && hints.city.trim() !== '') {
    const code = hints.countryCode.toUpperCase();
    const country = getCountryName(code);
    const city = hints.city.trim();
    const result = {
      country,
      countryCode: code,
      city,
      flag: getCountryFlagUrl(code)
    };
    if (cleanIp && !isPrivateIp(cleanIp)) {
      geoCache.set(cleanIp, result);
    }
    return result;
  }

  // 2. Handle private / local IPs
  if (!cleanIp || isPrivateIp(cleanIp)) {
    return { country: 'Pakistan', countryCode: 'PK', city: 'Lahore', flag: getCountryFlagUrl('PK') };
  }

  // 3. Check memory cache
  if (geoCache.has(cleanIp)) {
    return geoCache.get(cleanIp)!;
  }

  // 4. Primary Provider: ip-api.com
  try {
    const response = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode,city,regionName`, {
      signal: AbortSignal.timeout(2500)
    });
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success' && data.countryCode) {
        const countryCode = data.countryCode as string;
        const city = (data.city && data.city !== '') ? data.city : (data.regionName || 'Unknown');
        const country = getCountryName(countryCode) || data.country || countryCode;
        const result = { country, countryCode, city, flag: getCountryFlagUrl(countryCode) };
        geoCache.set(cleanIp, result);
        return result;
      }
    }
  } catch (e) {
    console.error('[GEO] Provider 1 (ip-api) failed:', e);
  }

  // 5. Secondary Provider: ipwho.is
  try {
    const response = await fetch(`https://ipwho.is/${cleanIp}`, {
      signal: AbortSignal.timeout(2500)
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.country_code) {
        const countryCode = data.country_code as string;
        const city = data.city || data.region || 'Unknown';
        const country = getCountryName(countryCode) || data.country || countryCode;
        const result = { country, countryCode, city, flag: getCountryFlagUrl(countryCode) };
        geoCache.set(cleanIp, result);
        return result;
      }
    }
  } catch (e) {
    console.error('[GEO] Provider 2 (ipwho.is) failed:', e);
  }

  // 6. Tertiary Provider: freeipapi.com
  try {
    const response = await fetch(`https://freeipapi.com/api/json/${cleanIp}`, {
      signal: AbortSignal.timeout(2500)
    });
    if (response.ok) {
      const data = await response.json();
      if (data.countryCode) {
        const countryCode = data.countryCode as string;
        const city = data.cityName || 'Unknown';
        const country = getCountryName(countryCode) || data.countryName || countryCode;
        const result = { country, countryCode, city, flag: getCountryFlagUrl(countryCode) };
        geoCache.set(cleanIp, result);
        return result;
      }
    }
  } catch (e) {
    console.error('[GEO] Provider 3 (freeipapi) failed:', e);
  }

  // 7. Fallback to Edge Hints if providers failed or timed out
  if (hints?.countryCode && hints.countryCode.length === 2 && hints.countryCode.toUpperCase() !== 'XX') {
    const code = hints.countryCode.toUpperCase();
    const country = getCountryName(code);
    const city = (hints.city && hints.city.trim() !== '') ? hints.city.trim() : (hints.region || country);
    return { country, countryCode: code, city, flag: getCountryFlagUrl(code) };
  }

  const fallback = { country: 'Unknown', countryCode: 'UN', city: 'Unknown', flag: getCountryFlagUrl('UN') };
  return fallback;
}

// Synchronous version - kept for compatibility
export function lookupGeo(ip: string): { country: string; countryCode: string; city: string; flag: string } {
  if (!ip || isPrivateIp(ip)) {
    return { country: 'Pakistan', countryCode: 'PK', city: 'Lahore', flag: getCountryFlagUrl('PK') };
  }
  if (geoCache.has(ip)) {
    return geoCache.get(ip)!;
  }
  return { country: 'Loading...', countryCode: 'UN', city: 'Unknown', flag: getCountryFlagUrl('UN') };
}

