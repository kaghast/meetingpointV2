import React, { useState, useMemo } from 'react';
import { 
  X, 
  BarChart3, 
  Download, 
  Search, 
  Award, 
  Calendar, 
  Clock, 
  Users, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Star, 
  Filter, 
  FileSpreadsheet,
  Layers,
  HelpCircle,
  TrendingUp,
  MapPin,
  Smartphone
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { 
  MeetingSession, 
  Question, 
  Answer, 
  AttendanceRecord, 
  QuestionResultsSummary, 
  QuestionType 
} from '../types';
import { downloadCSV, generateSessionAnswersCSV } from '../utils/csv';

interface SessionResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: MeetingSession | null;
  allQuestions: Question[];
  answers: Answer[];
  attendanceRecords?: AttendanceRecord[];
  summaries?: Record<string, QuestionResultsSummary>;
}

const formatQuestionType = (type: QuestionType, isQuiz?: boolean): string => {
  if (isQuiz) return '🎯 Quiz Sorusu';
  switch (type) {
    case 'multiple_choice':
      return 'Çoktan Seçmeli';
    case 'true_false':
      return 'Doğru / Yanlış';
    case 'rating_pool':
      return 'Derecelendirme';
    case 'short_text':
      return 'Kısa Metin';
    case 'long_text':
      return 'Açık Uçlu Metin';
    case 'attendance':
      return 'Yoklama';
    default:
      return type;
  }
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];

export const SessionResultsModal: React.FC<SessionResultsModalProps> = ({
  isOpen,
  onClose,
  session,
  allQuestions = [],
  answers = [],
  attendanceRecords = [],
  summaries,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'quiz' | QuestionType>('all');
  const [activeTab, setActiveTab] = useState<'charts' | 'attendance'>('charts');

  // Filter session answers & attendance strictly for this session
  const sessionAnswers = useMemo(() => {
    if (!session) return [];
    return answers.filter((a) => a.sessionId === session.id);
  }, [session, answers]);

  const sessionAttendance = useMemo(() => {
    if (!session) return [];
    return attendanceRecords.filter((r) => r.sessionId === session.id);
  }, [session, attendanceRecords]);

  // Determine questions associated with this session
  const sessionQuestions = useMemo(() => {
    if (!session) return [];
    const assignedIds = new Set(session.assignedQuestionIds || []);
    // Also include any question that was actually answered in this session
    sessionAnswers.forEach((a) => assignedIds.add(a.questionId));
    if (session.activeQuestionId) assignedIds.add(session.activeQuestionId);

    const questionsList = allQuestions.filter((q) => assignedIds.has(q.id));
    if (questionsList.length === 0) {
      return allQuestions;
    }
    return questionsList;
  }, [session, allQuestions, sessionAnswers]);

  // Compute question-by-question results summary strictly for this session
  const questionSummaries = useMemo(() => {
    if (!session) return {};
    const resMap: Record<string, QuestionResultsSummary> = {};

    sessionQuestions.forEach((q) => {
      const qAns = sessionAnswers.filter((a) => a.questionId === q.id);
      const totalVotes = qAns.length;

      const summary: QuestionResultsSummary = {
        questionId: q.id,
        type: q.type,
        totalVotes,
      };

      if (q.type === 'multiple_choice') {
        const distribution: Record<string, number> = {};
        (q.options || []).forEach((opt) => {
          distribution[opt] = 0;
        });
        qAns.forEach((ans) => {
          if (Array.isArray(ans.value)) {
            ans.value.forEach((v) => {
              distribution[String(v)] = (distribution[String(v)] || 0) + 1;
            });
          } else if (ans.value !== undefined && ans.value !== null) {
            distribution[String(ans.value)] = (distribution[String(ans.value)] || 0) + 1;
          }
        });
        summary.choiceDistribution = distribution;
      } else if (q.type === 'true_false') {
        let trueCount = 0;
        let falseCount = 0;
        qAns.forEach((ans) => {
          if (ans.value === true || ans.value === 'true') trueCount++;
          if (ans.value === false || ans.value === 'false') falseCount++;
        });
        summary.trueFalseDistribution = { trueCount, falseCount };
      } else if (q.type === 'rating_pool') {
        const max = q.ratingMax || 5;
        const distribution: Record<number, number> = {};
        for (let i = 1; i <= max; i++) distribution[i] = 0;
        let sum = 0;
        let validCount = 0;
        qAns.forEach((ans) => {
          const num = Number(ans.value);
          if (!isNaN(num) && num >= 1 && num <= max) {
            distribution[num] = (distribution[num] || 0) + 1;
            sum += num;
            validCount++;
          }
        });
        summary.ratingDistribution = distribution;
        summary.ratingAverage = validCount > 0 ? Number((sum / validCount).toFixed(1)) : 0;
      } else if (q.type === 'short_text' || q.type === 'long_text') {
        summary.textAnswers = qAns.map((a) => ({
          id: a.id,
          text: String(a.value),
          time: a.submittedAt,
          participantName: a.participantName,
          participantAvatar: a.participantAvatar,
        }));
      } else if (q.type === 'attendance') {
        summary.attendanceRecordsCount = sessionAttendance.length > 0 ? sessionAttendance.length : qAns.length;
      }

      if (q.isQuiz && q.correctAnswer !== undefined) {
        let correctCount = 0;
        qAns.forEach((ans) => {
          if (ans.isCorrect) correctCount++;
        });
        summary.quizStats = {
          correctCount,
          wrongCount: Math.max(0, totalVotes - correctCount),
          correctPercentage: totalVotes > 0 ? Math.round((correctCount / totalVotes) * 100) : 0,
          correctAnswer: q.correctAnswer,
        };
      }

      resMap[q.id] = summary;
    });

    return resMap;
  }, [session, sessionQuestions, sessionAnswers, sessionAttendance]);

  // Overall session metrics
  const uniqueParticipantsCount = useMemo(() => {
    const pSet = new Set<string>();
    sessionAnswers.forEach((a) => pSet.add(a.participantId));
    sessionAttendance.forEach((r) => pSet.add(r.participantId));
    return pSet.size;
  }, [sessionAnswers, sessionAttendance]);

  // Filtered questions for the view
  const filteredQuestions = useMemo(() => {
    return sessionQuestions.filter((q) => {
      if (typeFilter === 'quiz') {
        if (!q.isQuiz) return false;
      } else if (typeFilter !== 'all') {
        if (q.type !== typeFilter) return false;
      }

      if (!searchQuery.trim()) return true;
      const term = searchQuery.toLowerCase();
      return (
        q.title.toLowerCase().includes(term) ||
        (q.description && q.description.toLowerCase().includes(term)) ||
        (q.category && q.category.toLowerCase().includes(term)) ||
        (q.tags && q.tags.some((t) => t.toLowerCase().includes(term)))
      );
    });
  }, [sessionQuestions, typeFilter, searchQuery]);

  if (!isOpen || !session) return null;

  const handleDownloadCSV = () => {
    const csvContent = generateSessionAnswersCSV(sessionQuestions, sessionAnswers);
    const filename = `oturum_sonuclari_${session.code}_${session.date || 'rapor'}.csv`;
    downloadCSV(filename, csvContent);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden my-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-results-title"
      >
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-lg">
                #{session.code}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-white/10 text-white border border-white/10">
                Oturum Sonuçları & Soru Analizleri
              </span>
              {session.isArchived && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-700 text-slate-300">
                  Arşivlenmiş Oturum
                </span>
              )}
            </div>

            <h2 id="session-results-title" className="text-lg sm:text-xl font-black text-white truncate">
              {session.title}
            </h2>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>{session.date || 'Tarih Belirtilmedi'}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{session.startTime || '09:00'} - {session.endTime || '18:00'}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Bu oturumun yanıtlarını CSV olarak indir"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">CSV İndir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* STATS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-50 border-b border-slate-200 divide-x divide-y sm:divide-y-0 divide-slate-200 text-center text-xs shrink-0">
          <div className="p-3">
            <span className="text-slate-500 block font-medium">Oturum Soruları</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{sessionQuestions.length}</span>
          </div>
          <div className="p-3">
            <span className="text-slate-500 block font-medium">Toplam Verilen Yanıt</span>
            <span className="text-lg font-black text-blue-600 mt-0.5 block">{sessionAnswers.length}</span>
          </div>
          <div className="p-3">
            <span className="text-slate-500 block font-medium">Katılımcı Sayısı</span>
            <span className="text-lg font-black text-emerald-600 mt-0.5 block">{uniqueParticipantsCount}</span>
          </div>
          <div className="p-3">
            <span className="text-slate-500 block font-medium">Yoklama Katılımı</span>
            <span className="text-lg font-black text-indigo-600 mt-0.5 block">{sessionAttendance.length}</span>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Oturum sorularında ara (başlık, kategori, etiket)..."
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
              <option value="all">Tüm Soru Tipleri ({sessionQuestions.length})</option>
              <option value="quiz">🎯 Quiz Soruları</option>
              <option value="multiple_choice">Çoktan Seçmeli</option>
              <option value="true_false">Doğru / Yanlış</option>
              <option value="rating_pool">Derecelendirme</option>
              <option value="short_text">Kısa Metin</option>
              <option value="long_text">Açık Uçlu Metin</option>
              <option value="attendance">Yoklama</option>
            </select>

            {sessionAttendance.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'charts' ? 'attendance' : 'charts')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'attendance'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{activeTab === 'attendance' ? 'Grafiklere Dön' : `Yoklama Tablosu (${sessionAttendance.length})`}</span>
              </button>
            )}
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE CONTENT) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
          {activeTab === 'attendance' ? (
            /* ATTENDANCE TABLE VIEW */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Bu Oturumun Yoklama Kayıtları</h3>
                  <p className="text-xs text-slate-500">Konum ve cihaz doğrulamalı katılım listesi.</p>
                </div>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-900 font-bold text-xs rounded-full">
                  {sessionAttendance.length} Katılımcı Kayıt Yaptı
                </span>
              </div>

              {sessionAttendance.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Bu oturum için henüz yoklama kaydı bulunmuyor.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Öğrenci No</th>
                        <th className="py-2.5 px-3">Adı Soyadı</th>
                        <th className="py-2.5 px-3">Kayıt Saati</th>
                        <th className="py-2.5 px-3">Konum Bilgisi</th>
                        <th className="py-2.5 px-3">Cihaz</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessionAttendance.map((rec, idx) => (
                        <tr key={rec.id || idx} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{rec.studentNumber}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{rec.fullName}</td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {new Date(rec.submittedAt).toLocaleTimeString('tr-TR')}
                          </td>
                          <td className="py-2.5 px-3">
                            {rec.location?.latitude ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-mono text-[11px]">
                                <MapPin className="w-3 h-3 text-emerald-600" />
                                <span>{rec.location.latitude.toFixed(4)}, {rec.location.longitude?.toFixed(4)} (±{Math.round(rec.location.accuracy || 0)}m)</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">Konum alınamadı</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 text-slate-600 text-[11px]">
                              <Smartphone className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[120px]">{rec.deviceSignature?.browser || rec.deviceSignature?.platform || 'Mobil/Masaüstü'}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* QUESTIONS LIST WITH APPROPRIATE CHARTS */
            filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
                Arama kriterlerinize uygun soru bulunamadı.
              </div>
            ) : (
              filteredQuestions.map((q, qIndex) => {
                const summary = questionSummaries[q.id];
                const totalVotes = summary ? summary.totalVotes : 0;
                const isQuiz = Boolean(q.isQuiz);

                return (
                  <div
                    key={q.id}
                    className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4 transition-all"
                  >
                    {/* Question Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            Soru {qIndex + 1} • {formatQuestionType(q.type, isQuiz)}
                          </span>

                          {q.category && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                              {q.category}
                            </span>
                          )}

                          {isQuiz && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <Award className="w-3 h-3 text-amber-600" />
                              <span>Quiz ({q.points || 10}P)</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                          {q.title}
                        </h3>

                        {q.description && (
                          <p className="text-xs text-slate-500 leading-relaxed">
                            {q.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block font-medium">Bu Oturumdaki Yanıt</span>
                          <span className="text-base font-black text-slate-900">
                            {totalVotes} {totalVotes === 1 ? 'Kişi' : 'Kişi'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* CHART & RESULTS VISUALIZATION */}
                    {totalVotes === 0 && q.type !== 'attendance' ? (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                        Bu oturumda bu soruya henüz katılımcı yanıtı kaydedilmedi.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* 1. MULTIPLE CHOICE CHART */}
                        {q.type === 'multiple_choice' && summary?.choiceDistribution && (
                          <div className="space-y-4">
                            {/* Option Bars */}
                            <div className="space-y-2.5">
                              {Object.entries(summary.choiceDistribution).map(([opt, count], optIdx) => {
                                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                                const isCorrect = isQuiz && String(q.correctAnswer) === opt;

                                return (
                                  <div
                                    key={opt}
                                    className={`p-3 rounded-2xl border transition-all ${
                                      isCorrect
                                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                                        : 'bg-slate-50/60 border-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                                      <span className="font-bold text-slate-900 flex items-center gap-1.5 min-w-0">
                                        <span className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0">
                                          {String.fromCharCode(65 + optIdx)}
                                        </span>
                                        <span className="truncate">{opt}</span>
                                        {isCorrect && (
                                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-extrabold flex items-center gap-0.5 shrink-0">
                                            <CheckCircle2 className="w-2.5 h-2.5" />
                                            <span>Doğru Cevap</span>
                                          </span>
                                        )}
                                      </span>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="font-mono text-slate-500 font-bold">{count} oy</span>
                                        <span className={`font-mono text-xs font-black px-2 py-0.5 rounded-lg ${
                                          isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-800'
                                        }`}>
                                          %{pct}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Animated Progress Bar */}
                                    <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                                      <div
                                        className={`h-2.5 rounded-full transition-all duration-500 ${
                                          isCorrect ? 'bg-emerald-500' : 'bg-blue-600'
                                        }`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Recharts Bar Comparison Chart */}
                            {totalVotes > 0 && (
                              <div className="p-3 bg-white rounded-2xl border border-slate-100">
                                <span className="text-[11px] font-bold text-slate-400 block mb-2 uppercase tracking-wider">
                                  Görsel Seçenek Karşılaştırması
                                </span>
                                <div className="h-44 w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                      data={Object.entries(summary.choiceDistribution).map(([opt, count], i) => ({
                                        name: opt.length > 15 ? opt.substring(0, 13) + '...' : opt,
                                        fullName: opt,
                                        oy: count,
                                        color: isQuiz && String(q.correctAnswer) === opt ? '#10b981' : CHART_COLORS[i % CHART_COLORS.length],
                                      }))}
                                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                                    >
                                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                      <Tooltip 
                                        formatter={(val: any) => [`${val} Oy`, 'Oy Sayısı']}
                                        labelFormatter={(label, items) => items?.[0]?.payload?.fullName || label}
                                        contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e2e8f0' }}
                                      />
                                      <Bar dataKey="oy" radius={[6, 6, 0, 0]}>
                                        {Object.entries(summary.choiceDistribution).map(([opt], i) => (
                                          <Cell 
                                            key={`cell-${i}`} 
                                            fill={isQuiz && String(q.correctAnswer) === opt ? '#10b981' : CHART_COLORS[i % CHART_COLORS.length]} 
                                          />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. TRUE / FALSE CHART */}
                        {q.type === 'true_false' && summary?.trueFalseDistribution && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              {/* True Metric Card */}
                              <div className={`p-4 rounded-2xl border text-center transition-all ${
                                isQuiz && (q.correctAnswer === true || q.correctAnswer === 'true')
                                  ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200'
                                  : 'bg-emerald-50/50 border-emerald-100'
                              }`}>
                                <div className="flex items-center justify-center gap-1 text-xs font-extrabold text-emerald-800 mb-1">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  <span>DOĞRU (True)</span>
                                  {isQuiz && (q.correctAnswer === true || q.correctAnswer === 'true') && (
                                    <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-sm ml-1 font-bold">
                                      Doğru Cevap
                                    </span>
                                  )}
                                </div>
                                <span className="text-2xl font-black text-emerald-900 block">
                                  {summary.trueFalseDistribution.trueCount}
                                </span>
                                <span className="text-xs text-emerald-700 font-bold block mt-0.5">
                                  %{totalVotes > 0 ? Math.round((summary.trueFalseDistribution.trueCount / totalVotes) * 100) : 0} Oran
                                </span>
                              </div>

                              {/* False Metric Card */}
                              <div className={`p-4 rounded-2xl border text-center transition-all ${
                                isQuiz && (q.correctAnswer === false || q.correctAnswer === 'false')
                                  ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-200'
                                  : 'bg-rose-50/50 border-rose-100'
                              }`}>
                                <div className="flex items-center justify-center gap-1 text-xs font-extrabold text-rose-800 mb-1">
                                  <XCircle className="w-4 h-4 text-rose-600" />
                                  <span>YANLIŞ (False)</span>
                                  {isQuiz && (q.correctAnswer === false || q.correctAnswer === 'false') && (
                                    <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded-sm ml-1 font-bold">
                                      Doğru Cevap
                                    </span>
                                  )}
                                </div>
                                <span className="text-2xl font-black text-rose-900 block">
                                  {summary.trueFalseDistribution.falseCount}
                                </span>
                                <span className="text-xs text-rose-700 font-bold block mt-0.5">
                                  %{totalVotes > 0 ? Math.round((summary.trueFalseDistribution.falseCount / totalVotes) * 100) : 0} Oran
                                </span>
                              </div>
                            </div>

                            {/* Proportional Split Bar */}
                            <div className="space-y-1">
                              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
                                <div
                                  className="bg-emerald-500 h-full transition-all duration-500"
                                  style={{
                                    width: `${totalVotes > 0 ? (summary.trueFalseDistribution.trueCount / totalVotes) * 100 : 50}%`,
                                  }}
                                  title={`Doğru: ${summary.trueFalseDistribution.trueCount}`}
                                />
                                <div
                                  className="bg-rose-500 h-full transition-all duration-500"
                                  style={{
                                    width: `${totalVotes > 0 ? (summary.trueFalseDistribution.falseCount / totalVotes) * 100 : 50}%`,
                                  }}
                                  title={`Yanlış: ${summary.trueFalseDistribution.falseCount}`}
                                />
                              </div>
                              <div className="flex justify-between text-[11px] text-slate-500 font-semibold px-1">
                                <span>Doğru: {summary.trueFalseDistribution.trueCount} oy</span>
                                <span>Yanlış: {summary.trueFalseDistribution.falseCount} oy</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 3. RATING POOL CHART */}
                        {q.type === 'rating_pool' && summary?.ratingDistribution && (
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-200">
                              <div className="text-center sm:text-left shrink-0">
                                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                                  Ortalama Puan
                                </span>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                  <span className="text-3xl font-black text-amber-950">
                                    {summary.ratingAverage || '0.0'}
                                  </span>
                                  <span className="text-xs font-bold text-amber-700">/ {q.ratingMax || 5}</span>
                                </div>
                                <div className="flex items-center gap-0.5 text-amber-500 mt-1">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className={`w-4 h-4 ${
                                        s <= Math.round(summary.ratingAverage || 0)
                                          ? 'fill-amber-400 text-amber-400'
                                          : 'text-slate-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>

                              {/* Star Level Distribution Bars */}
                              <div className="flex-1 w-full space-y-1.5">
                                {Object.entries(summary.ratingDistribution)
                                  .sort(([a], [b]) => Number(b) - Number(a))
                                  .map(([star, count]) => {
                                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                                    return (
                                      <div key={star} className="flex items-center gap-2 text-xs">
                                        <span className="font-bold text-slate-700 w-8 shrink-0 flex items-center gap-0.5">
                                          <span>{star}</span>
                                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                        </span>
                                        <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                                          <div
                                            className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                        <span className="font-mono text-slate-500 font-bold w-12 text-right shrink-0">
                                          {count} (%{pct})
                                        </span>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 4. SHORT & LONG TEXT RESPONSES */}
                        {(q.type === 'short_text' || q.type === 'long_text') && summary?.textAnswers && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span className="font-bold text-slate-700">
                                Katılımcıların Yazdığı Metinler ({summary.textAnswers.length})
                              </span>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {summary.textAnswers.map((ans, aIdx) => (
                                <div
                                  key={ans.id || aIdx}
                                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                      <span>{ans.participantAvatar || '👤'}</span>
                                      <span>{ans.participantName || 'Anonim Katılımcı'}</span>
                                    </span>
                                    <span>
                                      {new Date(ans.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-slate-800 font-medium leading-relaxed break-words">
                                    "{ans.text}"
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 5. ATTENDANCE SUMMARY */}
                        {q.type === 'attendance' && (
                          <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-600" />
                                <div>
                                  <h4 className="font-extrabold text-indigo-950 text-sm">Oturum Yoklama Kayıtları</h4>
                                  <p className="text-xs text-indigo-700">
                                    Toplam {sessionAttendance.length} öğrenci/katılımcı doğrulandı.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveTab('attendance')}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs cursor-pointer"
                              >
                                Listeyi İncele
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Quiz Summary Stats Badge (if quiz) */}
                        {isQuiz && summary?.quizStats && (
                          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-amber-500" />
                              <span className="font-bold text-slate-800">Quiz Başarı Durumu:</span>
                              <span className="text-emerald-700 font-bold">
                                {summary.quizStats.correctCount} Doğru
                              </span>
                              <span>•</span>
                              <span className="text-rose-700 font-bold">
                                {summary.quizStats.wrongCount} Yanlış
                              </span>
                            </div>

                            <span className="font-mono font-black text-slate-900 px-2.5 py-0.5 bg-white rounded-lg border border-slate-200">
                              %{summary.quizStats.correctPercentage} Başarı Oranı
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-500">
            * Yanıtlar ve grafikler doğrudan seçilen <strong>{session.title}</strong> oturumuyla ilişkilendirilmiştir.
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Raporu CSV Kaydet</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
