import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Search, 
  Plus, 
  Trash2, 
  Flame, 
  Award, 
  HelpCircle,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { MeetingSession, Question, Answer, QuestionType } from '../types';

interface SessionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sessionData: Partial<MeetingSession>) => Promise<boolean>;
  sessionToEdit: MeetingSession | null;
  allQuestions: Question[];
  answers?: Answer[];
}

const formatQuestionType = (type: QuestionType, isQuiz?: boolean): string => {
  if (isQuiz) return 'Quiz Sorusu';
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
      return 'Açık Uçlu';
    default:
      return type;
  }
};

export const SessionEditorModal: React.FC<SessionEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  sessionToEdit,
  allQuestions = [],
  answers = [],
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:30');
  const [assignedQuestionIds, setAssignedQuestionIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notification, setNotification] = useState('');

  // Autocomplete Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // References to keep track of questions and answers without forcing useEffect re-runs
  const allQuestionsRef = useRef<Question[]>(allQuestions);
  allQuestionsRef.current = allQuestions;

  const answersRef = useRef<Answer[]>(answers);
  answersRef.current = answers;

  // Track modal open transitions so user typing is NEVER wiped out by parent poll updates
  const prevOpenRef = useRef(false);
  const prevSessionIdRef = useRef<string | null>(null);

  // Helper to compute question popularity (answer count across all sessions)
  const getQuestionPopularity = (qId: string): number => {
    const ansList = answersRef.current || [];
    return ansList.filter((a) => a.questionId === qId).length;
  };

  // Helper to calculate top 10 most preferred / answered questions
  const getTop10QuestionIds = (): string[] => {
    const list = allQuestionsRef.current || [];
    if (list.length === 0) return [];

    const sorted = [...list].sort((a, b) => {
      const popA = getQuestionPopularity(a.id);
      const popB = getQuestionPopularity(b.id);
      if (popB !== popA) {
        return popB - popA;
      }
      if (a.isQuiz !== b.isQuiz) {
        return (b.isQuiz ? 1 : 0) - (a.isQuiz ? 1 : 0);
      }
      return 0;
    });

    return sorted.slice(0, 10).map((q) => q.id);
  };

  // Initialize form strictly when modal transitions from closed to open,
  // or when targeted sessionToEdit changes ID.
  // CRITICAL: Does NOT re-run on parent polling/allQuestions re-render, preventing title erasure!
  useEffect(() => {
    const currentSessionId = sessionToEdit?.id || null;
    const isOpening = isOpen && !prevOpenRef.current;
    const isDifferentSession = isOpen && currentSessionId !== prevSessionIdRef.current;

    if (isOpening || isDifferentSession) {
      prevSessionIdRef.current = currentSessionId;

      if (sessionToEdit) {
        setTitle(sessionToEdit.title || '');
        setDescription(sessionToEdit.description || '');
        setDate(sessionToEdit.date || new Date().toISOString().split('T')[0]);
        setStartTime(sessionToEdit.startTime || '10:00');
        setEndTime(sessionToEdit.endTime || '11:30');
        setAssignedQuestionIds(
          Array.isArray(sessionToEdit.assignedQuestionIds) && sessionToEdit.assignedQuestionIds.length > 0
            ? sessionToEdit.assignedQuestionIds
            : getTop10QuestionIds()
        );
      } else {
        // Creating NEW session:
        // Set title and description empty, and default to the Top 10 most preferred questions!
        setTitle('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setStartTime('10:00');
        setEndTime('11:30');
        setAssignedQuestionIds(getTop10QuestionIds());
      }
      setErrorMsg('');
      setNotification('');
      setSearchQuery('');
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }

    prevOpenRef.current = isOpen;
  }, [isOpen, sessionToEdit]);

  // Click outside to close autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter questions for autocomplete dropdown
  const filteredSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      // When query is empty, suggest unassigned questions, prioritize most popular
      return allQuestions
        .filter((q) => !assignedQuestionIds.includes(q.id))
        .sort((a, b) => getQuestionPopularity(b.id) - getQuestionPopularity(a.id))
        .slice(0, 10);
    }

    return allQuestions
      .filter((q) => {
        const matchTitle = q.title.toLowerCase().includes(query);
        const matchDesc = q.description?.toLowerCase().includes(query);
        const matchCat = q.category?.toLowerCase().includes(query);
        const matchTags = q.tags?.some((t) => t.toLowerCase().includes(query));
        const matchType = q.type.toLowerCase().includes(query) || (q.isQuiz && 'quiz'.includes(query));
        return matchTitle || matchDesc || matchCat || matchTags || matchType;
      })
      .slice(0, 12);
  }, [allQuestions, searchQuery, assignedQuestionIds]);

  if (!isOpen) return null;

  // Question assignment toggles & helpers
  const handleAssignTop10 = () => {
    const top10 = getTop10QuestionIds();
    setAssignedQuestionIds(top10);
    setNotification(`🔥 En çok tercih edilen ${top10.length} soru oturuma atandı.`);
    setTimeout(() => setNotification(''), 4000);
  };

  const addQuestionById = (qId: string) => {
    if (!assignedQuestionIds.includes(qId)) {
      setAssignedQuestionIds((prev) => [...prev, qId]);
      setNotification('✓ Soru oturuma eklendi.');
      setTimeout(() => setNotification(''), 2500);
    }
  };

  const removeQuestionById = (qId: string) => {
    setAssignedQuestionIds((prev) => prev.filter((id) => id !== qId));
  };

  const toggleQuestionAssignment = (qId: string) => {
    if (assignedQuestionIds.includes(qId)) {
      removeQuestionById(qId);
    } else {
      addQuestionById(qId);
    }
  };

  // Keyboard navigation for autocomplete
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || filteredSuggestions.length === 0) {
      if (e.key === 'ArrowDown') {
        setIsDropdownOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => 
        prev < filteredSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => 
        prev > 0 ? prev - 1 : filteredSuggestions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        const selected = filteredSuggestions[highlightedIndex];
        addQuestionById(selected.id);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Lütfen oturum başlığını giriniz.');
      return;
    }
    if (!date) {
      setErrorMsg('Lütfen oturum tarihini seçiniz.');
      return;
    }
    if (!startTime || !endTime) {
      setErrorMsg('Lütfen geçerli saat aralıklarını belirleyiniz.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    const success = await onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      startTime,
      endTime,
      assignedQuestionIds,
    });

    setIsSaving(false);
    if (success) {
      onClose();
    } else {
      setErrorMsg('Oturum kaydedilirken bir hata oluştu.');
    }
  };

  const isEditing = Boolean(sessionToEdit);
  const isArchived = sessionToEdit?.isArchived;

  // Questions currently assigned, preserved in assignment order
  const assignedQuestions = assignedQuestionIds
    .map((id) => allQuestions.find((q) => q.id === id))
    .filter((q): q is Question => Boolean(q));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                {isEditing ? 'Oturumu Düzenle' : 'Yeni Toplantı Oturumu Oluştur'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Oturumun adı, tarihi, saat aralıkları ve atanacak soruları belirleyin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {notification && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-medium text-xs">{notification}</span>
            </div>
          )}

          {isArchived && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Bu oturum arşivlenmiştir. Bilgilerini düzenlemek için önce arşivden çıkarınız.</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">
              Oturum Başlığı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isArchived}
              placeholder="Örn: Pazarlama Haftalık Senkronizasyon"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Date & Time Interval */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Tarih <span className="text-red-500">*</span></span>
              </label>
              <input
                type="date"
                required
                disabled={isArchived}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Başlangıç <span className="text-red-500">*</span></span>
              </label>
              <input
                type="time"
                required
                disabled={isArchived}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-rose-600" />
                <span>Bitiş <span className="text-red-500">*</span></span>
              </label>
              <input
                type="time"
                required
                disabled={isArchived}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Açıklama (Opsiyonel)
            </label>
            <textarea
              rows={2}
              disabled={isArchived}
              placeholder="Oturumun amacı, gündem maddeleri veya katılımcılara notlar..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* QUESTION ASSIGNMENT SECTION */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs sm:text-sm">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Oturuma Atanacak Sorular</span>
                </label>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                  {assignedQuestionIds.length} / {allQuestions.length} Soru
                </span>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isArchived || allQuestions.length === 0}
                  onClick={handleAssignTop10}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 font-bold text-[11px] flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="En çok cevaplanan ve tercih edilen 10 soruyu getir"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  <span>En Çok Tercih Edilen 10 Soruyu Getir</span>
                </button>

                <button
                  type="button"
                  disabled={isArchived}
                  onClick={() => {
                    if (assignedQuestionIds.length === allQuestions.length) {
                      setAssignedQuestionIds([]);
                    } else {
                      setAssignedQuestionIds(allQuestions.map((q) => q.id));
                    }
                  }}
                  className="px-2 py-1.5 text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  {assignedQuestionIds.length === allQuestions.length ? 'Temizle' : 'Tümünü Seç'}
                </button>
              </div>
            </div>

            {/* AUTOCOMPLETE QUESTION SEARCH */}
            <div ref={searchContainerRef} className="relative">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  disabled={isArchived}
                  placeholder="Soruları auto complete ile aratarak ekleyin (başlık, kategori, quiz, etiket)..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                    setHighlightedIndex(-1);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setHighlightedIndex(-1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown List */}
              {isDropdownOpen && !isArchived && (
                <div className="absolute z-20 left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>
                      {searchQuery.trim() ? `«${searchQuery}» ile eşleşen sorular` : 'Önerilen Soru Bankası Soruları'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal lowercase">
                      (Enter ile ekle, Esc ile kapat)
                    </span>
                  </div>

                  {filteredSuggestions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 space-y-1">
                      <p className="font-semibold text-slate-600">Eşleşen soru bulunamadı</p>
                      <p className="text-[11px]">Farklı bir anahtar kelime arayabilirsiniz.</p>
                    </div>
                  ) : (
                    filteredSuggestions.map((q, idx) => {
                      const isAssigned = assignedQuestionIds.includes(q.id);
                      const popularity = getQuestionPopularity(q.id);
                      const isHighlighted = idx === highlightedIndex;

                      return (
                        <div
                          key={q.id}
                          onClick={() => {
                            toggleQuestionAssignment(q.id);
                            searchInputRef.current?.focus();
                          }}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`p-2.5 flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                            isHighlighted ? 'bg-blue-50/80' : isAssigned ? 'bg-slate-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                {formatQuestionType(q.type, q.isQuiz)}
                              </span>

                              {q.isQuiz && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 flex items-center gap-0.5">
                                  <Award className="w-2.5 h-2.5" />
                                  <span>{q.points || 10}P</span>
                                </span>
                              )}

                              {q.category && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700">
                                  {q.category}
                                </span>
                              )}

                              {popularity > 0 && (
                                <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5">
                                  <Flame className="w-3 h-3 fill-amber-500 text-amber-500" />
                                  <span>{popularity} yanıt</span>
                                </span>
                              )}
                            </div>

                            <p className="font-semibold text-xs text-slate-900 truncate">
                              {q.title}
                            </p>
                          </div>

                          <div className="shrink-0">
                            {isAssigned ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <Check className="w-3 h-3" />
                                <span>Eklendi</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors">
                                <Plus className="w-3 h-3" />
                                <span>Oturuma Ekle</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* LIST OF CURRENTLY ASSIGNED QUESTIONS */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
                <span>Atanan Sorular Listesi ({assignedQuestions.length})</span>
                <span className="text-slate-400">Oturumda katılımcılara bu sorular sunulacaktır</span>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 border border-slate-200 rounded-2xl p-2 bg-slate-50/50 divide-y divide-slate-100">
                {assignedQuestions.length === 0 ? (
                  <div className="text-center py-6 px-4 text-slate-400 space-y-1.5">
                    <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold text-slate-600">Bu Oturuma Henüz Soru Atanmadı</p>
                    <p className="text-[11px] max-w-sm mx-auto text-slate-400">
                      Yukarıdaki arama kutusundan soruları auto complete ile aratarak ekleyebilir veya 
                      <strong className="text-amber-700 font-bold ml-1">"En Çok Tercih Edilen 10 Soruyu Getir"</strong> butonunu kullanabilirsiniz.
                    </p>
                  </div>
                ) : (
                  assignedQuestions.map((q, idx) => {
                    const popularity = getQuestionPopularity(q.id);
                    return (
                      <div
                        key={q.id}
                        className="p-2 pt-2.5 rounded-xl bg-white border border-slate-200/80 text-xs flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0 border border-blue-200">
                            {idx + 1}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 truncate">
                                {q.title}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium shrink-0">
                                {formatQuestionType(q.type, q.isQuiz)}
                              </span>
                              {popularity > 0 && (
                                <span className="text-[10px] text-amber-700 font-bold flex items-center gap-0.5 shrink-0">
                                  <Flame className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                  <span>{popularity} oy</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {!isArchived && (
                          <button
                            type="button"
                            onClick={() => removeQuestionById(q.id)}
                            className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors shrink-0 cursor-pointer"
                            title="Soruyu bu oturumdan kaldır"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSaving || isArchived}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isSaving ? 'Kaydediliyor...' : isEditing ? 'Değişiklikleri Kaydet' : 'Oturumu Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
