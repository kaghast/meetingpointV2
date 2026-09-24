import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, HelpCircle, CheckCircle2, Sparkles, Send, Save, Award, Check } from 'lucide-react';
import { Question, QuestionType } from '../types';

interface QuestionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (question: Question, launchedImmediately: boolean) => void;
  adminToken: string;
  initialQuestion?: Question | null;
  launchByDefault?: boolean;
}

const QUESTION_TYPES: { id: QuestionType; label: string; description: string; badge: string }[] = [
  {
    id: 'multiple_choice',
    label: 'Çoktan Seçmeli',
    description: 'Katılımcıların oy verebileceği seçenekler listesi',
    badge: 'Seçenekli',
  },
  {
    id: 'true_false',
    label: 'Doğru / Yanlış',
    description: 'Hızlı ikili mutabakat veya quiz sorusu',
    badge: 'İkili',
  },
  {
    id: 'rating_pool',
    label: 'Derecelendirme (1-5/10)',
    description: 'Puanlama ölçeği ve ortalama puan hesabı',
    badge: 'Puan',
  },
  {
    id: 'short_text',
    label: 'Kısa Metin',
    description: 'Tek satırlık kısa kelime, fikir veya cevap',
    badge: 'Kısa Yanıt',
  },
  {
    id: 'long_text',
    label: 'Uzun Metin',
    description: 'Açık uçlu detaylı geri bildirim veya blokajlar',
    badge: 'Paragraf',
  },
  {
    id: 'attendance',
    label: 'Yoklama (90 Saniye)',
    description: 'Öğrenci no, ad-soyad, Lat-Long GPS ve cihaz imzasını 90 saniyede toplar',
    badge: '90sn Yoklama',
  },
];

const PRESET_CATEGORIES = [
  'Buz Kırıcı',
  'Quiz',
  'Strateji & Vizyon',
  'Geri Bildirim',
  'Süreç & Öneri',
  'Teknoloji',
  'Sprint Değerlendirme'
];

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  adminToken,
  initialQuestion,
  launchByDefault = false,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<QuestionType>('multiple_choice');
  const [category, setCategory] = useState('Genel');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>(['Seçenek 1', 'Seçenek 2', 'Seçenek 3']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [ratingMax, setRatingMax] = useState<number>(5);
  const [ratingMinLabel, setRatingMinLabel] = useState('Geliştirilmeli');
  const [ratingMaxLabel, setRatingMaxLabel] = useState('Mükemmel');

  // Quiz state
  const [isQuiz, setIsQuiz] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<any>('');
  const [points, setPoints] = useState<number>(10);
  const [explanation, setExplanation] = useState('');

  const [launchImmediately, setLaunchImmediately] = useState(launchByDefault);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialQuestion) {
      setTitle(initialQuestion.title);
      setDescription(initialQuestion.description || '');
      setType(initialQuestion.type);
      setCategory(initialQuestion.category || 'Genel');
      setTags(initialQuestion.tags || []);
      setOptions(initialQuestion.options && initialQuestion.options.length > 0 ? initialQuestion.options : ['Seçenek 1', 'Seçenek 2']);
      setAllowMultiple(Boolean(initialQuestion.allowMultiple));
      setRatingMax(initialQuestion.ratingMax || 5);
      setRatingMinLabel(initialQuestion.ratingLabels?.min || 'Geliştirilmeli');
      setRatingMaxLabel(initialQuestion.ratingLabels?.max || 'Mükemmel');
      setIsQuiz(Boolean(initialQuestion.isQuiz));
      setCorrectAnswer(initialQuestion.correctAnswer !== undefined ? initialQuestion.correctAnswer : '');
      setPoints(initialQuestion.points || 10);
      setExplanation(initialQuestion.explanation || '');
      setLaunchImmediately(false);
    } else {
      setTitle('');
      setDescription('');
      setType('multiple_choice');
      setCategory('Genel');
      setTags([]);
      setOptions(['Seçenek 1', 'Seçenek 2', 'Seçenek 3']);
      setAllowMultiple(false);
      setRatingMax(5);
      setRatingMinLabel('Geliştirilmeli');
      setRatingMaxLabel('Mükemmel');
      setIsQuiz(false);
      setCorrectAnswer('Seçenek 1');
      setPoints(10);
      setExplanation('');
      setLaunchImmediately(launchByDefault);
    }
    setError('');
  }, [initialQuestion, launchByDefault, isOpen]);

  if (!isOpen) return null;

  const handleAddOption = () => {
    setOptions([...options, `Seçenek ${options.length + 1}`]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      setError('Çoktan seçmeli sorular için en az 2 seçenek gereklidir.');
      return;
    }
    const removedOption = options[index];
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    if (correctAnswer === removedOption) {
      setCorrectAnswer(newOptions[0] || '');
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const prevVal = options[index];
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
    if (correctAnswer === prevVal) {
      setCorrectAnswer(val);
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Soru başlığı zorunludur.');
      return;
    }

    if (type === 'multiple_choice') {
      const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
      if (cleanOptions.length < 2) {
        setError('Çoktan seçmeli sorular için en az 2 geçerli seçenek girmelisiniz.');
        return;
      }
      if (isQuiz && !correctAnswer) {
        setError('Quiz sorusu için doğru yanıtı seçmelisiniz.');
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    const payload = {
      title: title.trim(),
      type,
      category: category.trim() || 'Genel',
      tags,
      description: description.trim() || undefined,
      options: type === 'multiple_choice' ? options.map((o) => o.trim()).filter(Boolean) : undefined,
      allowMultiple: type === 'multiple_choice' ? allowMultiple : undefined,
      ratingMax: type === 'rating_pool' ? ratingMax : undefined,
      ratingLabels: type === 'rating_pool' ? { min: ratingMinLabel, max: ratingMaxLabel } : undefined,
      isQuiz,
      correctAnswer: isQuiz ? correctAnswer : undefined,
      points: isQuiz ? Number(points) || 10 : undefined,
      explanation: isQuiz && explanation.trim() ? explanation.trim() : undefined,
      launchImmediately,
    };

    try {
      const url = initialQuestion ? `/api/admin/questions/${initialQuestion.id}` : '/api/admin/questions';
      const method = initialQuestion ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSaved(data.question, launchImmediately);
        onClose();
      } else {
        setError(data.error || 'Soru kaydedilemedi.');
      }
    } catch {
      setError('Sunucu hatası oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {initialQuestion ? 'Soruyu Düzenle' : 'Yeni Soru Oluştur'}
              </h3>
              <p className="text-xs text-slate-500">
                Soru tipi, etiketler, kategori ve Quiz puanlama ayarları
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Soru Tipi Seçimi */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Soru Formatı / Tipi
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUESTION_TYPES.map((t) => {
                const isSelected = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setType(t.id);
                      if (t.id === 'true_false' && (correctAnswer === '' || typeof correctAnswer !== 'boolean')) {
                        setCorrectAnswer(true);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">{t.label}</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-md font-mono">
                        {t.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                      {t.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Soru Başlığı */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Soru Metni <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Bu çeyrekte ana hedefimiz ne olmalıdır?"
              maxLength={200}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Kategori ve Etiketler */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Kategori */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Kategori
              </label>
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Genel">Genel</option>
                  {PRESET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  {!PRESET_CATEGORIES.includes(category) && category !== 'Genel' && (
                    <option value={category}>{category}</option>
                  )}
                </select>
                <input
                  type="text"
                  placeholder="Özel kategori..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-36 px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Etiketler (Tags) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Etiketler (Filtreleme İçin)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Etiket ekle..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  Ekle
                </button>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 flex items-center gap-1"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-600 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Açıklama / Talimat */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Açıklama / Yönerge (Opsiyonel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Soruyu yanıtlarken dikkat edilmesi gereken detaylar..."
              rows={2}
              maxLength={300}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          {/* QUIZ ÖZELLİĞİ: DOĞRU YANIT VE PUAN ATAMA */}
          <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" />
                <div>
                  <h4 className="font-bold text-amber-950 text-xs sm:text-sm">
                    Quiz Sorusu &amp; Puan Sistemi
                  </h4>
                  <p className="text-[11px] text-amber-800">
                    Bu soruyu bir bilgi yarışması sorusu haline getirin ve liderlik tablosu puanı belirleyin.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isQuiz}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsQuiz(checked);
                    if (checked && !category) setCategory('Quiz');
                    if (checked && type === 'multiple_choice' && !correctAnswer) {
                      setCorrectAnswer(options[0] || '');
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {isQuiz && (
              <div className="pt-3 border-t border-amber-200/60 space-y-3">
                {/* Puan Belirleme */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-amber-900 shrink-0">
                    Soru Puan Değeri:
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[10, 15, 20, 50].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPoints(p)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          points === p
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100'
                        }`}
                      >
                        {p} Puan
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={points}
                      onChange={(e) => setPoints(Number(e.target.value) || 10)}
                      className="w-16 px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs text-center font-bold text-amber-900"
                    />
                  </div>
                </div>

                {/* Doğru Yanıt Seçimi */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-amber-900">
                    Doğru Yanıtı Belirleyin:
                  </label>

                  {type === 'multiple_choice' && (
                    <div className="space-y-1">
                      <p className="text-[11px] text-amber-800 mb-1">Doğru olan seçeneği işaretleyin:</p>
                      {options.map((opt, i) => (
                        <label
                          key={i}
                          className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                            correctAnswer === opt
                              ? 'bg-white border-emerald-500 ring-2 ring-emerald-400 font-bold text-emerald-950'
                              : 'bg-white/80 border-amber-200 hover:bg-white text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="quiz-correct-choice"
                            checked={correctAnswer === opt}
                            onChange={() => setCorrectAnswer(opt)}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-xs">{opt}</span>
                          {correctAnswer === opt && (
                            <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold">
                              ✓ Doğru Cevap
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}

                  {type === 'true_false' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrectAnswer(true)}
                        className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                          correctAnswer === true || correctAnswer === 'true'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border-amber-300 text-slate-700 hover:bg-emerald-50'
                        }`}
                      >
                        <span>👍 DOĞRU (True)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCorrectAnswer(false)}
                        className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                          correctAnswer === false || correctAnswer === 'false'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-white border-amber-300 text-slate-700 hover:bg-rose-50'
                        }`}
                      >
                        <span>👎 YANLIŞ (False)</span>
                      </button>
                    </div>
                  )}

                  {type === 'short_text' && (
                    <input
                      type="text"
                      value={correctAnswer || ''}
                      onChange={(e) => setCorrectAnswer(e.target.value)}
                      placeholder="Örn: Ada Lovelace"
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-slate-900"
                    />
                  )}
                </div>

                {/* Açıklama */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-amber-900">
                    Çözüm Açıklaması / Bilgi Notu (Sonuçlarda Gösterilir)
                  </label>
                  <textarea
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Katılımcıların öğrenmesi için kısa açıklama..."
                    rows={2}
                    className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* TYPE SPECIFIC: MULTIPLE CHOICE OPTIONS */}
          {type === 'multiple_choice' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cevap Seçenekleri
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowMultiple}
                    onChange={(e) => setAllowMultiple(e.target.checked)}
                    className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Çoklu seçime izin ver</span>
                </label>
              </div>

              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(i, e.target.value)}
                      placeholder={`Seçenek ${i + 1}`}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(i)}
                      disabled={options.length <= 2}
                      className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                      title="Seçeneği sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddOption}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yeni Seçenek Ekle</span>
              </button>
            </div>
          )}

          {/* TYPE SPECIFIC: RATING POOL CONFIG */}
          {type === 'rating_pool' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Derecelendirme Ölçeği Ayarları
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="rating-scale"
                    checked={ratingMax === 5}
                    onChange={() => setRatingMax(5)}
                    className="text-blue-600"
                  />
                  <span>1 - 5 Ölçeği (Önerilen)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="rating-scale"
                    checked={ratingMax === 10}
                    onChange={() => setRatingMax(10)}
                    className="text-blue-600"
                  />
                  <span>1 - 10 Ölçeği</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">En Düşük Puan Etiketi</label>
                  <input
                    type="text"
                    value={ratingMinLabel}
                    onChange={(e) => setRatingMinLabel(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">En Yüksek Puan Etiketi</label>
                  <input
                    type="text"
                    value={ratingMaxLabel}
                    onChange={(e) => setRatingMaxLabel(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TYPE SPECIFIC: ATTENDANCE CONFIG */}
          {type === 'attendance' && (
            <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-2.5">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                <span>90 Saniyelik Otomatik Yoklama Özellikleri</span>
              </div>
              <ul className="text-xs text-indigo-800 space-y-1.5 list-disc list-inside">
                <li>Öğrenci Numarası ve Ad-Soyad girişi zorunludur.</li>
                <li>Geofencing: Tarayıcıdan hassas Enlem (Latitude) ve Boylam (Longitude) koordinatları alınır.</li>
                <li>Cihaz &amp; Tarayıcı İmzası: Tarayıcı, işletim sistemi, ekran çözünürlüğü ve IP parmak izi otomatik toplanır.</li>
                <li>Başlatıldığında süre 90 saniye ile sınırlıdır ve süre dolunca otomatik olarak durdurulur.</li>
              </ul>
            </div>
          )}

          {/* Anında Başlat Seçeneği */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={launchImmediately}
                onChange={(e) => setLaunchImmediately(e.target.checked)}
                className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Kaydeder kaydetmez canlı oturumda hemen başlat</span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Kaydediliyor...' : 'Soruyu Kaydet'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
