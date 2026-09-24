import React, { useState } from 'react';
import { Trophy, Zap, X, Award, Medal, CheckCircle2, User } from 'lucide-react';
import { LeaderboardEntry } from '../types';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaderboard: LeaderboardEntry[];
  currentParticipantId: string;
  isSessionEnded?: boolean;
  sessionTitle?: string;
  sessionCode?: string;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  leaderboard = [],
  currentParticipantId,
  isSessionEnded = false,
  sessionTitle,
  sessionCode,
}) => {
  const [rankingMode, setRankingMode] = useState<'points' | 'activity'>('points');

  if (!isOpen) return null;

  // Sort by points or by activity
  const sortedEntries = [...leaderboard].sort((a, b) => {
    if (rankingMode === 'points') {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return b.questionsAnswered - a.questionsAnswered;
    } else {
      if (b.questionsAnswered !== a.questionsAnswered) {
        return b.questionsAnswered - a.questionsAnswered;
      }
      return b.totalPoints - a.totalPoints;
    }
  });

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center font-bold text-sm shadow-xs">
          🥇
        </span>
      );
    }
    if (index === 1) {
      return (
        <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 border border-slate-300 flex items-center justify-center font-bold text-sm shadow-xs">
          🥈
        </span>
      );
    }
    if (index === 2) {
      return (
        <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-800 border border-orange-300 flex items-center justify-center font-bold text-sm shadow-xs">
          🥉
        </span>
      );
    }
    return (
      <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-mono font-semibold text-xs flex items-center justify-center">
        #{index + 1}
      </span>
    );
  };

  const myRankIndex = sortedEntries.findIndex((e) => e.participantId === currentParticipantId);
  const myEntry = myRankIndex !== -1 ? sortedEntries[myRankIndex] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-linear-to-r from-amber-500 via-amber-600 to-yellow-600 p-5 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-15 pointer-events-none text-8xl">
            🏆
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
              🏆
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-lg text-white tracking-tight">
                  Liderlik Tablosu
                </h2>
                {isSessionEnded && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/25 text-white uppercase tracking-wider">
                    Oturum Sonu
                  </span>
                )}
              </div>
              <p className="text-amber-100 text-xs">
                {isSessionEnded 
                  ? 'Oturum tamamlandı! İşte en başarılı katılımcılar:' 
                  : 'Canlı oturum sıralaması ve katılımcı puanları'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/15 hover:bg-black/25 text-white flex items-center justify-center transition-colors relative z-10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Session Isolation Banner */}
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-amber-900 shrink-0">Oturum:</span>
            <span className="font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-[280px]">
              {sessionTitle || 'Aktif Oturum'}
            </span>
            {sessionCode && (
              <span className="px-1.5 py-0.5 rounded-md bg-amber-200/80 text-amber-900 font-mono font-bold text-[10px] shrink-0">
                #{sessionCode}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-white px-2 py-0.5 rounded-full border border-amber-300 shadow-2xs shrink-0">
            <span>🎯</span>
            <span>Bu Oturuma Özel</span>
          </span>
        </div>

        {/* Filter Tabs: En çok puan alanlar vs En çok soru yanıtlayanlar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setRankingMode('points')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                rankingMode === 'points'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>En Çok Puan Alanlar</span>
            </button>
            <button
              type="button"
              onClick={() => setRankingMode('activity')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                rankingMode === 'activity'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-blue-500" />
              <span>En Çok Soru Yanıtlayanlar</span>
            </button>
          </div>
        </div>

        {/* My Position Highlight Banner (if found) */}
        {myEntry && (
          <div className="bg-blue-50/70 border-b border-blue-100 px-4 py-2.5 flex items-center justify-between text-xs text-blue-900 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-600">Sıralamanız: #{myRankIndex + 1}</span>
              <span className="text-slate-300">•</span>
              <span className="text-base">{myEntry.participantAvatar}</span>
              <span className="font-medium text-slate-800">{myEntry.participantName}</span>
              <span className="text-[10px] bg-blue-200/70 text-blue-800 px-1.5 py-0.5 rounded-full font-bold">Sen</span>
            </div>
            <div className="flex items-center gap-3 font-semibold">
              <span className="text-amber-700">⭐ {myEntry.totalPoints} Puan</span>
              <span className="text-blue-700">📝 {myEntry.questionsAnswered} Yanıt</span>
            </div>
          </div>
        )}

        {/* List of participants */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100">
          {sortedEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs space-y-2">
              <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">Henüz Katılımcı Yanıtı Yok</p>
              <p className="text-slate-400 text-[11px] max-w-xs mx-auto">
                Bu oturumda {sessionCode ? `(«${sessionTitle || sessionCode}»)` : ''} henüz quiz sorusu yanıtlayan veya puan kazanan katılımcı bulunmuyor.
              </p>
            </div>
          ) : (
            sortedEntries.map((entry, index) => {
              const isMe = entry.participantId === currentParticipantId;
              return (
                <div
                  key={entry.participantId}
                  className={`pt-2 first:pt-0 flex items-center justify-between p-2.5 rounded-2xl transition-colors ${
                    isMe
                      ? 'bg-blue-50/80 border border-blue-200'
                      : index < 3
                      ? 'bg-slate-50/70 hover:bg-slate-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {getRankBadge(index)}
                    <span className="text-2xl shrink-0 select-none">{entry.participantAvatar}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                          {entry.participantName}
                        </span>
                        {isMe && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                            Sen
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{entry.questionsAnswered} soru yanıtladı</span>
                        {entry.correctAnswersCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-600 font-medium">
                              {entry.correctAnswersCount} doğru quiz
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <div className="font-extrabold text-xs sm:text-sm text-amber-600 font-mono">
                      ⭐ {entry.totalPoints} <span className="text-[10px] font-sans font-semibold text-slate-500">puan</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      #{entry.questionsAnswered} cevap
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Toplam {sortedEntries.length} katılımcı listeleniyor</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
