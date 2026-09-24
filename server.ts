import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { 
  MeetingStoreData, 
  MeetingSession,
  Question, 
  Answer, 
  AnonymousFeedback, 
  QuestionResultsSummary, 
  LeaderboardEntry,
  AttendanceRecord 
} from './src/types';

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'meeting_data.json');

// In-memory timers for automatic 90-second attendance auto-stopping
const attendanceTimers = new Map<string, NodeJS.Timeout>();

// Default Attendance question
const defaultAttendanceQuestion: Question = {
  id: 'q-default-attendance',
  type: 'attendance',
  category: 'Yoklama',
  tags: ['Yoklama', 'Katılım', 'Geofencing'],
  title: 'Resmi Ders / Oturum Yoklaması (90 Saniye)',
  description: 'Lütfen öğrenci numaranızı ve ad soyadınızı girerek yoklamanızı onaylayınız. Konum (Lat-Long) ve cihaz imzanız kaydedilmektedir.',
  isQuiz: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Initial seed data with NO dummy sessions and NO dummy questions (only default attendance question)
const initialSeedData: MeetingStoreData = {
  adminPassword: 'admin',
  activeSessionId: '',
  sessions: [],
  sessionCode: '',
  sessionTitle: '',
  activeQuestionId: null,
  pollStatus: 'closed',
  showResultsToParticipants: false,
  sessionEnded: false,
  questions: [defaultAttendanceQuestion],
  answers: [],
  attendanceRecords: [],
  feedback: [],
  participantProfiles: {}
};

// Storage helper functions
function loadData(): MeetingStoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      
      let sessions: MeetingSession[] = Array.isArray(parsed.sessions) ? parsed.sessions : [];

      // Check attendance expiry on sessions and ensure default attendance question is in assignedQuestionIds
      const nowMs = Date.now();
      sessions = sessions.map(s => {
        let pollStatus = s.pollStatus;
        let attendanceExpiresAt = s.attendanceExpiresAt;
        if (attendanceExpiresAt && nowMs >= attendanceExpiresAt) {
          pollStatus = 'closed';
          attendanceExpiresAt = null;
        }
        const assigned = Array.isArray(s.assignedQuestionIds) ? [...s.assignedQuestionIds] : [];
        if (!assigned.includes('q-default-attendance')) {
          assigned.push('q-default-attendance');
        }
        return {
          ...s,
          pollStatus,
          attendanceExpiresAt,
          assignedQuestionIds: assigned,
        };
      });

      const activeSess = sessions.find(s => s.id === parsed.activeSessionId) || (sessions.length > 0 ? sessions[0] : null);

      // Ensure questions include default attendance question
      let questions: Question[] = Array.isArray(parsed.questions) ? parsed.questions : [];
      if (!questions.some(q => q.type === 'attendance')) {
        questions.push(defaultAttendanceQuestion);
      }

      return {
        ...initialSeedData,
        ...parsed,
        sessions,
        activeSessionId: activeSess ? activeSess.id : '',
        sessionCode: activeSess ? activeSess.code : '',
        sessionTitle: activeSess ? activeSess.title : '',
        activeQuestionId: activeSess ? activeSess.activeQuestionId : null,
        pollStatus: activeSess ? activeSess.pollStatus : 'closed',
        sessionEnded: activeSess ? Boolean(activeSess.sessionEnded) : false,
        questions,
        attendanceRecords: parsed.attendanceRecords || [],
        participantProfiles: parsed.participantProfiles || {},
        answers: (parsed.answers || []).map((ans: Answer) => ({
          ...ans,
          sessionId: ans.sessionId || (activeSess ? activeSess.id : ''),
        })),
        feedback: (parsed.feedback || []).map((fb: AnonymousFeedback) => ({
          ...fb,
          sessionId: fb.sessionId || (activeSess ? activeSess.id : ''),
          sessionCode: fb.sessionCode || (activeSess ? activeSess.code : ''),
          sessionTitle: fb.sessionTitle || (activeSess ? activeSess.title : ''),
          isRead: fb.isRead !== undefined ? fb.isRead : false,
        })),
      };
    }
  } catch (err) {
    console.error('Error reading meeting data json:', err);
  }
  saveData(initialSeedData);
  return initialSeedData;
}

function saveData(data: MeetingStoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing meeting data json:', err);
  }
}

function getActiveSession(store: MeetingStoreData): MeetingSession | null {
  if (!store.sessions || store.sessions.length === 0) {
    return null;
  }
  let active = store.sessions.find(s => s.id === store.activeSessionId);
  if (!active) {
    active = store.sessions[0];
    store.activeSessionId = active.id;
  }
  return active;
}

// Active SSE client connections
interface SSEClient {
  id: string;
  res: express.Response;
}
let sseClients: SSEClient[] = [];

function broadcastSSE(eventType: string, payload: any) {
  const data = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(data);
    } catch {
      // client disconnected
    }
  });
}

// Check Quiz Answer Correctness
function evaluateAnswer(question: Question, value: any): { isCorrect: boolean; pointsEarned: number } {
  if (!question.isQuiz) {
    return { isCorrect: false, pointsEarned: 0 };
  }

  const defaultPoints = question.points || 10;
  let isCorrect = false;

  if (question.type === 'multiple_choice') {
    if (Array.isArray(question.correctAnswer)) {
      if (Array.isArray(value)) {
        const setA = new Set(question.correctAnswer.map((x) => String(x).trim()));
        const setB = new Set(value.map((x) => String(x).trim()));
        isCorrect = setA.size === setB.size && [...setA].every((x) => setB.has(x));
      }
    } else {
      isCorrect = String(value).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase();
    }
  } else if (question.type === 'true_false') {
    const valBool = value === true || value === 'true';
    const targetBool = question.correctAnswer === true || question.correctAnswer === 'true';
    isCorrect = valBool === targetBool;
  } else if (question.type === 'short_text') {
    if (question.correctAnswer) {
      isCorrect = String(value).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase();
    }
  } else if (question.type === 'rating_pool') {
    if (question.correctAnswer !== undefined) {
      isCorrect = Number(value) === Number(question.correctAnswer);
    }
  }

  return {
    isCorrect,
    pointsEarned: isCorrect ? defaultPoints : 0,
  };
}

// Compute summary results for a question (strictly filtered by session if given)
function computeQuestionResults(
  question: Question, 
  answers: Answer[], 
  sessionId?: string,
  attendanceRecords?: AttendanceRecord[]
): QuestionResultsSummary {
  const qAnswers = answers.filter((a) => a.questionId === question.id && (!sessionId || a.sessionId === sessionId));
  const totalVotes = qAnswers.length;

  const summary: QuestionResultsSummary = {
    questionId: question.id,
    type: question.type,
    totalVotes,
  };

  if (question.type === 'multiple_choice') {
    const distribution: Record<string, number> = {};
    (question.options || []).forEach((opt) => {
      distribution[opt] = 0;
    });
    qAnswers.forEach((ans) => {
      if (Array.isArray(ans.value)) {
        ans.value.forEach((v) => {
          distribution[String(v)] = (distribution[String(v)] || 0) + 1;
        });
      } else if (ans.value !== undefined && ans.value !== null) {
        distribution[String(ans.value)] = (distribution[String(ans.value)] || 0) + 1;
      }
    });
    summary.choiceDistribution = distribution;
  } else if (question.type === 'true_false') {
    let trueCount = 0;
    let falseCount = 0;
    qAnswers.forEach((ans) => {
      if (ans.value === true || ans.value === 'true') trueCount++;
      if (ans.value === false || ans.value === 'false') falseCount++;
    });
    summary.trueFalseDistribution = { trueCount, falseCount };
  } else if (question.type === 'rating_pool') {
    const max = question.ratingMax || 5;
    const distribution: Record<number, number> = {};
    for (let i = 1; i <= max; i++) {
      distribution[i] = 0;
    }
    let sum = 0;
    let validCount = 0;
    qAnswers.forEach((ans) => {
      const num = Number(ans.value);
      if (!isNaN(num) && num >= 1 && num <= max) {
        distribution[num] = (distribution[num] || 0) + 1;
        sum += num;
        validCount++;
      }
    });
    summary.ratingDistribution = distribution;
    summary.ratingAverage = validCount > 0 ? Number((sum / validCount).toFixed(1)) : 0;
  } else if (question.type === 'short_text' || question.type === 'long_text') {
    summary.textAnswers = qAnswers.map((a) => ({
      id: a.id,
      text: String(a.value),
      time: a.submittedAt,
      participantName: a.participantName,
      participantAvatar: a.participantAvatar,
    }));
  } else if (question.type === 'attendance') {
    const attList = (attendanceRecords || []).filter(
      (r) => !sessionId || r.sessionId === sessionId
    );
    summary.attendanceRecordsCount = attList.length > 0 ? attList.length : qAnswers.length;
  }

  // Calculate Quiz Statistics if this is a Quiz question
  if (question.isQuiz && question.correctAnswer !== undefined) {
    let correctCount = 0;
    qAnswers.forEach((ans) => {
      if (ans.isCorrect) correctCount++;
    });
    const wrongCount = Math.max(0, totalVotes - correctCount);
    const correctPercentage = totalVotes > 0 ? Math.round((correctCount / totalVotes) * 100) : 0;
    summary.quizStats = {
      correctCount,
      wrongCount,
      correctPercentage,
      correctAnswer: question.correctAnswer,
    };
  }

  return summary;
}

// Compute Leaderboard Entries strictly for a specific session
function computeLeaderboard(store: MeetingStoreData, sessionId?: string): LeaderboardEntry[] {
  const map = new Map<string, LeaderboardEntry>();
  const profiles = store.participantProfiles || {};

  // STRICT REQUIREMENT: Leaderboard must be session-specific, never global across all sessions!
  const targetSessionId = sessionId || store.activeSessionId;
  const relevantAnswers = store.answers.filter((a) => a.sessionId === targetSessionId);

  relevantAnswers.forEach((ans) => {
    const pId = ans.participantId;
    const profile = profiles[pId] || {
      name: ans.participantName || 'Gizemli Katılımcı',
      avatar: ans.participantAvatar || '👤',
    };

    if (!map.has(pId)) {
      map.set(pId, {
        participantId: pId,
        participantName: profile.name,
        participantAvatar: profile.avatar,
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
        const q = store.questions.find((x) => x.id === ans.questionId);
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
}

// Participant heartbeats (last 3 minutes)
const participantHeartbeats = new Map<string, number>();

function cleanStaleParticipants() {
  const now = Date.now();
  for (const [pId, lastSeen] of participantHeartbeats.entries()) {
    if (now - lastSeen > 180000) {
      participantHeartbeats.delete(pId);
    }
  }
}

async function startServer() {
  const app = express();

  app.use(express.json());

  // SSE Real-time events stream
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const clientId = Math.random().toString(36).substring(2, 10);
    const newClient: SSEClient = { id: clientId, res };
    sseClients.push(newClient);

    res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: Date.now() })}\n\n`);

    req.on('close', () => {
      sseClients = sseClients.filter((c) => c.id !== clientId);
    });
  });

  // Participant heartbeat / join / profile sync
  app.post('/api/participant/heartbeat', (req, res) => {
    const { participantId, participantName, participantAvatar } = req.body;
    if (participantId) {
      participantHeartbeats.set(String(participantId), Date.now());
      if (participantName && participantAvatar) {
        const store = loadData();
        store.participantProfiles = store.participantProfiles || {};
        store.participantProfiles[participantId] = {
          name: participantName,
          avatar: participantAvatar,
        };
        saveData(store);
      }
    }
    cleanStaleParticipants();
    res.json({ activeCount: Math.max(1, participantHeartbeats.size) });
  });

  // Save / Update participant fun profile
  app.post('/api/participant/profile', (req, res) => {
    const { participantId, name, avatar } = req.body;
    if (!participantId || !name || !avatar) {
      return res.status(400).json({ error: 'Missing required profile fields' });
    }

    const store = loadData();
    store.participantProfiles = store.participantProfiles || {};
    store.participantProfiles[participantId] = {
      name: name.trim(),
      avatar: avatar.trim(),
    };

    // Update their answers & feedback names/avatars retroactively
    store.answers.forEach((ans) => {
      if (ans.participantId === participantId) {
        ans.participantName = name.trim();
        ans.participantAvatar = avatar.trim();
      }
    });

    store.feedback.forEach((fb) => {
      if (fb.participantId === participantId) {
        fb.participantName = name.trim();
        fb.participantAvatar = avatar.trim();
      }
    });

    saveData(store);
    broadcastSSE('profile-updated', { participantId, name, avatar });

    res.json({ success: true, profile: { id: participantId, name, avatar } });
  });

  // Health check endpoints for Coolify, Docker, and load balancers
  app.get(['/api/health', '/health'], (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Public session state
  // STRICT RULES:
  // 1. "Sonuçlar ancak oturum bitirince gözükmeli." (Results only show when sessionEnded === true)
  // 2. "Yönetici oturumu arşive atarsa sonuçlar kesinlikle gösterilmemeli." (If isArchived === true, results are NEVER returned)
  app.get('/api/session', (req, res) => {
    const participantId = req.headers['x-participant-id'] as string;
    if (participantId) {
      participantHeartbeats.set(participantId, Date.now());
    }
    cleanStaleParticipants();

    const store = loadData();
    const activeSession = getActiveSession(store);

    if (!activeSession) {
      return res.json({
        sessionId: '',
        sessionCode: '',
        sessionTitle: '',
        sessionDate: undefined,
        startTime: undefined,
        endTime: undefined,
        isArchived: false,
        activeQuestion: null,
        pollStatus: 'closed',
        showResults: false,
        sessionEnded: false,
        totalResponses: 0,
        participantAnswer: null,
        participantAttendanceRecord: null,
        attendanceExpiresAt: null,
        attendanceSecondsLeft: null,
        results: null,
        recentFeedback: [],
        leaderboard: [],
      });
    }

    // Auto-expire 90-second attendance if time has passed
    if (activeSession.attendanceExpiresAt && Date.now() >= activeSession.attendanceExpiresAt) {
      activeSession.pollStatus = 'closed';
      activeSession.attendanceExpiresAt = null;
      if (store.activeSessionId === activeSession.id) {
        store.pollStatus = 'closed';
      }
      saveData(store);
    }

    const activeQuestion = store.questions.find((q) => q.id === activeSession.activeQuestionId) || null;

    let totalResponsesForActive = 0;
    let participantAnswer: Answer | null = null;
    let participantAttendanceRecord: AttendanceRecord | null = null;
    let results: QuestionResultsSummary | null = null;

    if (activeQuestion) {
      const activeAnswers = store.answers.filter((a) => a.questionId === activeQuestion.id && a.sessionId === activeSession.id);
      totalResponsesForActive = activeAnswers.length;

      if (participantId) {
        participantAnswer = activeAnswers.find((a) => a.participantId === participantId) || null;
      }

      // If active question is attendance, also count and retrieve attendance record
      if (activeQuestion.type === 'attendance') {
        const activeAttRecords = (store.attendanceRecords || []).filter((r) => r.sessionId === activeSession.id);
        totalResponsesForActive = activeAttRecords.length;
        if (participantId) {
          participantAttendanceRecord = activeAttRecords.find((r) => r.participantId === participantId) || null;
        }
      }

      // STRICT CHECK: Results ONLY visible if session is ended AND NOT archived!
      if (!activeSession.isArchived && activeSession.sessionEnded) {
        results = computeQuestionResults(activeQuestion, store.answers, activeSession.id);
      }
    }

    const attendanceSecondsLeft = activeSession.attendanceExpiresAt
      ? Math.max(0, Math.ceil((activeSession.attendanceExpiresAt - Date.now()) / 1000))
      : null;

    // STRICT CHECK: Leaderboard is ONLY visible if session is ended AND NOT archived!
    const leaderboard = (!activeSession.isArchived && activeSession.sessionEnded)
      ? computeLeaderboard(store, activeSession.id)
      : [];

    // Session feedback (only for this session or legacy)
    const sessionFeedback = store.feedback
      .filter((fb) => !fb.sessionId || fb.sessionId === activeSession.id)
      .slice(0, 50);

    res.json({
      sessionId: activeSession.id,
      sessionCode: activeSession.code,
      sessionTitle: activeSession.title,
      sessionDate: activeSession.date,
      startTime: activeSession.startTime,
      endTime: activeSession.endTime,
      isArchived: Boolean(activeSession.isArchived),
      activeQuestion,
      pollStatus: activeSession.pollStatus,
      // Results allowed only if ended and NOT archived
      showResultsToParticipants: !activeSession.isArchived && Boolean(activeSession.sessionEnded),
      sessionEnded: Boolean(activeSession.sessionEnded),
      activeParticipantCount: Math.max(1, participantHeartbeats.size),
      totalResponsesForActive,
      participantAnswer,
      participantAttendanceRecord,
      attendanceExpiresAt: activeSession.attendanceExpiresAt || null,
      attendanceSecondsLeft,
      results,
      recentFeedback: sessionFeedback,
      leaderboard,
    });
  });

  // Submit Answer - STRICT RULE: Participant CANNOT change answer once submitted!
  app.post('/api/participant/answer', (req, res) => {
    const { participantId, questionId, value, participantName, participantAvatar, sessionId } = req.body;

    if (!participantId || !questionId || value === undefined) {
      return res.status(400).json({ error: 'participantId, questionId, ve value zorunludur.' });
    }

    const store = loadData();
    const activeSession = getActiveSession(store);

    if (!activeSession) {
      return res.status(400).json({ error: 'Aktif bir oturum bulunmamaktadır.' });
    }

    const targetSessionId = sessionId || activeSession.id;

    if (activeSession.pollStatus !== 'open') {
      return res.status(400).json({ error: 'Oylama şu an oturum yöneticisi tarafından durduruldu.' });
    }

    if (activeSession.sessionEnded) {
      return res.status(400).json({ error: 'Oturum tamamlanmıştır, yeni yanıt kabul edilmemektedir.' });
    }

    const question = store.questions.find((q) => q.id === questionId);
    if (!question) {
      return res.status(404).json({ error: 'Soru bulunamadı.' });
    }

    // STRICT CHECK: Participant cannot change answer after submission for this session
    const existing = store.answers.find(
      (a) => a.questionId === questionId && a.participantId === participantId && a.sessionId === targetSessionId
    );

    if (existing) {
      return res.status(400).json({ 
        error: 'Bu soruya daha önce yanıt verdiniz. Yanıtınızı değiştiremezsiniz.',
        isLocked: true,
        answer: existing
      });
    }

    if (participantName && participantAvatar) {
      store.participantProfiles = store.participantProfiles || {};
      store.participantProfiles[participantId] = {
        name: participantName,
        avatar: participantAvatar,
      };
    }

    const profile = store.participantProfiles?.[participantId] || {
      name: participantName || 'Anonim Katılımcı',
      avatar: participantAvatar || '👤',
    };

    const { isCorrect, pointsEarned } = evaluateAnswer(question, value);

    const nowIso = new Date().toISOString();
    const newAnswer: Answer = {
      id: 'ans-' + Math.random().toString(36).substring(2, 9),
      sessionId: targetSessionId,
      questionId,
      participantId,
      participantName: profile.name,
      participantAvatar: profile.avatar,
      type: question.type,
      value,
      submittedAt: nowIso,
      isCorrect,
      pointsEarned,
    };

    store.answers.push(newAnswer);
    saveData(store);

    const updatedResults = (!activeSession.isArchived && activeSession.sessionEnded)
      ? computeQuestionResults(question, store.answers, targetSessionId, store.attendanceRecords)
      : null;
    const updatedLeaderboard = (!activeSession.isArchived && activeSession.sessionEnded)
      ? computeLeaderboard(store, targetSessionId)
      : [];

    broadcastSSE('answer-submitted', {
      questionId,
      sessionId: targetSessionId,
      results: updatedResults,
      totalResponses: store.answers.filter((a) => a.questionId === questionId && a.sessionId === targetSessionId).length,
      leaderboard: updatedLeaderboard,
    });

    res.json({
      success: true,
      answer: newAnswer,
      isCorrect,
      pointsEarned,
      results: updatedResults,
      leaderboard: updatedLeaderboard,
    });
  });

  // Submit Attendance (Yoklama)
  // Requirements: studentNumber, fullName, location (geofencing / lat-long), deviceSignature
  // Strictly bounded to 90 seconds lifetime and stops duplicates
  app.post('/api/participant/attendance', (req, res) => {
    const { 
      participantId, 
      sessionId,
      questionId, 
      studentNumber, 
      fullName, 
      location, 
      deviceSignature 
    } = req.body;

    if (!participantId || !studentNumber || !fullName) {
      return res.status(400).json({ error: 'Öğrenci numarası ve ad soyad alanları zorunludur.' });
    }

    const cleanStudentNo = String(studentNumber).trim();
    const cleanFullName = String(fullName).trim();

    if (!cleanStudentNo || !cleanFullName) {
      return res.status(400).json({ error: 'Öğrenci numarası ve ad soyad boş bırakılamaz.' });
    }

    const store = loadData();
    const activeSession = store.sessions.find((s) => s.id === (sessionId || store.activeSessionId)) || getActiveSession(store);

    if (!activeSession) {
      return res.status(400).json({ error: 'Aktif bir oturum bulunamadı.' });
    }

    const targetQuestionId = questionId || activeSession.activeQuestionId || 'att-q-default';

    if (activeSession.sessionEnded) {
      return res.status(400).json({ error: 'Oturum tamamlanmıştır, yoklama kabul edilmemektedir.' });
    }

    if (activeSession.pollStatus !== 'open') {
      return res.status(400).json({ error: 'Yoklama şu anda kapalıdır.' });
    }

    // STRICT CHECK: 90-second expiration check
    if (activeSession.attendanceExpiresAt && Date.now() >= activeSession.attendanceExpiresAt) {
      activeSession.pollStatus = 'closed';
      activeSession.attendanceExpiresAt = null;
      if (store.activeSessionId === activeSession.id) {
        store.pollStatus = 'closed';
      }
      saveData(store);
      broadcastSSE('session-state-changed', {
        sessionId: activeSession.id,
        pollStatus: 'closed',
        attendanceExpiresAt: null,
        attendanceSecondsLeft: 0,
        attendanceEnded: true,
      });
      return res.status(400).json({ error: 'Yoklama süresi (90 saniye) dolmuştur. Yeni katılım kabul edilmemektedir.' });
    }

    store.attendanceRecords = store.attendanceRecords || [];

    // Duplicate check: Same participant in this session
    const existingParticipant = store.attendanceRecords.find(
      (r) => r.sessionId === activeSession.id && r.participantId === participantId
    );
    if (existingParticipant) {
      return res.status(400).json({
        error: 'Bu oturum için yoklamanız daha önce başarıyla kaydedilmiştir.',
        record: existingParticipant,
      });
    }

    // Duplicate check: Same student number in this session
    const existingStudentNumber = store.attendanceRecords.find(
      (r) => r.sessionId === activeSession.id && r.studentNumber.toLowerCase() === cleanStudentNo.toLowerCase()
    );
    if (existingStudentNumber) {
      return res.status(400).json({
        error: `«${cleanStudentNo}» numaralı öğrenci için bu oturumda zaten yoklama verilmiştir.`,
        record: existingStudentNumber,
      });
    }

    const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const cleanIp = rawIp.replace(/^.*:/, '').split(',')[0].trim();

    const nowIso = new Date().toISOString();
    const newRecord: AttendanceRecord = {
      id: 'att-' + Math.random().toString(36).substring(2, 9),
      sessionId: activeSession.id,
      questionId: targetQuestionId,
      participantId,
      studentNumber: cleanStudentNo,
      fullName: cleanFullName,
      location: location || {
        latitude: null,
        longitude: null,
        accuracy: null,
        altitude: null,
        capturedAt: nowIso,
      },
      deviceSignature: {
        ...(deviceSignature || {}),
        ip: cleanIp || deviceSignature?.ip || 'Bilinmiyor',
      },
      submittedAt: nowIso,
    };

    store.attendanceRecords.push(newRecord);

    // Keep an Answer log entry as well
    const existingAnswer = store.answers.find(
      (a) => a.questionId === questionId && a.participantId === participantId && a.sessionId === activeSession.id
    );
    if (!existingAnswer) {
      store.answers.push({
        id: 'ans-' + Math.random().toString(36).substring(2, 9),
        sessionId: activeSession.id,
        questionId,
        participantId,
        participantName: cleanFullName,
        participantAvatar: '🎓',
        type: 'attendance',
        value: `${cleanStudentNo} - ${cleanFullName}`,
        submittedAt: nowIso,
      });
    }

    // Update participant profile name
    store.participantProfiles = store.participantProfiles || {};
    store.participantProfiles[participantId] = {
      name: cleanFullName,
      avatar: '🎓',
    };

    saveData(store);

    broadcastSSE('attendance-submitted', {
      sessionId: activeSession.id,
      record: newRecord,
      totalCount: store.attendanceRecords.filter((r) => r.sessionId === activeSession.id).length,
    });

    res.json({
      success: true,
      record: newRecord,
    });
  });

  // Submit anonymous feedback / Q&A
  // Tied to the relevant session with isRead: false (Okunmadı)
  app.post('/api/participant/feedback', (req, res) => {
    const { participantId, message, category, participantName, participantAvatar } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Mesaj boş bırakılamaz.' });
    }

    const store = loadData();
    const activeSession = getActiveSession(store);

    const profile = store.participantProfiles?.[participantId] || {
      name: participantName || 'Anonim',
      avatar: participantAvatar || '💬',
    };

    const newFeedback: AnonymousFeedback = {
      id: 'fb-' + Math.random().toString(36).substring(2, 9),
      sessionId: activeSession ? activeSession.id : (req.body.sessionId || 'general'),
      sessionCode: activeSession ? activeSession.code : '',
      sessionTitle: activeSession ? activeSession.title : 'Genel',
      participantId: participantId || 'anon-' + Math.random().toString(36).substring(2, 6),
      participantName: profile.name,
      participantAvatar: profile.avatar,
      message: message.trim(),
      category: ['feedback', 'question', 'suggestion'].includes(category) ? category : 'feedback',
      submittedAt: new Date().toISOString(),
      upvotes: 0,
      isRead: false, // Default: Okunmadı
    };

    store.feedback.unshift(newFeedback);
    if (store.feedback.length > 200) {
      store.feedback = store.feedback.slice(0, 200);
    }

    saveData(store);
    broadcastSSE('feedback-added', newFeedback);

    res.json({ success: true, feedback: newFeedback });
  });

  // Upvote feedback
  app.post('/api/participant/feedback/upvote', (req, res) => {
    const { feedbackId } = req.body;
    const store = loadData();
    const fb = store.feedback.find((f) => f.id === feedbackId);
    if (fb) {
      fb.upvotes = (fb.upvotes || 0) + 1;
      saveData(store);
      broadcastSSE('feedback-upvoted', { id: fb.id, upvotes: fb.upvotes });
      return res.json({ success: true, feedback: fb });
    }
    res.status(404).json({ error: 'Feedback not found.' });
  });

  // Admin authentication middleware
  function verifyAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    const store = loadData();
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token === store.adminPassword) {
        return next();
      }
    }
    return res.status(401).json({ error: 'Unauthorized: Admin password required.' });
  }

  // Admin login
  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const store = loadData();
    if (password === store.adminPassword) {
      return res.json({ success: true, token: store.adminPassword });
    }
    return res.status(401).json({ success: false, error: 'Hatalı şifre.' });
  });

  // Admin full data
  app.get('/api/admin/data', verifyAdminAuth, (req, res) => {
    cleanStaleParticipants();
    const store = loadData();
    const activeSession = getActiveSession(store);

    const summaries: Record<string, QuestionResultsSummary> = {};
    store.questions.forEach((q) => {
      summaries[q.id] = computeQuestionResults(q, store.answers, activeSession?.id, store.attendanceRecords);
    });

    const leaderboard = activeSession ? computeLeaderboard(store, activeSession.id) : [];

    // Compute session-specific leaderboards for each session
    const sessionLeaderboards: Record<string, LeaderboardEntry[]> = {};
    store.sessions.forEach((s) => {
      sessionLeaderboards[s.id] = computeLeaderboard(store, s.id);
    });

    // Compute question-by-question summaries associated with each session
    const sessionResults: Record<string, Record<string, QuestionResultsSummary>> = {};
    store.sessions.forEach((s) => {
      sessionResults[s.id] = {};
      store.questions.forEach((q) => {
        sessionResults[s.id][q.id] = computeQuestionResults(q, store.answers, s.id, store.attendanceRecords);
      });
    });

    res.json({
      activeSessionId: activeSession?.id || '',
      sessions: store.sessions || [],
      sessionCode: activeSession?.code || '',
      sessionTitle: activeSession?.title || '',
      sessionDate: activeSession?.date || '',
      startTime: activeSession?.startTime || '',
      endTime: activeSession?.endTime || '',
      isArchived: Boolean(activeSession?.isArchived),
      activeQuestionId: activeSession?.activeQuestionId || null,
      pollStatus: activeSession?.pollStatus || 'closed',
      showResultsToParticipants: activeSession ? (!activeSession.isArchived && Boolean(activeSession.sessionEnded)) : false,
      sessionEnded: Boolean(activeSession?.sessionEnded),
      activeParticipantCount: Math.max(1, participantHeartbeats.size),
      questions: store.questions || [],
      totalAnswersCount: store.answers.length,
      answers: store.answers,
      attendanceRecords: store.attendanceRecords || [],
      attendanceExpiresAt: activeSession?.attendanceExpiresAt || null,
      attendanceSecondsLeft: activeSession?.attendanceExpiresAt ? Math.max(0, Math.ceil((activeSession.attendanceExpiresAt - Date.now()) / 1000)) : 0,
      feedback: store.feedback,
      summaries,
      sessionResults,
      leaderboard,
      sessionLeaderboards,
    });
  });

  // Dedicated endpoint for question-based session results
  app.get('/api/admin/sessions/:sessionId/results', verifyAdminAuth, (req, res) => {
    const { sessionId } = req.params;
    const store = loadData();
    const session = store.sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Oturum bulunamadı.' });
    }

    const sessionAnswers = store.answers.filter((a) => a.sessionId === sessionId);
    const sessionAttendance = (store.attendanceRecords || []).filter((r) => r.sessionId === sessionId);

    // Identify all questions associated with this session (assigned, answered, or attendance)
    const associatedQuestionIds = new Set(session.assignedQuestionIds || []);
    sessionAnswers.forEach((a) => associatedQuestionIds.add(a.questionId));
    if (sessionAttendance.length > 0) {
      const attQ = store.questions.find((q) => q.type === 'attendance');
      if (attQ) associatedQuestionIds.add(attQ.id);
    }

    const sessionQuestions = store.questions.filter((q) => 
      associatedQuestionIds.has(q.id) || associatedQuestionIds.size === 0
    );

    const summaries: Record<string, QuestionResultsSummary> = {};
    sessionQuestions.forEach((q) => {
      summaries[q.id] = computeQuestionResults(q, store.answers, sessionId, store.attendanceRecords);
    });

    const uniqueParticipantIds = new Set([
      ...sessionAnswers.map((a) => a.participantId),
      ...sessionAttendance.map((r) => r.participantId),
    ]);

    return res.json({
      session,
      questions: sessionQuestions,
      summaries,
      answers: sessionAnswers,
      attendanceRecords: sessionAttendance,
      totalParticipants: uniqueParticipantIds.size,
      totalAnswers: sessionAnswers.length,
      totalAttendance: sessionAttendance.length,
      leaderboard: computeLeaderboard(store, sessionId),
    });
  });

  // Session-specific leaderboard endpoint (public or admin)
  app.get('/api/session/leaderboard', (req, res) => {
    const store = loadData();
    const sessionId = (req.query.sessionId as string) || store.activeSessionId;
    const targetSession = store.sessions.find((s) => s.id === sessionId) || getActiveSession(store);

    if (!targetSession) {
      return res.json({
        sessionId: '',
        sessionCode: '',
        sessionTitle: '',
        isArchived: false,
        sessionEnded: false,
        leaderboard: [],
      });
    }

    const isPublic = !req.headers.authorization;
    if (isPublic && targetSession.isArchived) {
      return res.json({
        sessionId: targetSession.id,
        sessionCode: targetSession.code,
        sessionTitle: targetSession.title,
        isArchived: true,
        sessionEnded: Boolean(targetSession.sessionEnded),
        leaderboard: [],
      });
    }

    const leaderboard = computeLeaderboard(store, targetSession.id);
    res.json({
      sessionId: targetSession.id,
      sessionCode: targetSession.code,
      sessionTitle: targetSession.title,
      isArchived: Boolean(targetSession.isArchived),
      sessionEnded: Boolean(targetSession.sessionEnded),
      leaderboard,
    });
  });

  // --- SESSIONS MANAGEMENT ---
  // Create new session
  app.post('/api/admin/sessions', verifyAdminAuth, (req, res) => {
    const { title, date, startTime, endTime, description, assignedQuestionIds } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Oturum başlığı zorunludur.' });
    }

    const store = loadData();
    const code = 'SESS-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const nowIso = new Date().toISOString();

    // STRICT USER REQUIREMENT:
    // "Bir oturum aktif edildiğinde mevcut bütün oturumları pasif yapıp arşivle."
    // Yeni oturum oluşturulduğunda mevcut bütün oturumları pasif yapıp arşivliyoruz
    store.sessions.forEach((s) => {
      s.isArchived = true;
      s.pollStatus = 'closed';
      s.sessionEnded = true;
      s.updatedAt = nowIso;
    });

    const newSession: MeetingSession = {
      id: 'sess-' + Date.now(),
      code,
      title: title.trim(),
      description: description ? description.trim() : undefined,
      date: date || nowIso.split('T')[0],
      startTime: startTime || '09:00',
      endTime: endTime || '10:00',
      isArchived: false,
      sessionEnded: false,
      pollStatus: 'closed',
      activeQuestionId: Array.isArray(assignedQuestionIds) && assignedQuestionIds.length > 0 
        ? assignedQuestionIds[0] 
        : (store.questions.length > 0 ? store.questions[0].id : null),
      assignedQuestionIds: Array.isArray(assignedQuestionIds) ? assignedQuestionIds : store.questions.map(q => q.id),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.sessions.push(newSession);
    store.activeSessionId = newSession.id;
    store.sessionCode = newSession.code;
    store.sessionTitle = newSession.title;
    store.activeQuestionId = newSession.activeQuestionId;
    store.pollStatus = newSession.pollStatus;
    store.sessionEnded = false;

    saveData(store);
    broadcastSSE('sessions-updated', { sessions: store.sessions });
    broadcastSSE('session-state-changed', {
      activeSessionId: newSession.id,
      sessionId: newSession.id,
      sessionCode: newSession.code,
      sessionTitle: newSession.title,
      isArchived: false,
      sessionEnded: false,
      pollStatus: newSession.pollStatus,
      activeQuestionId: newSession.activeQuestionId,
    });

    res.json({ success: true, session: newSession, sessions: store.sessions });
  });

  // Edit session: Allowed ONLY if NOT archived!
  app.put('/api/admin/sessions/:id', verifyAdminAuth, (req, res) => {
    const { id } = req.params;
    const { title, date, startTime, endTime, description, assignedQuestionIds } = req.body;

    const store = loadData();
    const index = store.sessions.findIndex((s) => s.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Oturum bulunamadı.' });
    }

    const existing = store.sessions[index];

    // STRICT REQUIREMENT: Arşivlenmeyen oturumların adı ve bilgileri değiştirilebilir olmalı
    if (existing.isArchived) {
      return res.status(400).json({ 
        error: 'Arşivlenmiş oturumların adı ve bilgileri değiştirilemez. Değişiklik yapmak için önce arşivden çıkarınız.' 
      });
    }

    const updated: MeetingSession = {
      ...existing,
      title: title !== undefined ? title.trim() : existing.title,
      description: description !== undefined ? description.trim() : existing.description,
      date: date !== undefined ? date : existing.date,
      startTime: startTime !== undefined ? startTime : existing.startTime,
      endTime: endTime !== undefined ? endTime : existing.endTime,
      assignedQuestionIds: Array.isArray(assignedQuestionIds) ? assignedQuestionIds : existing.assignedQuestionIds,
      updatedAt: new Date().toISOString(),
    };

    store.sessions[index] = updated;

    if (store.activeSessionId === id) {
      store.sessionTitle = updated.title;
      store.sessionCode = updated.code;
    }

    saveData(store);
    broadcastSSE('sessions-updated', { sessions: store.sessions });
    broadcastSSE('session-state-changed', {
      sessionTitle: updated.title,
      sessionDate: updated.date,
      startTime: updated.startTime,
      endTime: updated.endTime,
    });

    res.json({ success: true, session: updated });
  });

  // Delete session
  app.delete('/api/admin/sessions/:id', verifyAdminAuth, (req, res) => {
    const { id } = req.params;
    const store = loadData();

    const existing = store.sessions.find((s) => s.id === id);
    if (!existing) {
      return res.status(404).json({ error: 'Oturum bulunamadı.' });
    }

    if (store.sessions.length <= 1) {
      return res.status(400).json({ error: 'Son kalan oturum silinemez.' });
    }

    store.sessions = store.sessions.filter((s) => s.id !== id);

    // If active session was deleted, switch active session
    if (store.activeSessionId === id) {
      const newActive = store.sessions[0];
      newActive.isArchived = false;
      newActive.sessionEnded = false;
      store.activeSessionId = newActive.id;
      store.sessionCode = newActive.code;
      store.sessionTitle = newActive.title;
      store.activeQuestionId = newActive.activeQuestionId;
      store.pollStatus = newActive.pollStatus;
      store.sessionEnded = Boolean(newActive.sessionEnded);
    }

    saveData(store);
    broadcastSSE('sessions-updated', { sessions: store.sessions });
    broadcastSSE('session-state-changed', { activeSessionId: store.activeSessionId });

    res.json({ success: true, remainingSessions: store.sessions.length });
  });

  // Archive / Unarchive session
  // STRICT RULE: "Yönetici oturumu arşive atarsa sonuçlar kesinlikle gösterilmemeli."
  app.post('/api/admin/sessions/:id/archive', verifyAdminAuth, (req, res) => {
    const { id } = req.params;
    const { isArchived } = req.body;

    const store = loadData();
    const sess = store.sessions.find((s) => s.id === id);
    if (!sess) {
      return res.status(404).json({ error: 'Oturum bulunamadı.' });
    }

    const nowIso = new Date().toISOString();

    if (isArchived) {
      sess.isArchived = true;
      sess.pollStatus = 'closed';
      sess.sessionEnded = true;
      sess.updatedAt = nowIso;

      if (store.activeSessionId === id) {
        const otherNonArchived = store.sessions.find((s) => s.id !== id && !s.isArchived);
        if (otherNonArchived) {
          store.activeSessionId = otherNonArchived.id;
          store.sessionCode = otherNonArchived.code;
          store.sessionTitle = otherNonArchived.title;
          store.activeQuestionId = otherNonArchived.activeQuestionId;
          store.pollStatus = otherNonArchived.pollStatus;
          store.sessionEnded = Boolean(otherNonArchived.sessionEnded);
        }
      }
    } else {
      // STRICT USER REQUIREMENT:
      // "Bir oturum aktif edildiğinde mevcut bütün oturumları pasif yapıp arşivle."
      // Arşivden çıkarıldığında veya aktif edildiğinde diğer oturumlar pasif yapılıp arşivlenir
      store.sessions.forEach((s) => {
        if (s.id !== id) {
          s.isArchived = true;
          s.pollStatus = 'closed';
          s.sessionEnded = true;
          s.updatedAt = nowIso;
        }
      });
      sess.isArchived = false;
      sess.sessionEnded = false;
      sess.updatedAt = nowIso;

      store.activeSessionId = sess.id;
      store.sessionCode = sess.code;
      store.sessionTitle = sess.title;
      store.activeQuestionId = sess.activeQuestionId;
      store.pollStatus = sess.pollStatus;
      store.sessionEnded = false;
    }

    saveData(store);
    broadcastSSE('sessions-updated', { sessions: store.sessions });
    broadcastSSE('session-state-changed', {
      activeSessionId: store.activeSessionId,
      sessionId: sess.id,
      sessionCode: sess.code,
      sessionTitle: sess.title,
      isArchived: sess.isArchived,
      sessionEnded: sess.sessionEnded,
      pollStatus: sess.pollStatus,
      activeQuestionId: sess.activeQuestionId,
    });

    res.json({ success: true, session: sess, sessions: store.sessions });
  });

  // Set active session
  // STRICT USER REQUIREMENT:
  // "Bir oturum aktif edildiğinde mevcut bütün oturumları pasif yapıp arşivle."
  app.post('/api/admin/sessions/:id/activate', verifyAdminAuth, (req, res) => {
    const { id } = req.params;
    const store = loadData();
    const sess = store.sessions.find((s) => s.id === id);
    if (!sess) {
      return res.status(404).json({ error: 'Oturum bulunamadı.' });
    }

    const nowIso = new Date().toISOString();

    // Make ALL other sessions passive and archived
    store.sessions.forEach((s) => {
      if (s.id !== id) {
        s.isArchived = true;
        s.pollStatus = 'closed';
        s.sessionEnded = true;
        s.updatedAt = nowIso;
      }
    });

    // Make target session unarchived, active, and not ended
    sess.isArchived = false;
    sess.sessionEnded = false;
    sess.updatedAt = nowIso;

    store.activeSessionId = sess.id;
    store.sessionCode = sess.code;
    store.sessionTitle = sess.title;
    store.activeQuestionId = sess.activeQuestionId;
    store.pollStatus = sess.pollStatus;
    store.sessionEnded = false;

    saveData(store);
    broadcastSSE('sessions-updated', { sessions: store.sessions });
    broadcastSSE('session-state-changed', {
      activeSessionId: sess.id,
      sessionId: sess.id,
      sessionCode: sess.code,
      sessionTitle: sess.title,
      isArchived: false,
      sessionEnded: false,
      pollStatus: sess.pollStatus,
      activeQuestionId: sess.activeQuestionId,
    });

    res.json({ success: true, activeSession: sess, sessions: store.sessions });
  });

  // --- ATTENDANCE (YOKLAMA) MANAGEMENT ---
  // Start 90-second attendance for a session.
  // Rule: "İstediğim oturumda istediğim zaman başlatabileceğim. O an bütün sorular pasif olacak. Aşağıdaki durumlara göre veri toplayacak ve kendi otomatik duracak... sadece 90 saniye aktif olacak sonra direk pasif olacak."
  app.post('/api/admin/sessions/:id/start-attendance', verifyAdminAuth, (req, res) => {
    const { id } = req.params;
    const store = loadData();
    const sess = store.sessions.find((s) => s.id === id);
    if (!sess) {
      return res.status(404).json({ error: 'Oturum bulunamadı.' });
    }

    if (sess.isArchived) {
      return res.status(400).json({ error: 'Arşivlenmiş oturumda yoklama başlatılamaz.' });
    }

    // Find or create default attendance question
    let attQuestion = store.questions.find((q) => q.type === 'attendance');
    if (!attQuestion) {
      attQuestion = defaultAttendanceQuestion;
      store.questions.push(attQuestion);
    }

    // Ensure attendance question is in session assigned questions
    sess.assignedQuestionIds = sess.assignedQuestionIds || [];
    if (!sess.assignedQuestionIds.includes(attQuestion.id)) {
      sess.assignedQuestionIds.unshift(attQuestion.id);
    }

    const durationSeconds = 90;
    const now = Date.now();
    const expiresAt = now + durationSeconds * 1000;

    // All other questions become passive because activeQuestionId becomes attendance question
    sess.activeQuestionId = attQuestion.id;
    sess.pollStatus = 'open';
    sess.attendanceStartedAt = now;
    sess.attendanceExpiresAt = expiresAt;

    // If target session is active session, sync root
    if (store.activeSessionId === sess.id) {
      store.activeQuestionId = attQuestion.id;
      store.pollStatus = 'open';
    }

    // Clear any existing timer for this session
    if (attendanceTimers.has(sess.id)) {
      clearTimeout(attendanceTimers.get(sess.id)!);
      attendanceTimers.delete(sess.id);
    }

    // Schedule 90-second auto-stop timer
    const timer = setTimeout(() => {
      try {
        const currStore = loadData();
        const targetSess = currStore.sessions.find((s) => s.id === sess.id);
        if (targetSess && targetSess.attendanceExpiresAt && Date.now() >= targetSess.attendanceExpiresAt) {
          targetSess.pollStatus = 'closed';
          targetSess.attendanceExpiresAt = null;
          if (currStore.activeSessionId === targetSess.id) {
            currStore.pollStatus = 'closed';
          }
          saveData(currStore);
          broadcastSSE('session-state-changed', {
            sessionId: targetSess.id,
            pollStatus: 'closed',
            attendanceExpiresAt: null,
            attendanceSecondsLeft: 0,
            attendanceEnded: true,
          });
          broadcastSSE('attendance-ended', { sessionId: targetSess.id });
        }
      } catch (err) {
        console.error('Error in auto attendance timer:', err);
      } finally {
        attendanceTimers.delete(sess.id);
      }
    }, durationSeconds * 1000);

    attendanceTimers.set(sess.id, timer);

    saveData(store);

    broadcastSSE('session-state-changed', {
      sessionId: sess.id,
      activeQuestionId: sess.activeQuestionId,
      pollStatus: 'open',
      attendanceExpiresAt: sess.attendanceExpiresAt,
      attendanceSecondsLeft: durationSeconds,
    });
    broadcastSSE('attendance-started', {
      sessionId: sess.id,
      questionId: attQuestion.id,
      expiresAt,
      durationSeconds,
    });

    res.json({
      success: true,
      session: sess,
      attendanceQuestion: attQuestion,
      expiresAt,
      durationSeconds,
    });
  });

  // Admin: Stop attendance early
  app.post('/api/admin/sessions/:id/stop-attendance', verifyAdminAuth, (req, res) => {
    const { id } = req.params;
    const store = loadData();
    const sess = store.sessions.find((s) => s.id === id);
    if (!sess) {
      return res.status(404).json({ error: 'Oturum bulunamadı.' });
    }

    sess.pollStatus = 'closed';
    sess.attendanceExpiresAt = null;
    if (store.activeSessionId === sess.id) {
      store.pollStatus = 'closed';
    }

    if (attendanceTimers.has(sess.id)) {
      clearTimeout(attendanceTimers.get(sess.id)!);
      attendanceTimers.delete(sess.id);
    }

    saveData(store);

    broadcastSSE('session-state-changed', {
      sessionId: sess.id,
      pollStatus: 'closed',
      attendanceExpiresAt: null,
      attendanceSecondsLeft: 0,
      attendanceEnded: true,
    });
    broadcastSSE('attendance-ended', { sessionId: sess.id });

    res.json({ success: true, session: sess });
  });

  // Admin: Get attendance records for a session
  // Rule: "Oturumun içerisinde bu sorudan toplanan verileri ayrıca göreceğim."
  app.get('/api/admin/sessions/:id/attendance', verifyAdminAuth, (req, res) => {
    const { id } = req.params;
    const store = loadData();
    const sess = store.sessions.find((s) => s.id === id);
    if (!sess) {
      return res.status(404).json({ error: 'Oturum bulunamadı.' });
    }

    const records = (store.attendanceRecords || []).filter((r) => r.sessionId === id);
    res.json({
      sessionId: id,
      sessionTitle: sess.title,
      totalCount: records.length,
      records,
      isAttendanceActive: sess.pollStatus === 'open' && Boolean(sess.attendanceExpiresAt && Date.now() < sess.attendanceExpiresAt),
      attendanceSecondsLeft: sess.attendanceExpiresAt ? Math.max(0, Math.ceil((sess.attendanceExpiresAt - Date.now()) / 1000)) : 0,
    });
  });

  // --- FEEDBACK READ / UNREAD ACTIONS ---
  // Toggle read status for anonymous feedback
  app.post('/api/admin/feedback/:id/toggle-read', verifyAdminAuth, (req, res) => {
    const { id } = req.params;
    const { isRead } = req.body;

    const store = loadData();
    const fb = store.feedback.find((f) => f.id === id);
    if (!fb) {
      return res.status(404).json({ error: 'Geri bildirim / soru bulunamadı.' });
    }

    fb.isRead = isRead !== undefined ? Boolean(isRead) : !fb.isRead;
    saveData(store);
    broadcastSSE('feedback-read-updated', { id: fb.id, isRead: fb.isRead });

    res.json({ success: true, feedback: fb });
  });

  // Mark all feedback as read (optionally for a specific session)
  app.post('/api/admin/feedback/mark-all-read', verifyAdminAuth, (req, res) => {
    const { sessionId } = req.body;
    const store = loadData();

    store.feedback.forEach((fb) => {
      if (!sessionId || fb.sessionId === sessionId) {
        fb.isRead = true;
      }
    });

    saveData(store);
    broadcastSSE('feedback-all-read', { sessionId });

    res.json({ success: true });
  });

  // Admin: Add question
  app.post('/api/admin/questions', verifyAdminAuth, (req, res) => {
    const { 
      title, 
      type, 
      description, 
      category, 
      tags, 
      options, 
      allowMultiple, 
      ratingMax, 
      ratingLabels, 
      isQuiz, 
      correctAnswer, 
      points, 
      explanation,
      launchImmediately 
    } = req.body;

    if (!title || !type) {
      return res.status(400).json({ error: 'Title and type are required.' });
    }

    const validTypes = ['short_text', 'long_text', 'multiple_choice', 'true_false', 'rating_pool', 'attendance'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid question type.' });
    }

    const store = loadData();
    const newQuestion: Question = {
      id: 'q-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      type,
      title: title.trim(),
      category: category ? category.trim() : 'Genel',
      tags: Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : [],
      description: description ? description.trim() : undefined,
      options: type === 'multiple_choice' ? (Array.isArray(options) ? options.filter(Boolean) : ['Seçenek 1', 'Seçenek 2']) : undefined,
      allowMultiple: type === 'multiple_choice' ? Boolean(allowMultiple) : undefined,
      ratingMax: type === 'rating_pool' ? (Number(ratingMax) || 5) : undefined,
      ratingLabels: type === 'rating_pool' && ratingLabels ? ratingLabels : undefined,
      isQuiz: Boolean(isQuiz),
      correctAnswer: isQuiz ? correctAnswer : undefined,
      points: isQuiz ? (Number(points) || 10) : undefined,
      explanation: explanation ? explanation.trim() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.questions.push(newQuestion);

    const activeSession = getActiveSession(store);
    if (activeSession) {
      if (activeSession.assignedQuestionIds) {
        activeSession.assignedQuestionIds.push(newQuestion.id);
      }

      if (launchImmediately) {
        activeSession.activeQuestionId = newQuestion.id;
        activeSession.pollStatus = 'open';
        store.activeQuestionId = newQuestion.id;
        store.pollStatus = 'open';
      }
    }

    saveData(store);
    broadcastSSE('questions-updated', { activeQuestionId: activeSession?.activeQuestionId || null, pollStatus: activeSession?.pollStatus || 'closed' });

    res.json({ success: true, question: newQuestion, activeQuestionId: activeSession?.activeQuestionId || null });
  });

  // Admin: Update question
  app.put('/api/admin/questions/:id', verifyAdminAuth, (req, res) => {
    const { id } = req.params;
    const { 
      title, 
      type, 
      description, 
      category, 
      tags, 
      options, 
      allowMultiple, 
      ratingMax, 
      ratingLabels, 
      isQuiz, 
      correctAnswer, 
      points, 
      explanation 
    } = req.body;

    const store = loadData();
    const index = store.questions.findIndex((q) => q.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    const prev = store.questions[index];
    const updated: Question = {
      ...prev,
      title: title !== undefined ? title.trim() : prev.title,
      type: type || prev.type,
      category: category !== undefined ? category.trim() : prev.category,
      tags: Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : prev.tags,
      description: description !== undefined ? description.trim() : prev.description,
      options: options !== undefined ? options.filter(Boolean) : prev.options,
      allowMultiple: allowMultiple !== undefined ? Boolean(allowMultiple) : prev.allowMultiple,
      ratingMax: ratingMax !== undefined ? Number(ratingMax) : prev.ratingMax,
      ratingLabels: ratingLabels !== undefined ? ratingLabels : prev.ratingLabels,
      isQuiz: isQuiz !== undefined ? Boolean(isQuiz) : prev.isQuiz,
      correctAnswer: correctAnswer !== undefined ? correctAnswer : prev.correctAnswer,
      points: points !== undefined ? Number(points) : prev.points,
      explanation: explanation !== undefined ? explanation.trim() : prev.explanation,
      updatedAt: new Date().toISOString(),
    };

    store.questions[index] = updated;

    if (updated.isQuiz) {
      store.answers.forEach((ans) => {
        if (ans.questionId === id) {
          const evalResult = evaluateAnswer(updated, ans.value);
          ans.isCorrect = evalResult.isCorrect;
          ans.pointsEarned = evalResult.pointsEarned;
        }
      });
    }

    saveData(store);
    broadcastSSE('questions-updated', { activeQuestionId: store.activeQuestionId, pollStatus: store.pollStatus });

    res.json({ success: true, question: updated });
  });

  // Admin: Delete question
  app.delete('/api/admin/questions/:id', verifyAdminAuth, (req, res) => {
    const { id } = req.params;
    const store = loadData();

    store.questions = store.questions.filter((q) => q.id !== id);
    store.answers = store.answers.filter((a) => a.questionId !== id);

    store.sessions.forEach((sess) => {
      if (sess.activeQuestionId === id) {
        sess.activeQuestionId = store.questions.length > 0 ? store.questions[0].id : null;
        sess.pollStatus = sess.activeQuestionId ? 'open' : 'closed';
      }
      if (sess.assignedQuestionIds) {
        sess.assignedQuestionIds = sess.assignedQuestionIds.filter((qid) => qid !== id);
      }
    });

    const activeSession = getActiveSession(store);
    store.activeQuestionId = activeSession ? activeSession.activeQuestionId : null;
    store.pollStatus = activeSession ? activeSession.pollStatus : 'closed';

    saveData(store);
    broadcastSSE('questions-updated', { activeQuestionId: store.activeQuestionId, pollStatus: store.pollStatus });

    res.json({ success: true });
  });

  // Admin: Set active question, pause/resume poll, toggle sessionEnded
  app.post('/api/admin/active-question', verifyAdminAuth, (req, res) => {
    const { questionId, pollStatus, showResultsToParticipants, sessionTitle, sessionEnded } = req.body;
    const store = loadData();
    const activeSession = getActiveSession(store);

    if (!activeSession) {
      return res.status(400).json({ error: 'Aktif bir oturum bulunamadı. Lütfen önce bir oturum oluşturun.' });
    }

    if (questionId !== undefined) {
      activeSession.activeQuestionId = questionId;
      store.activeQuestionId = questionId;
    }
    if (pollStatus !== undefined && ['open', 'closed'].includes(pollStatus)) {
      activeSession.pollStatus = pollStatus;
      store.pollStatus = pollStatus;
    }
    if (sessionEnded !== undefined) {
      activeSession.sessionEnded = Boolean(sessionEnded);
      store.sessionEnded = Boolean(sessionEnded);
    }
    if (sessionTitle !== undefined) {
      activeSession.title = sessionTitle.trim();
      store.sessionTitle = sessionTitle.trim();
    }

    saveData(store);
    broadcastSSE('session-state-changed', {
      activeQuestionId: activeSession.activeQuestionId,
      pollStatus: activeSession.pollStatus,
      showResultsToParticipants: !activeSession.isArchived && Boolean(activeSession.sessionEnded),
      sessionEnded: activeSession.sessionEnded,
      isArchived: activeSession.isArchived,
      leaderboard: (!activeSession.isArchived && activeSession.sessionEnded) ? computeLeaderboard(store, activeSession.id) : [],
    });

    res.json({
      success: true,
      activeQuestionId: activeSession.activeQuestionId,
      pollStatus: activeSession.pollStatus,
      showResultsToParticipants: !activeSession.isArchived && Boolean(activeSession.sessionEnded),
      sessionEnded: activeSession.sessionEnded,
      isArchived: activeSession.isArchived,
    });
  });

  // Admin: Reset answers
  app.post('/api/admin/reset-answers', verifyAdminAuth, (req, res) => {
    const { target } = req.body;
    const store = loadData();
    const activeSession = getActiveSession(store);

    if (!activeSession) {
      return res.json({ success: true, remainingAnswers: 0 });
    }

    if (target === 'current' && activeSession.activeQuestionId) {
      store.answers = store.answers.filter((a) => !(a.questionId === activeSession.activeQuestionId && a.sessionId === activeSession.id));
    } else {
      // ONLY delete answers for the active session, protecting other sessions!
      store.answers = store.answers.filter((a) => a.sessionId !== activeSession.id);
    }

    saveData(store);
    broadcastSSE('answers-reset', { target, questionId: activeSession.activeQuestionId, sessionId: activeSession.id });

    res.json({ success: true, remainingAnswers: store.answers.length });
  });

  // Admin: Change password
  app.post('/api/admin/change-password', verifyAdminAuth, (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 3) {
      return res.status(400).json({ error: 'Şifre en az 3 karakter olmalıdır.' });
    }

    const store = loadData();
    store.adminPassword = newPassword;
    saveData(store);

    res.json({ success: true, message: 'Yönetici şifresi başarıyla güncellendi.' });
  });

  // Admin: Export raw data
  app.get('/api/admin/export', verifyAdminAuth, (req, res) => {
    const store = loadData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=meeting-poll-export-${Date.now()}.json`);
    res.send(JSON.stringify(store, null, 2));
  });

  // Vite middleware in dev mode / static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
