import React from 'react';
import { 
  Radio, 
  Archive,
  Calendar,
  Clock,
  Trophy,
  Shield,
  LogOut
} from 'lucide-react';
import { ParticipantProfile } from '../types';

interface HeaderProps {
  sessionCode: string;
  sessionTitle: string;
  sessionDate?: string;
  startTime?: string;
  endTime?: string;
  isArchived?: boolean;
  participantCount: number;
  pollStatus: 'open' | 'closed';
  isAdmin: boolean;
  viewMode: 'participant' | 'admin';
  profile: ParticipantProfile;
  sessionEnded?: boolean;
  onAdminLogout: () => void;
  onOpenProfileModal: () => void;
  onOpenLeaderboard: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sessionCode,
  sessionTitle,
  sessionDate,
  startTime,
  endTime,
  isArchived = false,
  participantCount,
  pollStatus,
  viewMode,
  profile,
  sessionEnded = false,
  onAdminLogout,
  onOpenProfileModal,
  onOpenLeaderboard,
}) => {
  return (
    <header id="main-app-header" className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Branding, Session Info & Live Status */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold text-sm sm:text-base shadow-xs shrink-0 ${
            isArchived ? 'bg-slate-700 text-white' : 'bg-blue-600 text-white'
          }`}>
            {isArchived ? (
              <Archive className="w-4 h-4" />
            ) : (
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-bold text-slate-900 text-xs sm:text-base truncate tracking-tight">
                {sessionTitle || 'İnteraktif Toplantı & Oylama'}
              </h1>
              {sessionCode && (
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  #{sessionCode}
                </span>
              )}
              {isArchived && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  <Archive className="w-2.5 h-2.5" />
                  <span>Arşivlendi</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block -ml-2.5" />
                {participantCount} {participantCount === 1 ? 'katılımcı' : 'katılımcı'}
              </span>

              {sessionDate && (
                <>
                  <span className="text-slate-300 hidden sm:inline">•</span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-slate-600">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{sessionDate}</span>
                  </span>
                </>
              )}

              {startTime && endTime && (
                <>
                  <span className="text-slate-300 hidden md:inline">•</span>
                  <span className="hidden md:inline-flex items-center gap-1 text-slate-600">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{startTime} - {endTime}</span>
                  </span>
                </>
              )}

              <span className="text-slate-300">•</span>
              <span className={
                isArchived
                  ? 'text-slate-600 font-medium'
                  : sessionEnded
                  ? 'text-purple-600 font-semibold'
                  : pollStatus === 'open'
                  ? 'text-blue-600 font-medium'
                  : 'text-amber-600 font-medium'
              }>
                {isArchived
                  ? 'Arşivde'
                  : sessionEnded
                  ? 'Oturum Tamamlandı'
                  : pollStatus === 'open'
                  ? 'Canlı Oylama Açık'
                  : 'Oylama Beklemede'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {viewMode === 'participant' ? (
            <>
              {/* Liderlik Tablosu Butonu: SADECE OTURUM BİTİRİLİNCE ÇIKAR */}
              {sessionEnded && !isArchived && (
                <button
                  id="header-leaderboard-button"
                  type="button"
                  onClick={onOpenLeaderboard}
                  className="inline-flex items-center gap-1.5 py-1.5 px-2.5 sm:px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl border border-amber-200 transition-colors shadow-2xs cursor-pointer animate-in fade-in"
                  title="Liderlik Tablosunu Görüntüle"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">Liderlik Tablosu</span>
                </button>
              )}

              {/* Katılımcı Anonim Avatar ve İsim Butonu: Aktifken sağ tarafta sadece bu buton kalır */}
              <button
                id="header-profile-button"
                type="button"
                onClick={onOpenProfileModal}
                className="inline-flex items-center gap-1.5 py-1.5 px-2.5 sm:px-3 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-semibold rounded-xl border border-purple-200 transition-colors shadow-2xs cursor-pointer"
                title="Anonim adınızı veya avatarınızı değiştirin"
              >
                <span className="text-base select-none">{profile.avatar}</span>
                <span className="max-w-[80px] sm:max-w-[130px] truncate">{profile.name}</span>
                <span className="text-[10px] text-purple-500">✏️</span>
              </button>
            </>
          ) : (
            /* Admin Ekranı Üst Başlık Butonları (Sadece /admin URL ile girildiğinde) */
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                <span>Yönetici Paneli</span>
              </span>

              <button
                id="header-admin-logout-btn"
                type="button"
                onClick={onAdminLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-bold rounded-xl border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                title="Yönetici oturumunu kapat ve katılımcı ekranına dön"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500 hover:text-rose-600" />
                <span>Çıkış Yap</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
