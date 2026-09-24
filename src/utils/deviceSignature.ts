import { AttendanceDeviceSignature } from '../types';

export function getDeviceSignature(): AttendanceDeviceSignature {
  if (typeof window === 'undefined') {
    return {
      userAgent: 'Server',
      platform: 'Unknown',
      browser: 'Unknown',
      os: 'Unknown',
      screenResolution: 'Unknown',
      timezone: 'UTC',
      language: 'en',
    };
  }

  const nav = window.navigator;
  const screen = window.screen;
  const userAgent = nav.userAgent || '';

  // Detect browser
  let browser = 'Bilinmeyen Tarayıcı';
  if (userAgent.indexOf('Firefox') > -1) {
    browser = 'Mozilla Firefox';
  } else if (userAgent.indexOf('SamsungBrowser') > -1) {
    browser = 'Samsung Internet';
  } else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) {
    browser = 'Opera';
  } else if (userAgent.indexOf('Trident') > -1) {
    browser = 'Internet Explorer';
  } else if (userAgent.indexOf('Edge') > -1 || userAgent.indexOf('Edg') > -1) {
    browser = 'Microsoft Edge';
  } else if (userAgent.indexOf('Chrome') > -1) {
    browser = 'Google Chrome';
  } else if (userAgent.indexOf('Safari') > -1) {
    browser = 'Apple Safari';
  }

  // Detect OS
  let os = 'Bilinmeyen İşletim Sistemi';
  const platform = nav.platform || '';
  if (/iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && nav.maxTouchPoints > 1)) {
    os = 'iOS / iPadOS';
  } else if (/Android/.test(userAgent)) {
    os = 'Android';
  } else if (/Windows Phone/.test(userAgent)) {
    os = 'Windows Phone';
  } else if (/Win/.test(platform) || /Windows/.test(userAgent)) {
    os = 'Windows';
  } else if (/Mac/.test(platform) || /Macintosh/.test(userAgent)) {
    os = 'macOS';
  } else if (/Linux/.test(platform) || /Linux/.test(userAgent)) {
    os = 'Linux';
  }

  // Detect device type
  let deviceType = 'Masaüstü';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || (nav.maxTouchPoints && nav.maxTouchPoints > 2);
  if (isMobile) {
    deviceType = /iPad|tablet/i.test(userAgent) ? 'Tablet' : 'Mobil';
  }

  const screenResolution = `${screen.width || 0}x${screen.height || 0} (${screen.colorDepth || 24} bit)`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const language = nav.language || 'tr-TR';
  const hardwareConcurrency = nav.hardwareConcurrency ? `${nav.hardwareConcurrency} çekirdek` : undefined;
  const touchSupport = Boolean(nav.maxTouchPoints && nav.maxTouchPoints > 0);

  return {
    userAgent,
    platform: `${os} (${deviceType})`,
    browser,
    os,
    screenResolution,
    timezone,
    language,
    hardwareConcurrency,
    touchSupport,
  };
}

export function getGeolocation(): Promise<{
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude: number | null;
  error?: string;
}> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve({
        latitude: null,
        longitude: null,
        accuracy: null,
        altitude: null,
        error: 'Cihaz veya tarayıcı konum servisini desteklemiyor.',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
          altitude: position.coords.altitude ? Math.round(position.coords.altitude) : null,
        });
      },
      (err) => {
        let message = 'Konum bilgisi alınamadı.';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = 'Konum izni reddedildi. Lütfen tarayıcı izinlerinden konuma izin veriniz.';
            break;
          case err.POSITION_UNAVAILABLE:
            message = 'Konum bilgisi şu anda mevcut değil.';
            break;
          case err.TIMEOUT:
            message = 'Konum alma isteği zaman aşımına uğradı.';
            break;
        }
        resolve({
          latitude: null,
          longitude: null,
          accuracy: null,
          altitude: null,
          error: message,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}
