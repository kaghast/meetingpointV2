import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Send, 
  CheckCircle, 
  MessageSquare, 
  ThumbsUp, 
  Clock, 
  Star, 
  Check, 
  Lock,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  XCircle,
  HelpCircle,
  Award,
  Archive,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { Question, Answer, AnonymousFeedback, QuestionResultsSummary, ParticipantProfile, AttendanceRecord } from '../types';
import { AttendanceForm } from './AttendanceForm';

interface ParticipantViewProps {
  participantId: string;
  profile: ParticipantProfile;
  activeQuestion: Question | null;
  pollStatus: 'open' | 'closed';
  showResults: boolean;
  sessionEnded?: boolean;
  isArchived?: boolean;
  sessionTitle?: string;
  sessionCode?: string;
  sessionDate?: string;
  startTime?: string;
  endTime?: string;
  participantAnswer: Answer | null;
  participantAttendanceRecord?: AttendanceRecord | null;
  attendanceExpiresAt?: number | null;
  attendanceSecondsLeft?: number | null;
  results: QuestionResultsSummary | null;
  feedbackList: AnonymousFeedback[];
  onOpenLeaderboard: () => void;
  onSubmitAnswer: (questionId: string, value: any) => Promise<{ success: boolean; isCorrect?: boolean; pointsEarned?: number; error?: string }>;
  onSubmitAttendance: (data: { studentNumber: string; fullName: string; location: any; deviceSignature: any }) => Promise<{ success: boolean; record?: AttendanceRecord; error?: string }>;
  onSubmitFeedback: (message: string, category: 'feedback' | 'question' | 'suggestion') => Promise<boolean>;
  onUpvoteFeedback: (feedbackId: string) => Promise<boolean>;
}

export const ParticipantView: React.FC<ParticipantViewProps> = ({
  participantId,
  profile,
  activeQuestion,
  pollStatus,
  showResults,
  sessionEnded = false,
  isArchived = false,
  sessionTitle,
  sessionCode,
  sessionDate,
  startTime,
  endTime,
  participantAnswer,
  participantAttendanceRecord,
  attendanceExpiresAt,
  attendanceSecondsLeft,
  results,
  feedbackList,
  onOpenLeaderboard,
  onSubmitAnswer,
  onSubmitAttendance,
  onSubmitFeedback,
  onUpvoteFeedback,
}) => {
  // Active response state
  const [textInput, setTextInput] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<string>('');
  const [selectedMultiChoices, setSelectedMultiChoices] = useState<string[]>([]);
  const [selectedBoolean, setSelectedBoolean] = useState<boolean | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Anonymous Q&A state
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<'feedback' | 'question' | 'suggestion'>('question');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'poll' | 'feedback'>('poll');

  // Sync inputs with existing answer or reset when active question changes
  useEffect(() => {
    if (participantAnswer && activeQuestion && participantAnswer.questionId === activeQuestion.id) {
      if (activeQuestion.type === 'short_text' || activeQuestion.type === 'long_text') {
        setTextInput(String(participantAnswer.value || ''));
      } else if (activeQuestion.type === 'multiple_choice') {
        if (Array.isArray(participantAnswer.value)) {
          setSelectedMultiChoices(participantAnswer.value);
        } else {
          setSelectedChoice(String(participantAnswer.value || ''));
        }
      } else if (activeQuestion.type === 'true_false') {
        setSelectedBoolean(Boolean(participantAnswer.value));
      } else if (activeQuestion.type === 'rating_pool') {
        setSelectedRating(Number(participantAnswer.value) || null);
      }
    } else {
      setTextInput('');
      setSelectedChoice('');
      setSelectedMultiChoices([]);
      setSelectedBoolean(null);
      setSelectedRating(null);
      setSubmitError('');
    }
  }, [activeQuestion?.id, participantAnswer]);

  // Check if participant has already answered this question
  const hasAnswered = Boolean(
    participantAnswer && activeQuestion && participantAnswer.questionId === activeQuestion.id
  );

  // STRICT REQUIREMENT:
  // "Sonuçlar ancak oturum bitirince gözükmeli. Yönetici oturumu arşive atarsa sonuçlar kesinlikle gösterilmemeli."
  const canViewResults = !isArchived && sessionEnded && showResults && Boolean(results);

  const handleSubmitPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuestion || pollStatus !== 'open' || hasAnswered || sessionEnded) return;

    let val: any = null;
    if (activeQuestion.type === 'short_text' || activeQuestion.type === 'long_text') {
      if (!textInput.trim()) return;
      val = textInput.trim();
    } else if (activeQuestion.type === 'multiple_choice') {
      if (activeQuestion.allowMultiple) {
        if (selectedMultiChoices.length === 0) return;
        val = selectedMultiChoices;
      } else {
        if (!selectedChoice) return;
        val = selectedChoice;
      }
    } else if (activeQuestion.type === 'true_false') {
      if (selectedBoolean === null) return;
      val = selectedBoolean;
    } else if (activeQuestion.type === 'rating_pool') {
      if (selectedRating === null) return;
      val = selectedRating;
    }

    setIsSubmitting(true);
    setSubmitError('');
    const res = await onSubmitAnswer(activeQuestion.id, val);
    setIsSubmitting(false);
    if (!res.success && res.error) {
      setSubmitError(res.error);
    }
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;

    setIsSubmittingFeedback(true);
    const success = await onSubmitFeedback(feedbackMessage.trim(), feedbackCategory);
    setIsSubmittingFeedback(false);
    if (success) {
      setFeedbackMessage('');
      setFeedbackSuccess(true);
      setTimeout(() => setFeedbackSuccess(false), 3000);
    }
  };

  const toggleMultiChoice = (opt: string) => {
    if (hasAnswered) return;
    if (selectedMultiChoices.includes(opt)) {
      setSelectedMultiChoices(selectedMultiChoices.filter((o) => o !== opt));
    } else {
      setSelectedMultiChoices([...selectedMultiChoices, opt]);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-3 sm:py-5 space-y-4">
      {/* ARCHIVED BANNER: STRICT RULE */}
      {isArchived ? (
        <div className="bg-slate-800 rounded-2xl p-4 text-white shadow-md flex items-center gap-3 border border-slate-700">
          <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-slate-300 shrink-0">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-100">Bu Oturum Arşivlenmiştir</h3>
            <p className="text-xs text-slate-400">
              Yönetici bu oturumu arşive almıştır. Sonuçlar ve oylama erişime kapatılmıştır.
            </p>
          </div>
        </div>
      ) : sessionEnded ? (
        /* SESSION ENDED BANNER */
        <div className="bg-linear-to-r from-amber-500 to-yellow-600 rounded-2xl p-4 text-white shadow-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">Toplantı Oturumu Tamamlandı!</h3>
              <p className="text-xs text-amber-100">Katılımınız için teşekkürler. Sonuçlar ve liderlik tablosu açıklandı.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="px-3.5 py-2 bg-white text-amber-900 font-bold text-xs rounded-xl shadow-xs hover:bg-amber-50 transition-colors shrink-0 cursor-pointer"
          >
            Sıralamayı Gör
          </button>
        </div>
      ) : null}

      {/* Main Tab Navigation */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
        <button
          id="participant-tab-poll"
          type="button"
          onClick={() => setActiveTab('poll')}
          className={`flex-1 py-2 text-center rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'poll'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Canlı Oturum Sorusu</span>
          {activeQuestion && pollStatus === 'open' && !hasAnswered && !sessionEnded && !isArchived && (
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse inline-block ml-0.5" />
          )}
        </button>
        <button
          id="participant-tab-feedback"
          type="button"
          onClick={() => setActiveTab('feedback')}
          className={`flex-1 py-2 text-center rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'feedback'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
          <span>Anonim Soru &amp; Görüş İlet</span>
          {feedbackList.length > 0 && (
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px]">
              {feedbackList.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: ACTIVE QUESTION / POLL */}
      {activeTab === 'poll' && (
        <div className="space-y-4">
          {!activeQuestion ? (
            /* No active question */
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 animate-spin-slow" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">Oturum Yöneticisi Bekleniyor</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Yönetici yeni bir soru veya anket başlattığında ekranda anında görünecektir. Sayfayı kapatmayın.
              </p>
            </div>
          ) : activeQuestion.type === 'attendance' ? (
            /* Attendance (Yoklama) 90-Second Form */
            <AttendanceForm
              questionId={activeQuestion.id}
              sessionTitle={sessionTitle}
              pollStatus={pollStatus}
              attendanceExpiresAt={attendanceExpiresAt}
              attendanceSecondsLeft={attendanceSecondsLeft}
              participantRecord={participantAttendanceRecord}
              onSubmit={onSubmitAttendance}
            />
          ) : (
            /* Active Question Card */
            <div id="participant-active-question-card" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Poll Status Banner */}
              <div
                className={`px-5 py-2.5 border-b text-xs flex items-center justify-between font-semibold ${
                  isArchived
                    ? 'bg-slate-100 border-slate-200 text-slate-700'
                    : sessionEnded
                    ? 'bg-purple-50 border-purple-100 text-purple-900'
                    : pollStatus === 'open'
                    ? 'bg-blue-50/80 border-blue-100 text-blue-900'
                    : 'bg-amber-50 border-amber-100 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isArchived
                        ? 'bg-slate-400'
                        : sessionEnded
                        ? 'bg-purple-600'
                        : pollStatus === 'open'
                        ? 'bg-blue-600 animate-pulse'
                        : 'bg-amber-600'
                    }`}
                  />
                  <span>
                    {isArchived
                      ? 'Oturum Arşivlendi'
                      : sessionEnded
                      ? 'Oturum Tamamlandı (Sonuçlar Açıklandı)'
                      : pollStatus === 'open'
                      ? 'Canlı Oylama Açık'
                      : 'Oylama Şu An Durduruldu'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {activeQuestion.category && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/80 border border-slate-200 text-slate-700">
                      {activeQuestion.category}
                    </span>
                  )}
                  {activeQuestion.isQuiz && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white flex items-center gap-1 shadow-2xs">
                      <Award className="w-3 h-3" />
                      <span>QUIZ • {activeQuestion.points || 10}P</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-6">
                {/* Question Header */}
                <div className="mb-5">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                    {activeQuestion.title}
                  </h2>
                  {activeQuestion.description && (
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      {activeQuestion.description}
                    </p>
                  )}
                </div>

                {submitError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Question Form / Response Area */}
                {!hasAnswered && !sessionEnded && !isArchived ? (
                  <form onSubmit={handleSubmitPoll} className="space-y-4">
                    {/* TYPE 1: MULTIPLE CHOICE */}
                    {activeQuestion.type === 'multiple_choice' && (
                      <div className="space-y-2">
                        {activeQuestion.options?.map((opt, idx) => {
                          const isSelected = activeQuestion.allowMultiple
                            ? selectedMultiChoices.includes(opt)
                            : selectedChoice === opt;

                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={pollStatus !== 'open'}
                              onClick={() => {
                                if (activeQuestion.allowMultiple) {
                                  toggleMultiChoice(opt);
                                } else {
                                  setSelectedChoice(opt);
                                }
                              }}
                              className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 text-xs sm:text-sm font-medium ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-bold shadow-xs'
                                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/60 text-slate-700'
                              } ${pollStatus !== 'open' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 transition-colors ${
                                    isSelected
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <span className="truncate">{opt}</span>
                              </div>

                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* TYPE 2: TRUE / FALSE */}
                    {activeQuestion.type === 'true_false' && (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={pollStatus !== 'open'}
                          onClick={() => setSelectedBoolean(true)}
                          className={`py-4 px-4 rounded-2xl border flex flex-col items-center justify-center gap-2 font-bold text-sm transition-all ${
                            selectedBoolean === true
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.02]'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/40'
                          } ${pollStatus !== 'open' ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <span className="text-2xl">👍</span>
                          <span>DOĞRU (True)</span>
                        </button>

                        <button
                          type="button"
                          disabled={pollStatus !== 'open'}
                          onClick={() => setSelectedBoolean(false)}
                          className={`py-4 px-4 rounded-2xl border flex flex-col items-center justify-center gap-2 font-bold text-sm transition-all ${
                            selectedBoolean === false
                              ? 'bg-rose-600 text-white border-rose-600 shadow-md scale-[1.02]'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-rose-300 hover:bg-rose-50/40'
                          } ${pollStatus !== 'open' ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <span className="text-2xl">👎</span>
                          <span>YANLIŞ (False)</span>
                        </button>
                      </div>
                    )}

                    {/* TYPE 3: RATING POOL */}
                    {activeQuestion.type === 'rating_pool' && (
                      <div className="space-y-4 py-2">
                        <div className="flex items-center justify-between gap-1">
                          {Array.from({ length: activeQuestion.ratingMax || 5 }, (_, i) => i + 1).map((val) => {
                            const isSelected = selectedRating === val;
                            return (
                              <button
                                key={val}
                                type="button"
                                disabled={pollStatus !== 'open'}
                                onClick={() => setSelectedRating(val)}
                                className={`flex-1 aspect-square max-w-[54px] rounded-2xl border font-extrabold text-sm sm:text-base flex flex-col items-center justify-center transition-all ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50'
                                } ${pollStatus !== 'open' ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                <span>{val}</span>
                                <Star className={`w-3 h-3 mt-0.5 ${isSelected ? 'fill-white text-white' : 'text-slate-300'}`} />
                              </button>
                            );
                          })}
                        </div>
                        {activeQuestion.ratingLabels && (
                          <div className="flex justify-between text-xs text-slate-500 font-medium px-1">
                            <span>{activeQuestion.ratingLabels.min}</span>
                            <span>{activeQuestion.ratingLabels.max}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TYPE 4 & 5: SHORT TEXT & LONG TEXT */}
                    {(activeQuestion.type === 'short_text' || activeQuestion.type === 'long_text') && (
                      <div>
                        <textarea
                          rows={activeQuestion.type === 'long_text' ? 4 : 2}
                          maxLength={600}
                          disabled={pollStatus !== 'open'}
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          placeholder="Yanıtınızı veya düşüncenizi buraya yazın..."
                          className="w-full p-3 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                        <div className="flex justify-between text-[11px] text-slate-400 mt-1 px-1">
                          <span>Anonim açık uçlu düşünceler</span>
                          <span>{textInput.length}/600</span>
                        </div>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      id="participant-submit-answer-btn"
                      type="submit"
                      disabled={
                        pollStatus !== 'open' ||
                        isSubmitting ||
                        (activeQuestion.type === 'short_text' && !textInput.trim()) ||
                        (activeQuestion.type === 'long_text' && !textInput.trim()) ||
                        (activeQuestion.type === 'multiple_choice' &&
                          (activeQuestion.allowMultiple ? selectedMultiChoices.length === 0 : !selectedChoice)) ||
                        (activeQuestion.type === 'true_false' && selectedBoolean === null) ||
                        (activeQuestion.type === 'rating_pool' && selectedRating === null)
                      }
                      className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isSubmitting ? 'Cevabınız İletiliyor...' : 'Yanıtı Gönder'}</span>
                    </button>
                  </form>
                ) : (
                  /* ALREADY ANSWERED OR SESSION ENDED */
                  <div className="space-y-4">
                    {hasAnswered && (
                      <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 text-emerald-950 flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs sm:text-sm">Yanıtınız Başarıyla Kaydedildi!</h4>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full">
                              <Lock className="w-3 h-3" />
                              <span>Kilitlendi (Değiştirilemez)</span>
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs text-emerald-800">
                            <span className="font-medium text-emerald-900">Seçilen Yanıt: </span>
                            <span className="font-bold">
                              {Array.isArray(participantAnswer?.value)
                                ? participantAnswer?.value.join(', ')
                                : String(participantAnswer?.value === true ? 'Doğru (True)' : participantAnswer?.value === false ? 'Yanlış (False)' : participantAnswer?.value)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quiz Result Banner: Only if session ended & not archived */}
                    {activeQuestion.isQuiz && (
                      <div className={`p-4 rounded-2xl border ${
                        participantAnswer?.isCorrect
                          ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {participantAnswer?.isCorrect ? (
                              <>
                                <span className="text-xl">🎉</span>
                                <div>
                                  <div className="font-bold text-sm text-amber-900">Tebrikler, Doğru Yanıt!</div>
                                  <div className="text-xs text-amber-700">+{participantAnswer?.pointsEarned || activeQuestion.points || 10} Puan Kazandınız</div>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="text-xl">💡</span>
                                <div>
                                  <div className="font-bold text-sm text-slate-800">Cevabınız Kilitlendi</div>
                                  <div className="text-xs text-slate-500">
                                    {sessionEnded ? 'Doğru yanıt aşağıda belirtilmiştir.' : 'Sonuçlar oturum bitirildiğinde açıklanacaktır.'}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Leaderboard button is ONLY clickable when session ended and not archived */}
                          {sessionEnded && !isArchived && (
                            <button
                              type="button"
                              onClick={onOpenLeaderboard}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                            >
                              <Trophy className="w-3.5 h-3.5" />
                              <span>Sıralama</span>
                            </button>
                          )}
                        </div>

                        {activeQuestion.explanation && canViewResults && (
                          <div className="mt-3 pt-3 border-t border-amber-200/60 text-xs text-slate-600">
                            <strong>Açıklama: </strong>{activeQuestion.explanation}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pending session finish message */}
                    {!sessionEnded && !isArchived && (
                      <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-900 flex items-center gap-3">
                        <Clock className="w-5 h-5 text-blue-600 shrink-0" />
                        <div>
                          <div className="font-bold text-blue-950">Sonuçlar Bekleniyor</div>
                          <div className="text-blue-700 mt-0.5">
                            Toplantı oylama sonuçları ve sıralama, yönetici oturumu tamamladığında açıklanacaktır.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Show Results ONLY if session is ended AND not archived */}
                {canViewResults && results && (
                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Toplantı Oylama Sonuçları</h4>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        {results.totalVotes} {results.totalVotes === 1 ? 'oy' : 'oy'}
                      </span>
                    </div>

                    {/* Results for Multiple Choice */}
                    {activeQuestion.type === 'multiple_choice' && results.choiceDistribution && (
                      <div className="space-y-2">
                        {Object.entries(results.choiceDistribution).map(([choice, count]) => {
                          const pct = results.totalVotes > 0 ? Math.round((count / results.totalVotes) * 100) : 0;
                          return (
                            <div key={choice} className="space-y-1">
                              <div className="flex justify-between text-xs text-slate-700">
                                <span className="font-medium truncate pr-2">{choice}</span>
                                <span className="font-mono text-slate-500 shrink-0">
                                  {count} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Results for True / False */}
                    {activeQuestion.type === 'true_false' && results.trueFalseDistribution && (
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                          <span className="text-xs font-bold text-emerald-800 block">Doğru (True)</span>
                          <span className="text-xl font-extrabold text-emerald-900 mt-1 block">
                            {results.trueFalseDistribution.trueCount}
                          </span>
                        </div>
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-center">
                          <span className="text-xs font-bold text-rose-800 block">Yanlış (False)</span>
                          <span className="text-xl font-extrabold text-rose-900 mt-1 block">
                            {results.trueFalseDistribution.falseCount}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Results for Rating Pool */}
                    {activeQuestion.type === 'rating_pool' && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-slate-500 font-medium block">Ortalama Puan</span>
                          <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">
                            {results.ratingAverage || 0} <span className="text-xs text-slate-400 font-normal">/ {activeQuestion.ratingMax || 5}</span>
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {Array.from({ length: activeQuestion.ratingMax || 5 }, (_, i) => i + 1).map((val) => {
                            const isAvg = Math.round(results.ratingAverage || 0) >= val;
                            return (
                              <Star
                                key={val}
                                className={`w-5 h-5 ${isAvg ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Results for Short / Long Text */}
                    {(activeQuestion.type === 'short_text' || activeQuestion.type === 'long_text') && (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {results.textAnswers && results.textAnswers.length > 0 ? (
                          results.textAnswers.map((item) => (
                            <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                                <span className="font-semibold text-slate-700 flex items-center gap-1">
                                  <span>{item.participantAvatar || '👤'}</span>
                                  <span>{item.participantName || 'Anonim'}</span>
                                </span>
                                <span>{new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-slate-800 font-medium leading-relaxed">{item.text}</p>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                            Henüz iletilen metin yanıtı bulunmuyor.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ANONYMOUS FEEDBACK & QUESTIONS (Soru & Görüş İlet) */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Anonim Soru &amp; Görüş İletin</h3>
                <p className="text-[11px] text-slate-500">
                  Kimliğiniz tamamen gizlidir. İlettiğiniz soru yönetici paneline ilgili oturum altında düşer.
                </p>
              </div>
            </div>

            {feedbackSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Mesajınız oturum yöneticisine anonim olarak iletildi!</span>
              </div>
            )}

            <form onSubmit={handleSendFeedback} className="space-y-3">
              {/* Category Selector */}
              <div className="flex gap-2">
                {(['question', 'feedback', 'suggestion'] as const).map((cat) => {
                  const label = cat === 'question' ? '❓ Soru' : cat === 'feedback' ? '💬 Geri Bildirim' : '💡 Öneri';
                  const isSel = feedbackCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFeedbackCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isSel
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div>
                <textarea
                  rows={3}
                  maxLength={400}
                  placeholder="Toplantı hakkında anonim sorunuz veya görüşünüz nedir?..."
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-medium resize-none"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1 px-1">
                  <span>Gönderen: {profile.avatar} {profile.name} (Anonim)</span>
                  <span>{feedbackMessage.length}/400</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingFeedback || !feedbackMessage.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmittingFeedback ? 'İletiliyor...' : 'Anonim Olarak Gönder'}</span>
              </button>
            </form>
          </div>

          {/* Feedback Feed */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Oturumda Paylaşılanlar ({feedbackList.length})
            </h4>

            {feedbackList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-400">
                Henüz soru veya görüş iletilmedi. İlk soruyu siz sorun!
              </div>
            ) : (
              feedbackList.map((fb) => (
                <div key={fb.id} className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <span>{fb.participantAvatar || '👤'}</span>
                      <span>{fb.participantName || 'Anonim'}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {fb.category === 'question' ? 'Soru' : fb.category === 'feedback' ? 'Görüş' : 'Öneri'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(fb.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                    {fb.message}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={() => onUpvoteFeedback(fb.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors font-semibold cursor-pointer"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{fb.upvotes || 0} Beğeni</span>
                    </button>
                    {fb.isRead && (
                      <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Yönetici Tarafından İncelendi</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
