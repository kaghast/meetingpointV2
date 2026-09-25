import React, { useState, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  RotateCcw, 
  FileText, 
  CheckCircle2, 
  Star, 
  Sparkles, 
  BarChart3, 
  Layers, 
  MessageSquare, 
  KeyRound, 
  AlertTriangle,
  FileSpreadsheet,
  Search,
  Filter,
  Lock,
  Trophy,
  Award,
  Zap,
  Tag,
  Check,
  X,
  Radio,
  Clock,
  Calendar,
  Archive,
  CheckCircle,
  CircleDot,
  MailCheck,
  MailQuestion,
  LogOut,
  Users,
  UserCheck,
  Square,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { 
  Question, 
  Answer, 
  AnonymousFeedback, 
  QuestionResultsSummary, 
  LeaderboardEntry, 
  MeetingSession, 
  QuestionType,
  AttendanceRecord
} from '../types';
import { downloadCSV, generateSessionAnswersCSV } from '../utils/csv';
import { SessionEditorModal } from './SessionEditorModal';
import { AttendanceModal } from './AttendanceModal';
import { SessionResultsModal } from './SessionResultsModal';

interface AdminDashboardProps {
  adminToken: string;
  activeSessionId: string;
  sessions: MeetingSession[];
  sessionCode: string;
  sessionTitle: string;
  sessionDate?: string;
  startTime?: string;
  endTime?: string;
  isArchived?: boolean;
  activeQuestionId: string | null;
  pollStatus: 'open' | 'closed';
  showResultsToParticipants: boolean;
  participantCount: number;
  sessionEnded: boolean;
  questions: Question[];
  answers: Answer[];
  feedback: AnonymousFeedback[];
  summaries: Record<string, QuestionResultsSummary>;
  leaderboard: LeaderboardEntry[];
  attendanceRecords?: AttendanceRecord[];
  attendanceExpiresAt?: number | null;
  attendanceSecondsLeft?: number | null;
  onSetActiveQuestion: (qId: string | null) => Promise<boolean>;
  onTogglePollStatus: (status: 'open' | 'closed') => Promise<boolean>;
  onToggleShowResults: (show: boolean) => Promise<boolean>;
  onToggleSessionEnded: (ended: boolean, showResults?: boolean) => Promise<boolean>;
  onDeleteQuestion: (qId: string) => Promise<boolean>;
  onResetAnswers: (target: 'current' | 'all') => Promise<boolean>;
  onOpenCreateModal: (onTheFly: boolean) => void;
  onOpenEditModal: (q: Question) => void;
  onPasswordChangeSuccess: () => void;
  // Session operations
  onCreateSession: (sessionData: Partial<MeetingSession>) => Promise<boolean>;
  onUpdateSession: (id: string, sessionData: Partial<MeetingSession>) => Promise<boolean>;
  onDeleteSession: (id: string) => Promise<boolean>;
  onArchiveSession: (id: string, isArchived: boolean) => Promise<boolean>;
  onActivateSession: (id: string) => Promise<boolean>;
  // Feedback operations
  onToggleFeedbackRead: (feedbackId: string, isRead?: boolean) => Promise<boolean>;
  onMarkAllFeedbackRead: (sessionId?: string) => Promise<boolean>;
  onDeleteFeedback?: (feedbackId: string) => Promise<boolean>;
  // Attendance operations
  onStartAttendance: (sessionId?: string, questionId?: string) => Promise<boolean>;
  onStopAttendance: (sessionId?: string) => Promise<boolean>;
  onRefreshAttendance?: () => void;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminToken,
  activeSessionId,
  sessions = [],
  sessionCode,
  sessionTitle,
  sessionDate,
  startTime,
  endTime,
  isArchived = false,
  activeQuestionId,
  pollStatus,
  showResultsToParticipants,
  participantCount,
  sessionEnded = false,
  questions,
  answers,
  feedback,
  summaries,
  leaderboard = [],
  attendanceRecords = [],
  attendanceExpiresAt,
  attendanceSecondsLeft,
  onSetActiveQuestion,
  onTogglePollStatus,
  onToggleShowResults,
  onToggleSessionEnded,
  onDeleteQuestion,
  onResetAnswers,
  onOpenCreateModal,
  onOpenEditModal,
  onPasswordChangeSuccess,
  onCreateSession,
  onUpdateSession,
  onDeleteSession,
  onArchiveSession,
  onActivateSession,
  onToggleFeedbackRead,
  onMarkAllFeedbackRead,
  onDeleteFeedback,
  onStartAttendance,
  onStopAttendance,
  onRefreshAttendance,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'archived' | 'live' | 'panel' | 'leaderboard' | 'feedback' | 'settings'>('sessions');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteSessionConfirmId, setDeleteSessionConfirmId] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState<'current' | 'all' | null>(null);

  // Filter sessions: archived vs active session
  const archivedSessions = useMemo(() => {
    return sessions.filter((s) => s.isArchived);
  }, [sessions]);

  const activeSession = useMemo(() => {
    return (
      sessions.find((s) => s.id === activeSessionId && !s.isArchived) ||
      sessions.find((s) => s.id === activeSessionId) ||
      sessions.find((s) => !s.isArchived) ||
      null
    );
  }, [sessions, activeSessionId]);

  // Results Modal State
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedSessionForResults, setSelectedSessionForResults] = useState<MeetingSession | null>(null);

  // Session Editor Modal State
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<MeetingSession | null>(null);

  // Attendance Modal State
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceTargetSession, setAttendanceTargetSession] = useState<MeetingSession | null>(null);

  // End Session (Oturumu Bitir & Sonuç Göster/Gizle) Modal State
  const [isEndSessionModalOpen, setIsEndSessionModalOpen] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);

  // Feedback Delete Confirm State
  const [deleteConfirmFeedbackId, setDeleteConfirmFeedbackId] = useState<string | null>(null);

  // Question Bank Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'quiz' | QuestionType>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  // Feedback Tab Filter State
  const [feedbackSessionFilter, setFeedbackSessionFilter] = useState<string>('all');
  const [feedbackReadFilter, setFeedbackReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [feedbackVisibilityFilter, setFeedbackVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');

  // Leaderboard ranking mode and session selector
  const [leaderboardMode, setLeaderboardMode] = useState<'points' | 'activity'>('points');
  const [selectedLeaderboardSessionId, setSelectedLeaderboardSessionId] = useState<string>(activeSessionId);

  // Selected session for Leaderboard
  const currentLeaderboardSession = useMemo(() => {
    return (
      sessions.find((s) => s.id === selectedLeaderboardSessionId) ||
      sessions.find((s) => s.id === activeSessionId) ||
      sessions[0]
    );
  }, [sessions, selectedLeaderboardSessionId, activeSessionId]);

  // Compute strictly session-isolated leaderboard from answers of currentLeaderboardSession
  const sessionLeaderboard = useMemo(() => {
    if (!currentLeaderboardSession) return [];
    const targetSessionId = currentLeaderboardSession.id;
    const sessionAnswers = answers.filter((a) => a.sessionId === targetSessionId);

    const map = new Map<string, LeaderboardEntry>();

    sessionAnswers.forEach((ans) => {
      const pId = ans.participantId;
      if (!map.has(pId)) {
        map.set(pId, {
          participantId: pId,
          participantName: ans.participantName || 'Gizemli Katılımcı',
          participantAvatar: ans.participantAvatar || '👤',
          totalPoints: 0,
          questionsAnswered: 0,
          correctAnswersCount: 0,
          lastActive: ans.submittedAt,
        });
      }

      const item = map.get(pId)!;
      item.questionsAnswered += 1;
      if (ans.isCorrect) {
        item.correctAnswersCount += 1;
        let points = ans.pointsEarned;
        if (points === undefined || points === null) {
          const q = questions.find((x) => x.id === ans.questionId);
          points = q?.points || 10;
        }
        item.totalPoints += points;
      }
      if (new Date(ans.submittedAt) > new Date(item.lastActive)) {
        item.lastActive = ans.submittedAt;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return b.questionsAnswered - a.questionsAnswered;
    });
  }, [currentLeaderboardSession, answers, questions]);

  const currentSessionAnswersCount = useMemo(() => {
    if (!currentLeaderboardSession) return 0;
    return answers.filter((a) => a.sessionId === currentLeaderboardSession.id).length;
  }, [currentLeaderboardSession, answers]);

  // Settings state
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Extract all unique tags
  const allTags = Array.from(
    new Set(questions.flatMap((q) => q.tags || []))
  ).filter(Boolean);

  // Filter questions based on search & filter
  const filteredQuestions = questions.filter((q) => {
    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase();
      const matchTitle = q.title.toLowerCase().includes(qLower);
      const matchDesc = q.description?.toLowerCase().includes(qLower);
      const matchCat = q.category?.toLowerCase().includes(qLower);
      const matchOptions = q.options?.some((opt) => opt.toLowerCase().includes(qLower));
      const matchTags = q.tags?.some((t) => t.toLowerCase().includes(qLower));
      if (!matchTitle && !matchDesc && !matchCat && !matchOptions && !matchTags) {
        return false;
      }
    }
    if (typeFilter === 'quiz') {
      if (!q.isQuiz) return false;
    } else if (typeFilter !== 'all') {
      if (q.type !== typeFilter) return false;
    }
    if (tagFilter !== 'all') {
      if (!q.tags?.includes(tagFilter)) return false;
    }
    return true;
  });

  // Filter feedback
  const filteredFeedback = feedback.filter((fb) => {
    if (feedbackSessionFilter !== 'all') {
      if (fb.sessionId && fb.sessionId !== feedbackSessionFilter) return false;
    }
    if (feedbackReadFilter === 'unread') {
      if (fb.isRead) return false;
    } else if (feedbackReadFilter === 'read') {
      if (!fb.isRead) return false;
    }
    if (feedbackVisibilityFilter === 'private') {
      if (fb.isPublic !== false) return false;
    } else if (feedbackVisibilityFilter === 'public') {
      if (fb.isPublic === false) return false;
    }
    return true;
  });

  const unreadFeedbackCount = feedback.filter((fb) => !fb.isRead).length;

  // Active question object
  const currentActiveQ = questions.find((q) => q.id === activeQuestionId) || null;
  const currentSummary = currentActiveQ ? summaries[currentActiveQ.id] : null;

  // Active session object
  const activeSessionObj = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Attendance running check
  const isAttendanceRunning = pollStatus === 'open' && Boolean(
    (currentActiveQ?.type === 'attendance') || 
    (attendanceExpiresAt && Date.now() < attendanceExpiresAt)
  );

  const [isOperatingAttendance, setIsOperatingAttendance] = useState(false);
  const [attendanceNotification, setAttendanceNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleAttendanceToggle = async (questionId?: string) => {
    if (isOperatingAttendance) return;
    setIsOperatingAttendance(true);
    try {
      const targetSessionId = activeSession?.id || activeSessionId || sessions.find((s) => !s.isArchived)?.id || sessions[0]?.id || '';
      if (isAttendanceRunning) {
        const ok = await onStopAttendance(targetSessionId);
        if (ok) {
          setAttendanceNotification({ text: 'Yoklama durduruldu. Katılımcı ekranları "Soru Bekleniyor" durumuna geçti.', type: 'success' });
          setTimeout(() => setAttendanceNotification(null), 4000);
        } else {
          setAttendanceNotification({ text: 'Yoklama durdurulamadı. Lütfen oturum durumunu kontrol edin.', type: 'error' });
          setTimeout(() => setAttendanceNotification(null), 4000);
        }
      } else {
        const ok = await onStartAttendance(targetSessionId, questionId);
        if (ok) {
          setAttendanceNotification({ text: '90 saniyelik yoklama katılımcılara atandı ve canlı olarak başlatıldı! Katılımcı ekranları açıldı.', type: 'success' });
          setTimeout(() => setAttendanceNotification(null), 4000);
        } else {
          setAttendanceNotification({ text: 'Yoklama başlatılamadı. Aktif oturumu kontrol edin.', type: 'error' });
          setTimeout(() => setAttendanceNotification(null), 4000);
        }
      }
    } catch (err: any) {
      console.error('Attendance toggle error:', err);
      setAttendanceNotification({ text: err?.message || 'Yoklama işlemi gerçekleştirilemedi.', type: 'error' });
      setTimeout(() => setAttendanceNotification(null), 4000);
    } finally {
      setIsOperatingAttendance(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 3) {
      setPasswordError('Şifre en az 3 karakter olmalıdır.');
      return;
    }
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordMsg('Şifre başarıyla güncellendi.');
        setPasswordError('');
        setNewPassword('');
        onPasswordChangeSuccess();
        setTimeout(() => setPasswordMsg(''), 4000);
      } else {
        setPasswordError(data.error || 'Şifre güncellenemedi.');
      }
    } catch {
      setPasswordError('Bağlantı hatası.');
    }
  };

  const handleExportJSON = () => {
    window.location.href = `/api/admin/export?token=${encodeURIComponent(adminToken)}`;
  };

  const handleExportCSV = () => {
    const csvData = generateSessionAnswersCSV(questions, answers);
    downloadCSV(`meeting-answers-${sessionCode}-${Date.now()}.csv`, csvData);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Attendance Action Notification Banner */}
      {attendanceNotification && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-md animate-in slide-in-from-top-2 duration-200 ${
          attendanceNotification.type === 'success'
            ? 'bg-emerald-600 text-white border-emerald-700'
            : 'bg-rose-600 text-white border-rose-700'
        }`}>
          <div className="flex items-center gap-2.5 font-bold text-xs sm:text-sm">
            {attendanceNotification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
            <span>{attendanceNotification.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAttendanceNotification(null)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner: Active Session Snapshot */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              Aktif Oturum: #{sessionCode}
            </span>
            {isArchived ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700 flex items-center gap-1">
                <Archive className="w-3 h-3" />
                <span>Arşivde (Sonuçlar Gizli)</span>
              </span>
            ) : sessionEnded ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 flex items-center gap-1">
                <Trophy className="w-3 h-3 text-purple-600" />
                <span>Oturum Tamamlandı (Sonuçlar Açıklandı)</span>
              </span>
            ) : (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                pollStatus === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                <span className={`w-2 h-2 rounded-full ${pollStatus === 'open' ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`} />
                <span>{pollStatus === 'open' ? 'Canlı Oylama Açık' : 'Oylama Durduruldu'}</span>
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            {sessionTitle}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
            {sessionDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{sessionDate}</span>
              </span>
            )}
            {startTime && endTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>{startTime} - {endTime}</span>
              </span>
            )}
            <span>•</span>
            <span>{participantCount} Canlı Katılımcı</span>
            <span>•</span>
            <span>{answers.length} Toplam Yanıt</span>
            <span>•</span>
            <span>{questions.length} Soru Bankası</span>
            {unreadFeedbackCount > 0 && (
              <>
                <span>•</span>
                <span className="text-rose-600 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>{unreadFeedbackCount} Okunmamış Soru / Görüş</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Quick Session Header Action: Only Oturumu Bitir */}
        <div className="flex flex-wrap items-center gap-2">
          {sessionEnded ? (
            <button
              type="button"
              onClick={() => onToggleSessionEnded(false)}
              className="px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-200"
              title="Tamamlanan oturumu yeniden aktif hale getir"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Oturumu Yeniden Aç</span>
            </button>
          ) : (
            <button
              type="button"
              id="admin-btn-end-session"
              onClick={() => setIsEndSessionModalOpen(true)}
              className="px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer bg-rose-600 hover:bg-rose-700 text-white"
              title="Toplantı oturumunu sonlandır"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Oturumu Bitir</span>
            </button>
          )}
        </div>
      </div>

      {/* Live 90-Second Attendance Banner */}
      {isAttendanceRunning && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-white rounded-3xl p-5 shadow-lg border border-indigo-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 text-emerald-400 flex items-center justify-center shrink-0 border border-white/10">
              <Clock className="w-6 h-6 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-extrabold text-white">Canlı Yoklama Periyodu Devam Ediyor</span>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-full animate-pulse">
                  {attendanceSecondsLeft !== null && attendanceSecondsLeft !== undefined ? attendanceSecondsLeft : 90}s Kaldı
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-1">
                Öğrenci numarası, ad soyad, Lat-Long Geofencing ve cihaz imzaları toplanıyor. 90 saniye sonunda sistem otomatik duracaktır.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setAttendanceTargetSession(activeSessionObj || null);
                setIsAttendanceModalOpen(true);
              }}
              className="px-4 py-2 bg-white text-indigo-950 hover:bg-indigo-50 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Verileri Gör ({attendanceRecords.filter(r => r.sessionId === activeSessionId).length})
            </button>
            <button
              type="button"
              onClick={() => onStopAttendance(activeSessionId)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Yoklamayı Durdur
            </button>
          </div>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'sessions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Oturumlar {activeSession ? '(Aktif)' : '(0)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('archived')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'archived'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Archive className="w-4 h-4 text-amber-600" />
          <span>Arşivlenen Oturumlar ({archivedSessions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('live')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'live'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Canlı Kontrol</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('panel')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'panel'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Soru Bankası ({questions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'leaderboard'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-500" />
          <span>Liderlik Tablosu ({leaderboard.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('feedback')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'feedback'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Anonim Soru &amp; Görüşler ({feedback.length})</span>
          {unreadFeedbackCount > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-bold">
              {unreadFeedbackCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'settings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Ayarlar &amp; Dışa Aktar</span>
        </button>
      </div>

      {/* Attendance Action Feedback Toast / Notification */}
      {attendanceNotification && (
        <div className={`p-4 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
          attendanceNotification.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          <div className="flex items-center gap-2.5">
            {attendanceNotification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{attendanceNotification.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAttendanceNotification(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: SESSIONS MANAGEMENT - ONLY ACTIVE SESSION */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Oturumlar</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                  Aktif Oturum
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Şu anda yayında olan aktif toplantı oturumu aşağıda gösterilmektedir. Yeni bir oturum aktif edildiğinde mevcut oturum otomatik olarak arşive aktarılır.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSessionToEdit(null);
                  setIsSessionModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Oturum Oluştur</span>
              </button>
            </div>
          </div>

          {activeSession ? (
            <div className="space-y-4">
              <div
                key={activeSession.id}
                className="bg-white rounded-3xl border-2 border-blue-500 ring-4 ring-blue-50/70 p-6 shadow-sm space-y-5"
              >
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                        #{activeSession.code}
                      </span>

                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white flex items-center gap-1.5 shadow-xs">
                        <CircleDot className="w-3.5 h-3.5 animate-pulse" />
                        <span>Canlı Aktif Oturum</span>
                      </span>

                      {activeSession.sessionEnded && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                          Tamamlandı
                        </span>
                      )}
                    </div>

                    <h4 className="font-extrabold text-xl text-slate-900 leading-snug">
                      {activeSession.title}
                    </h4>
                  </div>

                  {/* Sonuçları Göster trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSessionForResults(activeSession);
                      setIsResultsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
                    title="Bu oturumun soru bazlı sonuçlarını ve grafiklerini göster"
                  >
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    <span>Sonuçları Göster</span>
                  </button>
                </div>

                {activeSession.description && (
                  <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                    {activeSession.description}
                  </p>
                )}

                {/* Date & Time badges */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Tarih: <strong>{activeSession.date || 'Tarih Belirtilmedi'}</strong></span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-700 font-semibold">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>Saat: <strong>{activeSession.startTime || '09:00'} - {activeSession.endTime || '18:00'}</strong></span>
                  </div>
                </div>

                {/* Meta stats */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
                  <span>
                    Atanan Soru: <strong>{Array.isArray(activeSession.assignedQuestionIds) ? activeSession.assignedQuestionIds.length : questions.length}</strong>
                  </span>
                  <span>
                    Geri Bildirim: <strong>{feedback.filter(fb => fb.sessionId === activeSession.id).length}</strong>
                    {feedback.filter(fb => fb.sessionId === activeSession.id && !fb.isRead).length > 0 && (
                      <span className="text-rose-600 font-bold ml-1">
                        ({feedback.filter(fb => fb.sessionId === activeSession.id && !fb.isRead).length} yeni)
                      </span>
                    )}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Direct Yoklama Ata & Başlat Action */}
                    {isAttendanceRunning ? (
                      <button
                        type="button"
                        disabled={isOperatingAttendance}
                        onClick={() => handleAttendanceToggle()}
                        className="px-3.5 py-2 font-bold text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs animate-pulse disabled:opacity-50"
                        title="Yoklamayı erken durdur"
                      >
                        {isOperatingAttendance ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Square className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>
                          {isOperatingAttendance
                            ? 'Durduruluyor...'
                            : `Yoklamayı Durdur (${attendanceSecondsLeft !== null && attendanceSecondsLeft !== undefined ? attendanceSecondsLeft : 0}s)`}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isOperatingAttendance}
                        onClick={() => handleAttendanceToggle()}
                        className="px-3.5 py-2 font-bold text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                        title="Bu oturum için 90 saniyelik yoklamayı başlat ve tüm katılımcılara ata"
                      >
                        {isOperatingAttendance ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                        <span>{isOperatingAttendance ? 'Başlatılıyor...' : 'Yoklama Ata & Başlat (90sn)'}</span>
                      </button>
                    )}

                    {/* Yoklama Verileri / Listesi */}
                    <button
                      type="button"
                      onClick={() => {
                        setAttendanceTargetSession(activeSession);
                        setIsAttendanceModalOpen(true);
                      }}
                      className="px-3.5 py-2 font-bold text-xs rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Bu oturumun yoklama verilerini ve GPS detaylarını görüntüle"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Yoklama Kayıtları ({attendanceRecords.filter(r => r.sessionId === activeSession.id).length})</span>
                    </button>

                    {/* Archive Button */}
                    <button
                      type="button"
                      onClick={() => onArchiveSession(activeSession.id, true)}
                      className="px-3.5 py-2 font-bold text-xs rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Bu oturumu arşive at"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Arşive At</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSessionToEdit(activeSession);
                        setIsSessionModalOpen(true);
                      }}
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Oturum bilgilerini düzenle"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    {deleteSessionConfirmId === activeSession.id ? (
                      <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-200">
                        <span className="text-[10px] text-red-700 font-bold px-1">Silinsin mi?</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteSession(activeSession.id);
                            setDeleteSessionConfirmId(null);
                          }}
                          className="px-2 py-1 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700 cursor-pointer"
                        >
                          Evet
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteSessionConfirmId(null)}
                          className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-[10px] hover:bg-slate-300 cursor-pointer"
                        >
                          İptal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteSessionConfirmId(activeSession.id)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Oturumu sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Banner linking to archived sessions */}
              {archivedSessions.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-amber-900 text-xs">
                    <Archive className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Arşivde <strong>{archivedSessions.length}</strong> adet oturum bulunmaktadır.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('archived')}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                  >
                    <span>Arşivlenen Oturumlara Git</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-8 space-y-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">Şu anda aktif bir oturum bulunmuyor</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Yeni bir oturum oluşturabilir veya Arşivlenen Oturumlar bölümünden bir oturumu aktif edebilirsiniz.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSessionToEdit(null);
                    setIsSessionModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Yeni Oturum Oluştur</span>
                </button>
                {archivedSessions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('archived')}
                    className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Archive className="w-4 h-4 text-amber-700" />
                    <span>Arşivlenen Oturumlara Git ({archivedSessions.length})</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ARCHIVED SESSIONS */}
      {activeTab === 'archived' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Arşivlenen Oturumlar</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                  {archivedSessions.length} Oturum
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Daha önce tamamlanan veya arşive kaldırılan oturumlar burada listelenir. 'Aktif Yap' butonuna bastığınızda seçilen oturum aktifleşir ve mevcut diğer oturumlar otomatik olarak pasife alınıp arşivlenir.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSessionToEdit(null);
                setIsSessionModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Oturum Oluştur</span>
            </button>
          </div>

          {archivedSessions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
              <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto">
                <Archive className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">Henüz arşivlenmiş oturum bulunmuyor</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Bir oturum aktif edildiğinde veya arşive atıldığında burada listelenecektir.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {archivedSessions.map((sess) => {
                const assignedCount = Array.isArray(sess.assignedQuestionIds) ? sess.assignedQuestionIds.length : questions.length;
                const sessionFeedbackCount = feedback.filter(fb => fb.sessionId === sess.id).length;
                const sessionUnreadCount = feedback.filter(fb => fb.sessionId === sess.id && !fb.isRead).length;

                return (
                  <div
                    key={sess.id}
                    className="bg-white rounded-3xl border border-slate-300 bg-slate-50/40 p-5 shadow-xs space-y-4"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                            #{sess.code}
                          </span>

                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-white flex items-center gap-1">
                            <Archive className="w-3 h-3" />
                            <span>Arşivlendi</span>
                          </span>

                          {sess.sessionEnded && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                              Pasif / Tamamlandı
                            </span>
                          )}
                        </div>

                        <h4 className="font-extrabold text-base text-slate-900 leading-snug">
                          {sess.title}
                        </h4>
                      </div>

                      {/* Sonuçları Göster trigger */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSessionForResults(sess);
                          setIsResultsModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                        title="Bu oturumun soru bazlı sonuçlarını ve grafiklerini göster"
                      >
                        <BarChart3 className="w-4 h-4 text-blue-600" />
                        <span>Sonuçları Göster</span>
                      </button>
                    </div>

                    {sess.description && (
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                        {sess.description}
                      </p>
                    )}

                    {/* Date & Time badges */}
                    <div className="p-3 bg-white rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>{sess.date || 'Tarih Belirtilmedi'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{sess.startTime || '09:00'} - {sess.endTime || '18:00'}</span>
                      </div>
                    </div>

                    {/* Meta stats */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>Atanan Soru: <strong>{assignedCount}</strong></span>
                      <span>
                        Geri Bildirim: <strong>{sessionFeedbackCount}</strong>
                        {sessionUnreadCount > 0 && (
                          <span className="text-rose-600 font-bold ml-1">({sessionUnreadCount} yeni)</span>
                        )}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {/* Aktif Yap Button: Clicking this activates this session, makes all others passive & archives them */}
                        <button
                          type="button"
                          onClick={async () => {
                            await onActivateSession(sess.id);
                            setActiveTab('sessions');
                          }}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                          title="Bu oturumu aktif yap (Diğer bütün oturumlar pasif yapılıp arşivlenir)"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Aktif Yap</span>
                        </button>

                        {/* Arşivden Çıkar */}
                        <button
                          type="button"
                          onClick={() => onArchiveSession(sess.id, false)}
                          className="px-3 py-1.5 font-bold text-xs rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                          title="Arşivden Çıkar (Oturumu aktif eder)"
                        >
                          <Archive className="w-3 h-3" />
                          <span>Arşivden Çıkar</span>
                        </button>

                        {/* Yoklama Action */}
                        <button
                          type="button"
                          onClick={() => {
                            setAttendanceTargetSession(sess);
                            setIsAttendanceModalOpen(true);
                          }}
                          className="px-3 py-1.5 font-bold text-xs rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer flex items-center gap-1"
                          title="Bu oturumun yoklama verilerini gör"
                        >
                          <Users className="w-3 h-3" />
                          <span>Yoklama ({attendanceRecords.filter(r => r.sessionId === sess.id).length})</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setSessionToEdit(sess);
                            setIsSessionModalOpen(true);
                          }}
                          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Oturum bilgilerini düzenle"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        {deleteSessionConfirmId === sess.id ? (
                          <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-200">
                            <span className="text-[10px] text-red-700 font-bold px-1">Silinsin mi?</span>
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteSession(sess.id);
                                setDeleteSessionConfirmId(null);
                              }}
                              className="px-2 py-0.5 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700 cursor-pointer"
                            >
                              Evet
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteSessionConfirmId(null)}
                              className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-lg text-[10px] hover:bg-slate-300 cursor-pointer"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteSessionConfirmId(sess.id)}
                            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Oturumu sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE CONTROL */}
      {activeTab === 'live' && (
        <div className="space-y-6">
          {/* Quick Attendance Control Banner in Canlı Kontrol */}
          <div className={`p-4 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
            isAttendanceRunning
              ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-100'
              : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                isAttendanceRunning ? 'bg-indigo-600 text-white animate-pulse shadow-xs' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
              }`}>
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                    {isAttendanceRunning ? 'Canlı Yoklama Periyodu Açık' : 'Ders / Toplantı Yoklaması'}
                  </h4>
                  {isAttendanceRunning ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-600 text-white animate-pulse">
                      ⏳ {attendanceSecondsLeft !== null && attendanceSecondsLeft !== undefined ? attendanceSecondsLeft : 0}s Kaldı
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      90 Saniye • Geofencing &amp; Cihaz İmzalı
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAttendanceRunning
                    ? `${attendanceRecords.filter(r => r.sessionId === activeSessionId).length} katılımcı yoklama onayladı. Süre tamamlandığında ekran otomatik olarak 'Soru Bekleniyor' durumuna geçer.`
                    : 'Aktif oturumdaki katılımcı ekranlarına tek tıkla 90 saniyelik yoklama formunu atar.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isAttendanceRunning ? (
                <button
                  type="button"
                  disabled={isOperatingAttendance}
                  onClick={() => handleAttendanceToggle()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isOperatingAttendance ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Square className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>{isOperatingAttendance ? 'Durduruluyor...' : 'Yoklamayı Durdur'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isOperatingAttendance}
                  onClick={() => handleAttendanceToggle()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isOperatingAttendance ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>{isOperatingAttendance ? 'Başlatılıyor...' : 'Yoklama Ata & Başlat (90sn)'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (activeSession) {
                    setAttendanceTargetSession(activeSession);
                    setIsAttendanceModalOpen(true);
                  }
                }}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                title="Yoklama kayıtlarını ve GPS detaylarını görüntüle"
              >
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>Kayıtlar ({attendanceRecords.filter(r => r.sessionId === activeSessionId).length})</span>
              </button>
            </div>
          </div>

          {/* Active Question Banner */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Şu Anda Katılımcı Ekranında Görünen Soru
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                  {currentActiveQ ? currentActiveQ.title : 'Henüz aktif bir soru seçilmedi'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const currentSess = sessions.find((s) => s.id === activeSessionId) || sessions[0];
                    if (currentSess) {
                      setSelectedSessionForResults(currentSess);
                      setIsResultsModalOpen(true);
                    }
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="Aktif oturumun tüm soru sonuçlarını ve grafiklerini incele"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Sonuçları Göster</span>
                </button>

                <button
                  type="button"
                  onClick={() => onTogglePollStatus(pollStatus === 'open' ? 'closed' : 'open')}
                  className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    pollStatus === 'open'
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {pollStatus === 'open' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{pollStatus === 'open' ? 'Oylamayı Duraklat' : 'Oylamayı Başlat'}</span>
                </button>

                {currentActiveQ && (
                  <button
                    type="button"
                    onClick={() => onSetActiveQuestion(null)}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Soruyu Kapat
                  </button>
                )}
              </div>
            </div>

            {currentActiveQ ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg font-bold bg-slate-100 text-slate-700">
                    Tip: {currentActiveQ.type}
                  </span>
                  {currentActiveQ.category && (
                    <span className="px-2.5 py-1 rounded-lg font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      {currentActiveQ.category}
                    </span>
                  )}
                  {currentActiveQ.isQuiz && (
                    <span className="px-2.5 py-1 rounded-lg font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      <span>Quiz Sorusudur ({currentActiveQ.points || 10}P)</span>
                    </span>
                  )}
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600 font-semibold">
                    {answers.filter((a) => a.questionId === currentActiveQ.id && a.sessionId === activeSessionId).length} Katılımcı Yanıt Verdi
                  </span>
                </div>

                {/* Question Live Results Preview */}
                {currentSummary && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Canlı Dağılım ({currentSummary.totalVotes} oy)</span>
                      <button
                        type="button"
                        onClick={() => onResetAnswers('current')}
                        className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Bu Sorunun Oylarını Sıfırla</span>
                      </button>
                    </div>

                    {currentActiveQ.type === 'multiple_choice' && currentSummary.choiceDistribution && (
                      <div className="space-y-2">
                        {Object.entries(currentSummary.choiceDistribution).map(([opt, count]) => {
                          const pct = currentSummary.totalVotes > 0 ? Math.round((count / currentSummary.totalVotes) * 100) : 0;
                          const isCorrect = currentActiveQ.isQuiz && currentActiveQ.correctAnswer === opt;
                          return (
                            <div key={opt} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-semibold text-slate-800 flex items-center gap-1">
                                  <span>{opt}</span>
                                  {isCorrect && <span className="text-emerald-600 font-bold text-[10px]">✓ (Doğru Yanıt)</span>}
                                </span>
                                <span className="font-mono text-slate-500 font-bold">{count} (%{pct})</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div className={`h-2 rounded-full ${isCorrect ? 'bg-emerald-600' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {currentActiveQ.type === 'true_false' && currentSummary.trueFalseDistribution && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                          <span className="text-xs font-bold text-emerald-800 block">Doğru (True)</span>
                          <span className="text-xl font-black text-emerald-900 mt-1 block">{currentSummary.trueFalseDistribution.trueCount}</span>
                        </div>
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-center">
                          <span className="text-xs font-bold text-rose-800 block">Yanlış (False)</span>
                          <span className="text-xl font-black text-rose-900 mt-1 block">{currentSummary.trueFalseDistribution.falseCount}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                Aşağıdaki Soru Bankasından veya "Anında Soru Başlat" butonundan bir soru yayınlayabilirsiniz.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: QUESTION BANK */}
      {activeTab === 'panel' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Soru Bankası</h3>
              <p className="text-xs text-slate-500">
                Oturumda sorulacak tüm soruları düzenleyin, arayın ve yönetin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenCreateModal(false)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Soru Ekle</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Soru metni, açıklama veya etiket ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >
                <option value="all">Tüm Tipler</option>
                <option value="quiz">🎯 Sadece Quiz Soruları</option>
                <option value="multiple_choice">Çoktan Seçmeli</option>
                <option value="true_false">Doğru / Yanlış</option>
                <option value="rating_pool">Derecelendirme</option>
                <option value="short_text">Kısa Metin</option>
                <option value="long_text">Uzun Metin</option>
              </select>

              {allTags.length > 0 && (
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                >
                  <option value="all">Tüm Etiketler</option>
                  {allTags.map((t) => (
                    <option key={t} value={t}>#{t}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-3">
            {filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
                Arama kriterlerinize uygun soru bulunamadı.
              </div>
            ) : (
              filteredQuestions.map((q) => {
                const isActive = q.id === activeQuestionId;

                return (
                  <div
                    key={q.id}
                    className={`bg-white rounded-2xl border p-4 shadow-2xs transition-all space-y-3 ${
                      isActive ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {q.type}
                          </span>
                          {q.category && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                              {q.category}
                            </span>
                          )}
                          {q.isQuiz && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1">
                              <Award className="w-3 h-3" />
                              <span>QUIZ ({q.points || 10}P)</span>
                            </span>
                          )}
                          {isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                              Canlı Yayınlanıyor
                            </span>
                          )}
                        </div>

                        <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                          {q.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {q.type === 'attendance' ? (
                          <button
                            type="button"
                            disabled={isOperatingAttendance}
                            onClick={() => handleAttendanceToggle(q.id)}
                            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                              isAttendanceRunning
                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            } disabled:opacity-50`}
                            title="Oturum için 90 saniyelik yoklamayı başlat ve katılımcılara ata"
                          >
                            {isOperatingAttendance ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isAttendanceRunning ? (
                              <Square className="w-3 h-3 fill-current" />
                            ) : (
                              <Play className="w-3 h-3 fill-current" />
                            )}
                            <span>
                              {isOperatingAttendance
                                ? 'İşleniyor...'
                                : isAttendanceRunning
                                ? `Yoklamayı Durdur (${attendanceSecondsLeft !== null && attendanceSecondsLeft !== undefined ? attendanceSecondsLeft : 0}s)`
                                : 'Yoklama Ata & Başlat (90sn)'}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSetActiveQuestion(isActive ? null : q.id)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            <span>{isActive ? 'Durdur' : 'Yayınla'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onOpenEditModal(q)}
                          className="p-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {deleteConfirmId === q.id ? (
                          <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-200">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteQuestion(q.id);
                                setDeleteConfirmId(null);
                              }}
                              className="px-2 py-1 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700 cursor-pointer"
                            >
                              Sil
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-[10px] hover:bg-slate-300 cursor-pointer"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(q.id)}
                            className="p-2 border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {q.description && (
                      <p className="text-xs text-slate-500 leading-relaxed">{q.description}</p>
                    )}

                    {q.tags && q.tags.length > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                        {q.tags.map((t) => (
                          <span key={t} className="text-slate-500">#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Oturuma Özel Liderlik Tablosu</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Oturum İzolasyonu Aktif
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Liderlik sıralaması genel olmayıp, her oturumun katılımcı puanları ve quiz yanıtları bağımsız hesaplanır.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Session Selector Dropdown */}
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-500 font-medium">Oturum:</span>
                <select
                  id="admin-leaderboard-session-select"
                  value={selectedLeaderboardSessionId}
                  onChange={(e) => setSelectedLeaderboardSessionId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer max-w-[220px] truncate"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.code} - {s.title} {s.id === activeSessionId ? '(Canlı Aktif)' : s.isArchived ? '(Arşivde)' : s.sessionEnded ? '(Tamamlandı)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setLeaderboardMode('points')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    leaderboardMode === 'points' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  🏆 En Çok Puan
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardMode('activity')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    leaderboardMode === 'activity' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  ⚡ En Çok Yanıt
                </button>
              </div>
            </div>
          </div>

          {/* Session Overview Card */}
          {currentLeaderboardSession && (
            <div className="bg-linear-to-r from-amber-500/10 via-amber-500/5 to-yellow-500/10 rounded-2xl p-4 border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white font-mono font-bold text-xs">
                    #{currentLeaderboardSession.code}
                  </span>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                    {currentLeaderboardSession.title}
                  </h4>
                  {currentLeaderboardSession.id === activeSessionId ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Canlı Aktif
                    </span>
                  ) : currentLeaderboardSession.isArchived ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                      Arşivde
                    </span>
                  ) : currentLeaderboardSession.sessionEnded ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                      Tamamlandı
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>📅 {currentLeaderboardSession.date || 'Tarih belirtilmedi'}</span>
                  <span>⏰ {currentLeaderboardSession.startTime || '09:00'} - {currentLeaderboardSession.endTime || '18:00'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-center">
                <div className="bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-medium block">Katılımcı</span>
                  <span className="font-extrabold text-slate-800 text-sm">{sessionLeaderboard.length}</span>
                </div>
                <div className="bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-medium block">Toplam Yanıt</span>
                  <span className="font-extrabold text-slate-800 text-sm">{currentSessionAnswersCount}</span>
                </div>
                <div className="bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-medium block">Lider Skor</span>
                  <span className="font-extrabold text-amber-600 text-sm">
                    {sessionLeaderboard[0]?.totalPoints || 0} P
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            {sessionLeaderboard.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 space-y-2">
                <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700 text-sm">Henüz Katılımcı Puanı Bulunmuyor</p>
                <p className="max-w-md mx-auto text-slate-500">
                  {currentLeaderboardSession 
                    ? `«${currentLeaderboardSession.title}» (#{currentLeaderboardSession.code}) oturumunda henüz quiz sorusu yanıtlayan veya puan kazanan kullanıcı bulunmuyor.`
                    : 'Seçili oturumda henüz soru yanıtlayan kullanıcı bulunmuyor.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs sm:text-sm">
                {sessionLeaderboard
                  .sort((a, b) =>
                    leaderboardMode === 'points'
                      ? b.totalPoints - a.totalPoints || b.questionsAnswered - a.questionsAnswered
                      : b.questionsAnswered - a.questionsAnswered || b.totalPoints - a.totalPoints
                  )
                  .map((entry, idx) => (
                    <div key={entry.participantId} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                          idx === 0 ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs' : idx === 1 ? 'bg-slate-200 text-slate-800 border border-slate-300' : idx === 2 ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                        </span>

                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl select-none">{entry.participantAvatar}</span>
                          <div>
                            <span className="font-extrabold text-slate-900 block text-xs sm:text-sm">{entry.participantName}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">#{entry.participantId}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-5 text-right">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Doğru / Yanıt</span>
                          <span className="font-semibold text-slate-700">
                            {entry.correctAnswersCount} <span className="text-slate-400 font-normal">/ {entry.questionsAnswered}</span>
                          </span>
                        </div>
                        <div className="min-w-[80px]">
                          <span className="text-[11px] text-slate-400 block">Kazanılan Puan</span>
                          <span className="text-base font-extrabold text-amber-600 font-mono">
                            ⭐ {entry.totalPoints} <span className="text-xs font-semibold text-slate-500">P</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ANONYMOUS FEEDBACK & QUESTIONS */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Anonim Soru &amp; Görüş İletileri</h3>
              <p className="text-xs text-slate-500">
                Katılımcıların ilettiği anonim sorular ilgili oturum altında listelenir. Okundu/okunmadı olarak işaretleyebilirsiniz.
              </p>
            </div>

            {feedback.length > 0 && (
              <button
                type="button"
                onClick={() => onMarkAllFeedbackRead(feedbackSessionFilter === 'all' ? undefined : feedbackSessionFilter)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Tümünü Okundu İşaretle</span>
              </button>
            )}
          </div>

          {/* Session and Read Filter Bar */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Oturum Filtresi:</span>
              <select
                value={feedbackSessionFilter}
                onChange={(e) => setFeedbackSessionFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              >
                <option value="all">Tüm Oturumlar ({feedback.length})</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} (#{s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Read Filter */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFeedbackReadFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    feedbackReadFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Tümü ({feedback.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackReadFilter('unread')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    feedbackReadFilter === 'unread' ? 'bg-white text-rose-700 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <span>Okunmamış</span>
                  {unreadFeedbackCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px]">
                      {unreadFeedbackCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackReadFilter('read')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    feedbackReadFilter === 'read' ? 'bg-white text-emerald-700 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Okunmuş ({feedback.filter(f => f.isRead).length})
                </button>
              </div>

              {/* Visibility Filter (Herkes / Sadece Admin) */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFeedbackVisibilityFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    feedbackVisibilityFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                  title="Tüm iletileri göster"
                >
                  Tümü
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackVisibilityFilter('private')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    feedbackVisibilityFilter === 'private' ? 'bg-white text-amber-900 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                  title="Sadece yöneticinin görebileceği gizli iletiler"
                >
                  <Lock className="w-3 h-3 text-amber-600" />
                  <span>Sadece Admin ({feedback.filter(f => f.isPublic === false).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackVisibilityFilter('public')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    feedbackVisibilityFilter === 'public' ? 'bg-white text-purple-900 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                  title="Herkese açık iletiler"
                >
                  <Eye className="w-3 h-3 text-purple-600" />
                  <span>Herkese Açık ({feedback.filter(f => f.isPublic !== false).length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Feedback Items */}
          <div className="space-y-3">
            {filteredFeedback.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
                Seçilen filtrelere uygun iletilen soru veya görüş bulunamadı.
              </div>
            ) : (
              filteredFeedback.map((fb) => (
                <div
                  key={fb.id}
                  className={`bg-white rounded-2xl border p-4 shadow-2xs space-y-3 transition-all ${
                    !fb.isRead ? 'border-rose-300 ring-1 ring-rose-100 bg-rose-50/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      {/* Session Tag */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>Oturum: {fb.sessionTitle || 'Genel'} (#{fb.sessionCode || sessionCode})</span>
                        </span>

                        {fb.isRead ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Okundu</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            <span>Okunmadı</span>
                          </span>
                        )}

                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
                          {fb.category === 'question' ? '❓ Soru' : fb.category === 'feedback' ? '💬 Görüş' : '💡 Öneri'}
                        </span>

                        {fb.isPublic === false ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Sadece Yönetici (Gizli)</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                            <Eye className="w-2.5 h-2.5" />
                            <span>Herkese Açık</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold pt-1">
                        <span>{fb.participantAvatar || '👤'}</span>
                        <span>{fb.participantName || 'Anonim'}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(fb.submittedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Toggle Read / Unread Button */}
                      <button
                        type="button"
                        onClick={() => onToggleFeedbackRead(fb.id, !fb.isRead)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                          fb.isRead
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        }`}
                      >
                        {fb.isRead ? (
                          <>
                            <MailQuestion className="w-3.5 h-3.5" />
                            <span>Okunmadı Yap</span>
                          </>
                        ) : (
                          <>
                            <MailCheck className="w-3.5 h-3.5" />
                            <span>Okundu Olarak İşaretle</span>
                          </>
                        )}
                      </button>

                      {/* Admin Delete Feedback Action */}
                      {onDeleteFeedback && (
                        deleteConfirmFeedbackId === fb.id ? (
                          <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-xl border border-rose-200 animate-in fade-in duration-150">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteFeedback(fb.id);
                                setDeleteConfirmFeedbackId(null);
                              }}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                              Evet, Sil
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmFeedbackId(null)}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition-colors cursor-pointer"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmFeedbackId(fb.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                            title="Bu soru/görüş iletisini sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    {fb.message}
                  </p>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>👍 {fb.upvotes || 0} Beğeni</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: SETTINGS & EXPORT */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Change Password */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-600" />
              <h3 className="font-extrabold text-base text-slate-900">Yönetici Şifresini Değiştir</h3>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              {passwordMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-semibold">
                  {passwordMsg}
                </div>
              )}
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-semibold">
                  {passwordError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Yeni Şifre</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="En az 3 karakter"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Şifreyi Güncelle
              </button>
            </form>
          </div>

          {/* Export & Reset */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-purple-600" />
              <h3 className="font-extrabold text-base text-slate-900">Veri Dışa Aktarma &amp; Sıfırlama</h3>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleExportCSV}
                className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Yanıtları CSV Olarak İndir (Excel Uyumlu)</span>
                </span>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={handleExportJSON}
                className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Tüm Toplantı Verilerini JSON Olarak Yedekle</span>
                </span>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <div className="pt-2 border-t border-slate-100">
                {resetConfirm === 'all' ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                    <p className="text-xs text-red-800 font-bold">
                      Tüm oturum yanıtlarını ve puanları silmek istediğinize emin misiniz?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await onResetAnswers('all');
                          setResetConfirm(null);
                        }}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 cursor-pointer"
                      >
                        Evet, Tümünü Sıfırla
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetConfirm(null)}
                        className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs hover:bg-slate-300 cursor-pointer"
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setResetConfirm('all')}
                    className="w-full p-2.5 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 text-xs font-bold text-rose-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Tüm Katılımcı Cevaplarını Sıfırla</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session Editor Modal */}
      <SessionEditorModal
        isOpen={isSessionModalOpen}
        onClose={() => {
          setIsSessionModalOpen(false);
          setSessionToEdit(null);
        }}
        sessionToEdit={sessionToEdit}
        allQuestions={questions}
        answers={answers}
        onSave={async (sessionData) => {
          if (sessionToEdit) {
            return await onUpdateSession(sessionToEdit.id, sessionData);
          } else {
            return await onCreateSession(sessionData);
          }
        }}
      />

      {/* Attendance Modal */}
      <AttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => {
          setIsAttendanceModalOpen(false);
          setAttendanceTargetSession(null);
        }}
        session={attendanceTargetSession || activeSessionObj || null}
        attendanceRecords={attendanceRecords}
        isAttendanceActive={isAttendanceRunning}
        attendanceSecondsLeft={attendanceSecondsLeft !== null && attendanceSecondsLeft !== undefined ? attendanceSecondsLeft : 0}
        onStartAttendance={async (sId) => {
          await onStartAttendance(sId);
        }}
        onStopAttendance={async (sId) => {
          await onStopAttendance(sId);
        }}
        onRefresh={() => {
          if (onRefreshAttendance) onRefreshAttendance();
        }}
      />

      {/* Session Question Results Modal with Charts */}
      <SessionResultsModal
        isOpen={isResultsModalOpen}
        onClose={() => {
          setIsResultsModalOpen(false);
          setSelectedSessionForResults(null);
        }}
        session={selectedSessionForResults || activeSessionObj || null}
        allQuestions={questions}
        answers={answers}
        attendanceRecords={attendanceRecords}
        summaries={summaries}
      />

      {/* End Session Modal: Sonuçları Göster / Gösterme Seçimi */}
      {isEndSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setIsEndSessionModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-slate-900">Oturumu Bitir</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Toplantı oturumunu sonlandırmak üzeresiniz. Oturumu bitirmeden önce oylama ve toplantı sonuçları katılımcılara gösterilsin mi?
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {/* Option 1: Göster */}
              <button
                type="button"
                id="btn-end-session-show-results"
                disabled={isEndingSession}
                onClick={async () => {
                  setIsEndingSession(true);
                  try {
                    await onToggleSessionEnded(true, true);
                    setIsEndSessionModalOpen(false);
                    setAttendanceNotification({
                      type: 'success',
                      text: 'Oturum sonlandırıldı ve sonuçlar katılımcılara açıklandı. Katılımcılara teşekkür mesajı iletildi.'
                    });
                  } finally {
                    setIsEndingSession(false);
                  }
                }}
                className="w-full text-left p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/70 hover:bg-emerald-50 text-emerald-950 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs hover:border-emerald-600"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Eye className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-xs sm:text-sm text-emerald-900 flex items-center justify-between">
                    <span>Sonuçları Katılımcılara Göster</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold uppercase tracking-wider">
                      Göster
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-1 font-medium leading-relaxed">
                    Oturumu bitirir ve sonuçları katılımcıların ekranında yayınlar. Katılımcılara teşekkür edilir.
                  </p>
                </div>
              </button>

              {/* Option 2: Gösterme */}
              <button
                type="button"
                id="btn-end-session-hide-results"
                disabled={isEndingSession}
                onClick={async () => {
                  setIsEndingSession(true);
                  try {
                    await onToggleSessionEnded(true, false);
                    setIsEndSessionModalOpen(false);
                    setAttendanceNotification({
                      type: 'success',
                      text: 'Oturum direkt sonlandırıldı (sonuçlar gizlendi). Katılımcılara teşekkür mesajı iletildi.'
                    });
                  } finally {
                    setIsEndingSession(false);
                  }
                }}
                className="w-full text-left p-4 rounded-2xl border-2 border-slate-300 bg-slate-50/70 hover:bg-slate-100 text-slate-800 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs hover:border-slate-400"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <EyeOff className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center justify-between">
                    <span>Sonuçları Gösterme (Direkt Bitir)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold uppercase tracking-wider">
                      Gösterme
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                    Oturumu direkt bitirir. Sonuçlar katılımcılara gösterilmez, gizli tutulur. Katılımcılara teşekkür edilir.
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsEndSessionModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
