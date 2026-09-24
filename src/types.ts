export type QuestionType = 
  | 'short_text' 
  | 'long_text' 
  | 'multiple_choice' 
  | 'true_false' 
  | 'rating_pool'
  | 'attendance';

export interface AttendanceLocation {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude?: number | null;
  error?: string;
  capturedAt: string;
}

export interface AttendanceDeviceSignature {
  userAgent: string;
  platform: string;
  browser?: string;
  os?: string;
  screenResolution: string;
  colorDepth?: string | number;
  language: string;
  timezone: string;
  hardwareConcurrency?: number | string;
  touchSupport?: boolean;
  fingerprintHash?: string;
  ip?: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  questionId: string;
  participantId: string;
  studentNumber: string;
  fullName: string;
  location: AttendanceLocation;
  deviceSignature: AttendanceDeviceSignature;
  submittedAt: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  category?: string; // e.g. "Buz Kırıcı", "Quiz", "Strateji", "Geri Bildirim", "Teknoloji"
  tags?: string[];
  description?: string;
  options?: string[];
  allowMultiple?: boolean;
  ratingMax?: number; // 5 or 10
  ratingLabels?: { min: string; max: string };
  // Quiz specific fields
  isQuiz?: boolean;
  correctAnswer?: string | string[] | boolean | number;
  points?: number; // Default e.g. 10
  explanation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Answer {
  id: string;
  sessionId?: string; // Associated meeting session ID
  questionId: string;
  participantId: string; // Anonymous random token
  participantName?: string; // Fun anonymous nickname e.g. "Kozmik Panda"
  participantAvatar?: string; // Fun emoji e.g. "🐼"
  type: QuestionType;
  value: string | string[] | number | boolean;
  submittedAt: string;
  isCorrect?: boolean;
  pointsEarned?: number;
}

export interface AnonymousFeedback {
  id: string;
  sessionId?: string; // Associated meeting session ID
  sessionCode?: string; // Associated meeting code e.g. "LIVE-2026"
  sessionTitle?: string; // Associated meeting title
  participantId: string;
  participantName?: string;
  participantAvatar?: string;
  message: string;
  category: 'feedback' | 'question' | 'suggestion';
  submittedAt: string;
  upvotes: number;
  isRead?: boolean; // Okundu / Okunmadı durumu
}

export interface LeaderboardEntry {
  participantId: string;
  participantName: string;
  participantAvatar: string;
  totalPoints: number;
  questionsAnswered: number;
  correctAnswersCount: number;
  lastActive: string;
}

export interface ParticipantProfile {
  id: string;
  name: string;
  avatar: string;
}

export interface MeetingSession {
  id: string;
  code: string; // e.g. "LIVE-2026"
  title: string; // Oturum Adı
  description?: string;
  date: string; // Tarih: YYYY-MM-DD
  startTime: string; // Başlangıç saati: HH:mm e.g. "14:00"
  endTime: string; // Bitiş saati: HH:mm e.g. "15:30"
  isArchived: boolean; // Arşivde mi?
  sessionEnded: boolean; // Oturum tamamlandı mı?
  pollStatus: 'open' | 'closed';
  activeQuestionId: string | null;
  assignedQuestionIds?: string[];
  attendanceExpiresAt?: number | null; // Timestamp (ms) when 90s attendance ends
  attendanceStartedAt?: number | null; // Timestamp (ms) when attendance started
  createdAt: string;
  updatedAt: string;
}

export interface SessionPublicState {
  sessionId: string;
  sessionCode: string;
  sessionTitle: string;
  sessionDate?: string;
  startTime?: string;
  endTime?: string;
  isArchived: boolean;
  activeQuestion: Question | null;
  pollStatus: 'open' | 'closed';
  showResultsToParticipants: boolean;
  activeParticipantCount: number;
  totalResponsesForActive: number;
  participantAnswer?: Answer | null;
  participantAttendanceRecord?: AttendanceRecord | null;
  attendanceExpiresAt?: number | null;
  attendanceSecondsLeft?: number | null;
  results?: QuestionResultsSummary | null;
  recentFeedback: AnonymousFeedback[];
  leaderboard?: LeaderboardEntry[];
  sessionEnded?: boolean;
}

export interface QuestionResultsSummary {
  questionId: string;
  type: QuestionType;
  totalVotes: number;
  choiceDistribution?: Record<string, number>;
  trueFalseDistribution?: { trueCount: number; falseCount: number };
  ratingAverage?: number;
  ratingDistribution?: Record<number, number>;
  attendanceRecordsCount?: number;
  textAnswers?: { 
    id: string; 
    text: string; 
    time: string; 
    participantName?: string; 
    participantAvatar?: string 
  }[];
  quizStats?: {
    correctCount: number;
    wrongCount: number;
    correctPercentage: number;
    correctAnswer?: string | string[] | boolean | number;
  };
}

export interface MeetingStoreData {
  adminPassword: string;
  activeSessionId: string;
  sessions: MeetingSession[];
  // Legacy / fallback fields maintained for backward compatibility
  sessionCode: string;
  sessionTitle: string;
  activeQuestionId: string | null;
  pollStatus: 'open' | 'closed';
  showResultsToParticipants: boolean;
  sessionEnded?: boolean;
  questions: Question[];
  answers: Answer[];
  attendanceRecords?: AttendanceRecord[];
  feedback: AnonymousFeedback[];
  participantProfiles?: Record<string, { name: string; avatar: string }>;
}
