import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Smartphone, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  UserCheck, 
  Loader2, 
  ShieldAlert, 
  Compass, 
  Lock,
  RefreshCw,
  Info
} from 'lucide-react';
import { AttendanceRecord, AttendanceLocation, AttendanceDeviceSignature } from '../types';
import { getDeviceSignature, getGeolocation } from '../utils/deviceSignature';

interface AttendanceFormProps {
  questionId: string;
  sessionTitle?: string;
  pollStatus: 'open' | 'closed';
  attendanceExpiresAt?: number | null;
  attendanceSecondsLeft?: number | null;
  participantRecord?: AttendanceRecord | null;
  onSubmit: (data: {
    studentNumber: string;
    fullName: string;
    location: AttendanceLocation;
    deviceSignature: AttendanceDeviceSignature;
  }) => Promise<{ success: boolean; record?: AttendanceRecord; error?: string }>;
}

export const AttendanceForm: React.FC<AttendanceFormProps> = ({
  questionId,
  sessionTitle,
  pollStatus,
  attendanceExpiresAt,
  attendanceSecondsLeft,
  participantRecord,
  onSubmit,
}) => {
  const [studentNumber, setStudentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localRecord, setLocalRecord] = useState<AttendanceRecord | null>(participantRecord || null);

  // Geolocation & Device signature state
  const [locationData, setLocationData] = useState<AttendanceLocation | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [deviceSig, setDeviceSig] = useState<AttendanceDeviceSignature | null>(null);

  // 90-second countdown calculation
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (attendanceExpiresAt) {
      return Math.max(0, Math.ceil((attendanceExpiresAt - Date.now()) / 1000));
    }
    return attendanceSecondsLeft !== undefined && attendanceSecondsLeft !== null ? attendanceSecondsLeft : 90;
  });

  // Track if timer ran out
  const isTimeExpired = secondsRemaining <= 0 || pollStatus === 'closed';

  // Sync participant record from parent
  useEffect(() => {
    if (participantRecord) {
      setLocalRecord(participantRecord);
    }
  }, [participantRecord]);

  // Gather device signature on mount
  useEffect(() => {
    const signature = getDeviceSignature();
    setDeviceSig(signature);
  }, []);

  // Gather Geolocation on mount
  const requestLocation = async () => {
    setIsLocating(true);
    setLocationError(null);
    try {
      const geo = await getGeolocation();
      const loc: AttendanceLocation = {
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy: geo.accuracy,
        altitude: geo.altitude,
        capturedAt: new Date().toISOString(),
      };
      setLocationData(loc);
      if (geo.error) {
        setLocationError(geo.error);
      }
    } catch (err: any) {
      setLocationError(err?.message || 'Konum alınırken bir hata oluştu.');
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  // Real-time timer countdown
  useEffect(() => {
    const calculateSeconds = () => {
      if (attendanceExpiresAt) {
        const left = Math.max(0, Math.ceil((attendanceExpiresAt - Date.now()) / 1000));
        setSecondsRemaining(left);
      } else if (attendanceSecondsLeft !== undefined && attendanceSecondsLeft !== null) {
        setSecondsRemaining(attendanceSecondsLeft);
      }
    };

    calculateSeconds();
    const interval = setInterval(calculateSeconds, 1000);
    return () => clearInterval(interval);
  }, [attendanceExpiresAt, attendanceSecondsLeft]);

  // Calculate progress percentage (out of 90 seconds)
  const progressPercent = Math.min(100, Math.max(0, (secondsRemaining / 90) * 100));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTimeExpired) {
      setSubmitError('Yoklama süresi dolmuştur. Gönderim yapılamaz.');
      return;
    }

    if (!studentNumber.trim()) {
      setSubmitError('Lütfen öğrenci numaranızı giriniz.');
      return;
    }

    if (!fullName.trim()) {
      setSubmitError('Lütfen ad ve soyadınızı giriniz.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const activeLocation: AttendanceLocation = locationData || {
      latitude: null,
      longitude: null,
      accuracy: null,
      altitude: null,
      capturedAt: new Date().toISOString(),
    };

    const activeSignature: AttendanceDeviceSignature = deviceSig || getDeviceSignature();

    const res = await onSubmit({
      studentNumber: studentNumber.trim(),
      fullName: fullName.trim(),
      location: activeLocation,
      deviceSignature: activeSignature,
    });

    setIsSubmitting(false);

    if (res.success && res.record) {
      setLocalRecord(res.record);
    } else if (res.error) {
      setSubmitError(res.error);
    }
  };

  // State: Successfully submitted attendance record
  if (localRecord) {
    return (
      <div id="attendance-success-card" className="w-full max-w-xl mx-auto bg-white rounded-2xl border border-emerald-200 shadow-xl overflow-hidden p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-full uppercase tracking-wider mb-2">
            Yoklama Onaylandı
          </span>
          <h2 className="text-2xl font-bold text-slate-800">Yoklamanız Başarıyla Alındı</h2>
          <p className="text-sm text-slate-500 mt-1">
            Bilgileriniz ve cihaz imzanız sisteme güvenle işlenmiştir.
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 divide-y divide-slate-200/80 text-sm mb-6">
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-500 font-medium">Öğrenci No:</span>
            <span className="text-slate-900 font-bold tracking-wider">{localRecord.studentNumber}</span>
          </div>
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-500 font-medium">Ad Soyad:</span>
            <span className="text-slate-900 font-semibold">{localRecord.fullName}</span>
          </div>
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-500 font-medium">Kayıt Zamanı:</span>
            <span className="text-slate-700">
              {new Date(localRecord.submittedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <div className="py-2.5 flex justify-between items-start">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500 inline" /> Konum / GPS:
            </span>
            <span className="text-right text-slate-700 font-mono text-xs">
              {localRecord.location?.latitude && localRecord.location?.longitude ? (
                <>
                  {localRecord.location.latitude.toFixed(4)}°, {localRecord.location.longitude.toFixed(4)}°
                  {localRecord.location.accuracy && ` (±${localRecord.location.accuracy}m)`}
                </>
              ) : (
                <span className="text-slate-400 italic">Konum izni verilmedi</span>
              )}
            </span>
          </div>
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-indigo-500 inline" /> Cihaz:
            </span>
            <span className="text-right text-slate-700 text-xs font-medium truncate max-w-[200px]">
              {localRecord.deviceSignature?.browser} • {localRecord.deviceSignature?.os}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-800">
          <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Bu oturum için yoklamanız tamamlanmıştır. Tekrar kayıt yapılmasına gerek yoktur.</span>
        </div>
      </div>
    );
  }

  // State: 90-second duration expired without submission
  if (isTimeExpired) {
    return (
      <div id="attendance-expired-card" className="w-full max-w-xl mx-auto bg-white rounded-2xl border border-amber-200 shadow-xl overflow-hidden p-6 sm:p-8 text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-9 h-9" />
        </div>
        <span className="inline-block px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold rounded-full uppercase tracking-wider mb-2">
          Süre Doldu
        </span>
        <h2 className="text-2xl font-bold text-slate-800">Yoklama Süresi Tamamlandı</h2>
        <p className="text-slate-600 text-sm mt-2 max-w-md mx-auto">
          Bu soru tipi için tanımlanan 90 saniyelik yoklama periyodu sona ermiştir. Şu anda yeni yoklama girişi kabul edilmemektedir.
        </p>

        <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-left flex items-start gap-3">
          <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-slate-700">Bilgilendirme:</p>
            <p className="mt-0.5">Yönetici oturum içerisinde yoklamayı tekrar başlattığında bu ekran otomatik olarak açılacaktır.</p>
          </div>
        </div>
      </div>
    );
  }

  // State: Active 90-second Attendance Form
  return (
    <div id="attendance-active-form-card" className="w-full max-w-xl mx-auto bg-white rounded-2xl border border-indigo-200 shadow-xl overflow-hidden">
      {/* Top Banner: 90-Second Urgent Timer Bar */}
      <div className={`p-4 text-white transition-colors duration-300 ${
        secondsRemaining <= 15 
          ? 'bg-rose-600 animate-pulse' 
          : secondsRemaining <= 30 
          ? 'bg-amber-600' 
          : 'bg-indigo-600'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider block opacity-90">Canlı Yoklama Periyodu</span>
              <span className="text-sm font-bold">Lütfen bilgilerinizi onaylayınız</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black font-mono tracking-tight">{secondsRemaining}s</span>
            <span className="text-xs block opacity-85">Kalan Süre</span>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-black/20 rounded-full h-2 mt-3 overflow-hidden">
          <div 
            className="h-full bg-white transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md border border-indigo-100">
              Varsayılan Yoklama Sorusu
            </span>
            <span className="text-xs text-slate-500 font-medium">90 Saniye Kısıtlı</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            Resmi Ders & Oturum Yoklaması
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Öğrenci numaranızı ve ad soyadınızı giriniz. Doğrulama için coğrafi konum (Lat-Long) ve cihaz imzanız otomatik olarak kaydedilir.
          </p>
        </div>

        {submitError && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{submitError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Student Number Input */}
          <div>
            <label htmlFor="input-student-number" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Öğrenci Numarası <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-student-number"
              type="text"
              required
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              placeholder="Örn: 2024010892"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium tracking-wide transition-all"
              autoFocus
            />
          </div>

          {/* Full Name Input */}
          <div>
            <label htmlFor="input-student-fullname" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Ad Soyad <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-student-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Örn: Ahmet Yılmaz"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium transition-all"
            />
          </div>

          {/* Geofencing / Lat-Long Status Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Compass className={`w-4 h-4 ${isLocating ? 'animate-spin text-indigo-500' : 'text-emerald-600'}`} />
                Geofencing / Konum (Lat-Long)
              </span>
              <button
                type="button"
                id="btn-refresh-location"
                onClick={requestLocation}
                disabled={isLocating}
                className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                Yenile
              </button>
            </div>

            {isLocating ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>GPS uydularından hassas koordinatlar alınıyor...</span>
              </div>
            ) : locationData?.latitude && locationData?.longitude ? (
              <div className="text-xs text-emerald-800 bg-emerald-50/80 rounded-lg p-2 font-mono flex items-center justify-between border border-emerald-100">
                <span className="font-semibold">
                  {locationData.latitude.toFixed(5)}° N, {locationData.longitude.toFixed(5)}° E
                </span>
                <span className="text-[11px] text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                  ±{locationData.accuracy || 10}m Hassasiyet
                </span>
              </div>
            ) : (
              <div className="text-[11px] text-amber-700 bg-amber-50/80 rounded-lg p-2 border border-amber-200 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>{locationError || 'Konum bilgisi alınamadı (İsteğe bağlı veya izin verilmemiş).'}</span>
              </div>
            )}
          </div>

          {/* Device & Browser Signature Summary */}
          {deviceSig && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                <span>Cihaz / Tarayıcı İmzası:</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
                {deviceSig.browser} • {deviceSig.os} • {deviceSig.screenResolution} • {deviceSig.timezone}
              </p>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            id="btn-submit-attendance"
            disabled={isSubmitting || isTimeExpired}
            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Yoklama Kaydediliyor...</span>
              </>
            ) : (
              <>
                <UserCheck className="w-5 h-5" />
                <span>Yoklamamı Onayla ve Kaydet</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
