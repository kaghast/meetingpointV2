import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Smartphone, 
  Clock, 
  Download, 
  Search, 
  ExternalLink, 
  Play, 
  Square, 
  Users, 
  ShieldCheck, 
  Copy, 
  Check, 
  RefreshCw,
  Globe
} from 'lucide-react';
import { AttendanceRecord, MeetingSession } from '../types';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: MeetingSession | null;
  attendanceRecords: AttendanceRecord[];
  isAttendanceActive: boolean;
  attendanceSecondsLeft: number;
  onStartAttendance: (sessionId: string) => Promise<void>;
  onStopAttendance: (sessionId: string) => Promise<void>;
  onRefresh: () => void;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen,
  onClose,
  session,
  attendanceRecords,
  isAttendanceActive,
  attendanceSecondsLeft,
  onStartAttendance,
  onStopAttendance,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [isOperating, setIsOperating] = useState(false);

  if (!isOpen || !session) return null;

  // Filter records by session ID and search query
  const sessionRecords = attendanceRecords.filter((r) => r.sessionId === session.id);

  const filteredRecords = sessionRecords.filter((r) => {
    if (!searchTerm.trim()) return true;
    const query = searchTerm.toLowerCase().trim();
    return (
      r.studentNumber.toLowerCase().includes(query) ||
      r.fullName.toLowerCase().includes(query) ||
      (r.deviceSignature?.browser && r.deviceSignature.browser.toLowerCase().includes(query)) ||
      (r.deviceSignature?.os && r.deviceSignature.os.toLowerCase().includes(query))
    );
  });

  const withLocationCount = sessionRecords.filter((r) => r.location?.latitude && r.location?.longitude).length;

  const handleStart = async () => {
    setIsOperating(true);
    await onStartAttendance(session.id);
    setIsOperating(false);
  };

  const handleStop = async () => {
    setIsOperating(true);
    await onStopAttendance(session.id);
    setIsOperating(false);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (sessionRecords.length === 0) return;

    const headers = [
      'Sıra',
      'Öğrenci No',
      'Ad Soyad',
      'Kayıt Zamanı',
      'Enlem (Lat)',
      'Boylam (Long)',
      'Hassasiyet (m)',
      'Tarayıcı',
      'İşletim Sistemi',
      'Ekran',
      'IP Adresi'
    ];

    const rows = sessionRecords.map((r, i) => [
      i + 1,
      `"${r.studentNumber}"`,
      `"${r.fullName}"`,
      `"${new Date(r.submittedAt).toLocaleString('tr-TR')}"`,
      r.location?.latitude ?? '',
      r.location?.longitude ?? '',
      r.location?.accuracy ?? '',
      `"${r.deviceSignature?.browser || ''}"`,
      `"${r.deviceSignature?.os || ''}"`,
      `"${r.deviceSignature?.screenResolution || ''}"`,
      `"${r.deviceSignature?.ip || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Yoklama_${session.code}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy Tab-delimited (for Excel pasting)
  const handleCopyClipboard = () => {
    if (sessionRecords.length === 0) return;

    const textLines = [
      ['No', 'Öğrenci No', 'Ad Soyad', 'Saat', 'Konum (Lat, Long)', 'Cihaz'].join('\t'),
      ...sessionRecords.map((r, i) => [
        i + 1,
        r.studentNumber,
        r.fullName,
        new Date(r.submittedAt).toLocaleTimeString('tr-TR'),
        r.location?.latitude ? `${r.location.latitude}, ${r.location.longitude}` : 'Yok',
        `${r.deviceSignature?.browser || ''} / ${r.deviceSignature?.os || ''}`
      ].join('\t'))
    ].join('\n');

    navigator.clipboard.writeText(textLines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="admin-attendance-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Oturum Yoklama Verileri</h2>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md border border-indigo-100 font-mono">
                  {session.code}
                </span>
                {isAttendanceActive ? (
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Canlı Aktif ({attendanceSecondsLeft}s)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                    Pasif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{session.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              title="Yenile"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Controller Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-900 text-sm">{sessionRecords.length}</span>
              <span>Kayıtlı Katılımcı</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>{withLocationCount} GPS Onaylı</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {isAttendanceActive ? (
              <button
                id="btn-stop-attendance"
                onClick={handleStop}
                disabled={isOperating}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Yoklamayı Durdur</span>
              </button>
            ) : (
              <button
                id="btn-start-attendance"
                onClick={handleStart}
                disabled={isOperating || session.isArchived}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Yoklama Başlat (90sn)</span>
              </button>
            )}

            <button
              onClick={handleCopyClipboard}
              disabled={sessionRecords.length === 0}
              className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Excel formatında kopyala"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={sessionRecords.length === 0}
              className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV İndir</span>
            </button>
          </div>
        </div>

        {/* Search filter input */}
        <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Öğrenci no veya ad soyad ile filtrele..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Temizle
            </button>
          )}
        </div>

        {/* Attendance Records Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {sessionRecords.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Henüz yoklama kaydı bulunmuyor</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {isAttendanceActive 
                  ? 'Yoklama şu anda aktif (90 saniye). Katılımcılar formlarını doldurdukça buraya anlık yansıyacaktır.'
                  : 'Yoklama başlatmak için yukarıdaki «Yoklama Başlat (90sn)» butonuna basabilirsiniz.'}
              </p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Arama kriterinize uygun yoklama kaydı bulunamadı.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5 w-12 text-center">#</th>
                    <th className="py-3 px-4">Öğrenci No</th>
                    <th className="py-3 px-4">Ad Soyad</th>
                    <th className="py-3 px-4">Kayıt Saati</th>
                    <th className="py-3 px-4">Konum (Lat-Long / Geofencing)</th>
                    <th className="py-3 px-4">Cihaz & Tarayıcı İmza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRecords.map((rec, index) => {
                    const hasCoords = rec.location?.latitude && rec.location?.longitude;
                    const mapsUrl = hasCoords 
                      ? `https://www.google.com/maps?q=${rec.location.latitude},${rec.location.longitude}`
                      : null;

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 text-center text-slate-400 font-mono">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono tracking-wider">
                          {rec.studentNumber}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {rec.fullName}
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(rec.submittedAt).toLocaleTimeString('tr-TR', { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            second: '2-digit' 
                          })}
                        </td>
                        <td className="py-3 px-4">
                          {hasCoords ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-700 text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {rec.location.latitude?.toFixed(4)}°, {rec.location.longitude?.toFixed(4)}°
                                {rec.location.accuracy && ` (±${rec.location.accuracy}m)`}
                              </span>
                              {mapsUrl && (
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded"
                                  title="Haritada Göster"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">İzin verilmedi</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500">
                          <div className="truncate max-w-[220px]" title={rec.deviceSignature?.userAgent}>
                            <span className="font-medium text-slate-700">
                              {rec.deviceSignature?.browser || 'Tarayıcı'}
                            </span>
                            {rec.deviceSignature?.os && ` • ${rec.deviceSignature.os}`}
                            {rec.deviceSignature?.ip && ` (${rec.deviceSignature.ip})`}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Toplam {sessionRecords.length} yoklama kaydı</span>
          <span className="text-[11px] text-slate-400">90 saniye otomatik durdurma kuralı aktiftir</span>
        </div>
      </div>
    </div>
  );
};
