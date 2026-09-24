import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ParticipantView } from './components/ParticipantView';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginModal } from './components/AdminLoginModal';
import { QuestionEditorModal } from './components/QuestionEditorModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { ParticipantProfileModal } from './components/ParticipantProfileModal';
import { 
  Question, 
  Answer, 
  AnonymousFeedback, 
  QuestionResultsSummary, 
  LeaderboardEntry, 
  ParticipantProfile,
  MeetingSession,
  AttendanceRecord,
  AttendanceLocation,
  AttendanceDeviceSignature
} from './types';
import { getStoredParticipantProfile, saveParticipantProfile } from './utils/anonymous';

// Helper to get or create anonymous participant ID
function getParticipantId(): string {
  if (typeof window === 'undefined') return 'anon-default';
  let id = localStorage.getItem('meeting_participant_id');
  if (!id) {
    id = 'anon-' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('meeting_participant_id', id);
  }
  return id;
}

export default function App() {
  const [participantId] = useState<string>(getParticipantId);
  const [profile, setProfile] = useState<ParticipantProfile>(() => getStoredParticipantProfile(participantId));
  
  // Active session details
  const [activeSessionId, setActiveSessionId] = useState('');
  const [sessions, setSessions] = useState<MeetingSession[]>([]);
  const [sessionCode, setSessionCode] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState<string | undefined>(undefined);
  const [startTime, setStartTime] = useState<string | undefined>(undefined);
  const [endTime, setEndTime] = useState<string | undefined>(undefined);
  const [isArchived, setIsArchived] = useState(false);

  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [pollStatus, setPollStatus] = useState<'open' | 'closed'>('closed');
  const [showResultsToParticipants, setShowResultsToParticipants] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [participantAnswer, setParticipantAnswer] = useState<Answer | null>(null);
  const [results, setResults] = useState<QuestionResultsSummary | null>(null);
  const [feedbackList, setFeedbackList] = useState<AnonymousFeedback[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);

  // Attendance state
  const [participantAttendanceRecord, setParticipantAttendanceRecord] = useState<AttendanceRecord | null>(null);
  const [attendanceExpiresAt, setAttendanceExpiresAt] = useState<number | null>(null);
  const [attendanceSecondsLeft, setAttendanceSecondsLeft] = useState<number | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Admin state
  const [adminToken, setAdminToken] = useState<string>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('meeting_admin_token') || '' : '';
  });
  const isAdmin = Boolean(adminToken);
  const [viewMode, setViewMode] = useState<'participant' | 'admin'>('participant');

  // Admin full data
  const [adminQuestions, setAdminQuestions] = useState<Question[]>([]);
  const [adminAnswers, setAdminAnswers] = useState<Answer[]>([]);
  const [adminSummaries, setAdminSummaries] = useState<Record<string, QuestionResultsSummary>>({});

  // Modals state
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editorLaunchByDefault, setEditorLaunchByDefault] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Network loading state
  const [isLoading, setIsLoading] = useState(true);

  // Sync participant profile with server
  const syncProfileToServer = useCallback(async (prof: ParticipantProfile) => {
    try {
      await fetch('/api/participant/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: prof.id,
          name: prof.name,
          avatar: prof.avatar,
        }),
      });
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    syncProfileToServer(profile);
  }, [profile, syncProfileToServer]);

  // Check if URL targets /admin
  const isTargetingAdminRoute = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path === '/admin' || 
      path.endsWith('/admin') ||
      hash === '#/admin' || 
      hash === '#admin' || 
      search.includes('role=admin') ||
      search === '?admin'
    );
  }, []);

  // Sync route and viewMode: admin panel is ONLY accessible when URL ends with /admin
  useEffect(() => {
    const syncRouteWithViewMode = () => {
      if (typeof window === 'undefined') return;
      const isAdminRoute = isTargetingAdminRoute();

      if (isAdminRoute) {
        if (adminToken) {
          setViewMode('admin');
          setIsAdminLoginOpen(false);
        } else {
          // Admin route requested without an active admin token: prompt password modal
          setViewMode('participant');
          setIsAdminLoginOpen(true);
        }
      } else {
        // Any other route is strictly participant view
        setViewMode('participant');
        setIsAdminLoginOpen(false);
      }
    };

    syncRouteWithViewMode();

    window.addEventListener('popstate', syncRouteWithViewMode);
    window.addEventListener('hashchange', syncRouteWithViewMode);
    return () => {
      window.removeEventListener('popstate', syncRouteWithViewMode);
      window.removeEventListener('hashchange', syncRouteWithViewMode);
    };
  }, [adminToken, isTargetingAdminRoute]);

  // Fetch Public Session State
  const fetchSessionState = useCallback(async () => {
    try {
      const res = await fetch('/api/session', {
        headers: {
          'x-participant-id': participantId,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSessionId(data.sessionId);
        setSessionCode(data.sessionCode);
        setSessionTitle(data.sessionTitle);
        setSessionDate(data.sessionDate);
        setStartTime(data.startTime);
        setEndTime(data.endTime);
        setIsArchived(Boolean(data.isArchived));

        setActiveQuestion(data.activeQuestion);
        setPollStatus(data.pollStatus);
        setShowResultsToParticipants(data.showResultsToParticipants);
        setParticipantCount(data.activeParticipantCount || 1);
        setParticipantAnswer(data.participantAnswer);
        setParticipantAttendanceRecord(data.participantAttendanceRecord || null);
        setAttendanceExpiresAt(data.attendanceExpiresAt || null);
        setAttendanceSecondsLeft(data.attendanceSecondsLeft !== undefined ? data.attendanceSecondsLeft : null);
        setResults(data.results);
        if (data.recentFeedback) {
          setFeedbackList(data.recentFeedback);
        }
        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }
        if (data.sessionEnded !== undefined) {
          setSessionEnded(Boolean(data.sessionEnded));
        }
      }
    } catch (err) {
      console.error('Failed to fetch session state:', err);
    } finally {
      setIsLoading(false);
    }
  }, [participantId]);

  // Fetch Admin Full Data
  const fetchAdminData = useCallback(async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/data', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSessionId(data.activeSessionId);
        setSessions(data.sessions || []);
        setSessionCode(data.sessionCode);
        setSessionTitle(data.sessionTitle);
        setSessionDate(data.sessionDate);
        setStartTime(data.startTime);
        setEndTime(data.endTime);
        setIsArchived(Boolean(data.isArchived));

        setPollStatus(data.pollStatus);
        setShowResultsToParticipants(data.showResultsToParticipants);
        setParticipantCount(data.activeParticipantCount || 1);
        setAdminQuestions(data.questions || []);
        setAdminAnswers(data.answers || []);
        setAdminSummaries(data.summaries || {});
        setFeedbackList(data.feedback || []);
        setAttendanceRecords(data.attendanceRecords || []);
        setAttendanceExpiresAt(data.attendanceExpiresAt || null);
        setAttendanceSecondsLeft(data.attendanceSecondsLeft !== undefined ? data.attendanceSecondsLeft : null);
        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }
        if (data.sessionEnded !== undefined) {
          setSessionEnded(Boolean(data.sessionEnded));
        }

        const currentActive = (data.questions || []).find((q: Question) => q.id === data.activeQuestionId) || null;
        setActiveQuestion(currentActive);
        if (currentActive && data.summaries && data.summaries[currentActive.id]) {
          setResults(data.summaries[currentActive.id]);
        }
      } else if (res.status === 401) {
        // Token invalid
        setAdminToken('');
        localStorage.removeItem('meeting_admin_token');
        setViewMode('participant');
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    }
  }, [adminToken]);

  // Heartbeat to keep active participant count accurate
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await fetch('/api/participant/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            participantId,
            participantName: profile.name,
            participantAvatar: profile.avatar
          }),
        });
      } catch {
        // silent
      }
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [participantId, profile]);

  // Initial load
  useEffect(() => {
    fetchSessionState();
    if (adminToken) {
      fetchAdminData();
    }
  }, [fetchSessionState, fetchAdminData, adminToken]);

  // Real-time SSE Connection
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');

      eventSource.addEventListener('session-state-changed', (e: any) => {
        try {
          if (e.data) {
            const parsed = JSON.parse(e.data);
            if (parsed.sessionEnded !== undefined) {
              setSessionEnded(Boolean(parsed.sessionEnded));
            }
            if (parsed.isArchived !== undefined) {
              setIsArchived(Boolean(parsed.isArchived));
            }
          }
        } catch {
          // ignore
        }
        fetchSessionState();
        if (adminToken) fetchAdminData();
      });

      eventSource.addEventListener('sessions-updated', (e: any) => {
        try {
          if (e.data) {
            const parsed = JSON.parse(e.data);
            if (Array.isArray(parsed.sessions)) {
              setSessions(parsed.sessions);
            }
          }
        } catch {
          // ignore
        }
        fetchSessionState();
        if (adminToken) fetchAdminData();
      });

      eventSource.addEventListener('feedback-read-updated', (e: any) => {
        try {
          if (e.data) {
            const { id, isRead } = JSON.parse(e.data);
            setFeedbackList((prev) =>
              prev.map((fb) => (fb.id === id ? { ...fb, isRead } : fb))
            );
          }
        } catch {
          // ignore
        }
        if (adminToken) fetchAdminData();
      });

      eventSource.addEventListener('feedback-all-read', () => {
        setFeedbackList((prev) => prev.map((fb) => ({ ...fb, isRead: true })));
        if (adminToken) fetchAdminData();
      });

      eventSource.addEventListener('questions-updated', () => {
        fetchSessionState();
        if (adminToken) fetchAdminData();
      });

      eventSource.addEventListener('answer-submitted', () => {
        fetchSessionState();
        if (adminToken) fetchAdminData();
      });

      eventSource.addEventListener('answers-reset', () => {
        fetchSessionState();
        if (adminToken) fetchAdminData();
      });

      eventSource.addEventListener('feedback-added', (e: any) => {
        try {
          const newFb = JSON.parse(e.data);
          setFeedbackList((prev) => [newFb, ...prev.filter((item) => item.id !== newFb.id)]);
        } catch {
          fetchSessionState();
        }
      });

      eventSource.addEventListener('feedback-upvoted', (e: any) => {
        try {
          const { id, upvotes } = JSON.parse(e.data);
          setFeedbackList((prev) =>
            prev.map((fb) => (fb.id === id ? { ...fb, upvotes } : fb))
          );
        } catch {
          fetchSessionState();
        }
      });

      eventSource.addEventListener('attendance-started', () => {
        fetchSessionState();
        if (adminToken) fetchAdminData();
      });

      eventSource.addEventListener('attendance-submitted', () => {
        fetchSessionState();
        if (adminToken) fetchAdminData();
      });

      eventSource.addEventListener('attendance-stopped', () => {
        fetchSessionState();
        if (adminToken) fetchAdminData();
      });
    } catch (err) {
      console.error('SSE connection error:', err);
    }

    // Interval backup polling
    const pollInterval = setInterval(() => {
      fetchSessionState();
      if (adminToken && viewMode === 'admin') {
        fetchAdminData();
      }
    }, 4000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, [fetchSessionState, fetchAdminData, adminToken, viewMode]);

  // Attendance countdown timer effect
  useEffect(() => {
    if (!attendanceExpiresAt) {
      setAttendanceSecondsLeft(null);
      return;
    }
    const updateCountdown = () => {
      const diff = Math.max(0, Math.ceil((attendanceExpiresAt - Date.now()) / 1000));
      setAttendanceSecondsLeft(diff);
      if (diff <= 0) {
        fetchSessionState();
        if (adminToken) fetchAdminData();
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [attendanceExpiresAt, fetchSessionState, fetchAdminData, adminToken]);

  // Handle participant submit answer
  const handleSubmitAnswer = async (
    questionId: string, 
    value: any
  ): Promise<{ success: boolean; isCorrect?: boolean; pointsEarned?: number; error?: string }> => {
    try {
      const res = await fetch('/api/participant/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          participantId, 
          questionId, 
          value,
          participantName: profile.name,
          participantAvatar: profile.avatar,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setParticipantAnswer(data.answer);
        if (data.results) {
          setResults(data.results);
        }
        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }
        await fetchSessionState();
        return { 
          success: true, 
          isCorrect: data.answer?.isCorrect, 
          pointsEarned: data.answer?.pointsEarned 
        };
      }
      return { success: false, error: data.error || 'Yanıtınız iletilemedi.' };
    } catch (err) {
      console.error('Error submitting answer:', err);
      return { success: false, error: 'Bağlantı hatası oluştu.' };
    }
  };

  // Handle participant submit feedback / question
  const handleSubmitFeedback = async (
    message: string,
    category: 'feedback' | 'question' | 'suggestion'
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/participant/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          participantId, 
          message, 
          category,
          participantName: profile.name,
          participantAvatar: profile.avatar,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackList((prev) => [data.feedback, ...prev]);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error submitting feedback:', err);
      return false;
    }
  };

  // Handle participant upvote feedback
  const handleUpvoteFeedback = async (feedbackId: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/participant/feedback/upvote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackList((prev) =>
          prev.map((fb) => (fb.id === feedbackId ? { ...fb, upvotes: data.feedback.upvotes } : fb))
        );
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error upvoting feedback:', err);
      return false;
    }
  };

  // Handle profile update from modal
  const handleProfileSave = (updated: ParticipantProfile) => {
    setProfile(updated);
    saveParticipantProfile(updated);
    syncProfileToServer(updated);
  };

  // Admin Actions
  const handleAdminLoginSuccess = (token: string) => {
    setAdminToken(token);
    localStorage.setItem('meeting_admin_token', token);
    setIsAdminLoginOpen(false);
    setViewMode('admin');
    if (typeof window !== 'undefined' && !isTargetingAdminRoute()) {
      window.history.pushState(null, '', '/admin');
    }
  };

  const handleCloseAdminLogin = () => {
    setIsAdminLoginOpen(false);
    if (!adminToken && isTargetingAdminRoute()) {
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', '/');
      }
      setViewMode('participant');
    }
  };

  const handleAdminLogout = () => {
    setAdminToken('');
    localStorage.removeItem('meeting_admin_token');
    setViewMode('participant');
    setIsAdminLoginOpen(false);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/');
    }
  };

  const handleSetActiveQuestion = async (qId: string | null): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch('/api/admin/active-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ questionId: qId, pollStatus: qId ? 'open' : 'closed' }),
      });
      if (res.ok) {
        await fetchAdminData();
        await fetchSessionState();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleTogglePollStatus = async (status: 'open' | 'closed'): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch('/api/admin/active-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ pollStatus: status }),
      });
      if (res.ok) {
        setPollStatus(status);
        await fetchAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleToggleShowResults = async (show: boolean): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch('/api/admin/active-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ showResultsToParticipants: show }),
      });
      if (res.ok) {
        setShowResultsToParticipants(show);
        await fetchAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleToggleSessionEnded = async (ended: boolean): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch('/api/admin/active-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ sessionEnded: ended }),
      });
      if (res.ok) {
        setSessionEnded(ended);
        await fetchAdminData();
        await fetchSessionState();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleDeleteQuestion = async (qId: string): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch(`/api/admin/questions/${qId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      if (res.ok) {
        await fetchAdminData();
        await fetchSessionState();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleResetAnswers = async (target: 'current' | 'all'): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch('/api/admin/reset-answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ target }),
      });
      if (res.ok) {
        await fetchAdminData();
        await fetchSessionState();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Session CRUD actions
  const handleCreateSession = async (sessionData: Partial<MeetingSession>): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(sessionData),
      });
      if (res.ok) {
        await fetchAdminData();
        await fetchSessionState();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleUpdateSession = async (id: string, sessionData: Partial<MeetingSession>): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch(`/api/admin/sessions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(sessionData),
      });
      if (res.ok) {
        await fetchAdminData();
        await fetchSessionState();
        return true;
      }
      const data = await res.json();
      alert(data.error || 'Oturum güncellenemedi.');
      return false;
    } catch {
      return false;
    }
  };

  const handleDeleteSession = async (id: string): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch(`/api/admin/sessions/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      if (res.ok) {
        await fetchAdminData();
        await fetchSessionState();
        return true;
      }
      const data = await res.json();
      alert(data.error || 'Oturum silinemedi.');
      return false;
    } catch {
      return false;
    }
  };

  const handleArchiveSession = async (id: string, archiveStatus: boolean): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch(`/api/admin/sessions/${id}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ isArchived: archiveStatus }),
      });
      if (res.ok) {
        await fetchAdminData();
        await fetchSessionState();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleActivateSession = async (id: string): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch(`/api/admin/sessions/${id}/activate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      if (res.ok) {
        await fetchAdminData();
        await fetchSessionState();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Feedback Read / Unread Handlers
  const handleToggleFeedbackRead = async (feedbackId: string, isRead?: boolean): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch(`/api/admin/feedback/${feedbackId}/toggle-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ isRead }),
      });
      if (res.ok) {
        await fetchAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleMarkAllFeedbackRead = async (sessId?: string): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch('/api/admin/feedback/mark-all-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ sessionId: sessId }),
      });
      if (res.ok) {
        await fetchAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleOpenCreateModal = (onTheFly: boolean) => {
    setEditingQuestion(null);
    setEditorLaunchByDefault(onTheFly);
    setIsEditorModalOpen(true);
  };

  const handleOpenEditModal = (q: Question) => {
    setEditingQuestion(q);
    setEditorLaunchByDefault(false);
    setIsEditorModalOpen(true);
  };

  const handleQuestionSaved = (_savedQ: Question, launchedImmediately: boolean) => {
    fetchAdminData();
    fetchSessionState();
    if (launchedImmediately) {
      setViewMode('admin');
    }
  };

  // Attendance handlers
  const handleStartAttendance = async (sessionId: string): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/start-attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAttendanceExpiresAt(data.attendanceExpiresAt);
        setAttendanceSecondsLeft(data.attendanceSecondsLeft || 90);
        await fetchSessionState();
        await fetchAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleStopAttendance = async (sessionId: string): Promise<boolean> => {
    if (!adminToken) return false;
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/stop-attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAttendanceExpiresAt(null);
        setAttendanceSecondsLeft(null);
        await fetchSessionState();
        await fetchAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleSubmitAttendance = async (data: {
    studentNumber: string;
    fullName: string;
    location: AttendanceLocation;
    deviceSignature: AttendanceDeviceSignature;
  }): Promise<{ success: boolean; record?: AttendanceRecord; error?: string }> => {
    try {
      const res = await fetch('/api/participant/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          sessionId: activeSessionId,
          studentNumber: data.studentNumber,
          fullName: data.fullName,
          location: data.location,
          deviceSignature: data.deviceSignature,
        }),
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setParticipantAttendanceRecord(resData.record);
        await fetchSessionState();
        return { success: true, record: resData.record };
      } else {
        return { success: false, error: resData.error || 'Yoklama kaydedilemedi.' };
      }
    } catch {
      return { success: false, error: 'Sunucuya bağlanırken bir hata oluştu.' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* App Header */}
      <Header
        sessionCode={sessionCode}
        sessionTitle={sessionTitle}
        sessionDate={sessionDate}
        startTime={startTime}
        endTime={endTime}
        isArchived={isArchived}
        participantCount={participantCount}
        pollStatus={pollStatus}
        isAdmin={isAdmin}
        viewMode={viewMode}
        profile={profile}
        sessionEnded={sessionEnded}
        onAdminLogout={handleAdminLogout}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Canlı toplantı oturumuna bağlanılıyor...</p>
            </div>
          </div>
        ) : viewMode === 'admin' && isAdmin ? (
          <AdminDashboard
            adminToken={adminToken}
            activeSessionId={activeSessionId}
            sessions={sessions}
            sessionCode={sessionCode}
            sessionTitle={sessionTitle}
            sessionDate={sessionDate}
            startTime={startTime}
            endTime={endTime}
            isArchived={isArchived}
            activeQuestionId={activeQuestion?.id || null}
            pollStatus={pollStatus}
            showResultsToParticipants={showResultsToParticipants}
            participantCount={participantCount}
            sessionEnded={sessionEnded}
            questions={adminQuestions}
            answers={adminAnswers}
            feedback={feedbackList}
            summaries={adminSummaries}
            leaderboard={leaderboard}
            attendanceRecords={attendanceRecords}
            attendanceExpiresAt={attendanceExpiresAt}
            attendanceSecondsLeft={attendanceSecondsLeft}
            onSetActiveQuestion={handleSetActiveQuestion}
            onTogglePollStatus={handleTogglePollStatus}
            onToggleShowResults={handleToggleShowResults}
            onToggleSessionEnded={handleToggleSessionEnded}
            onDeleteQuestion={handleDeleteQuestion}
            onResetAnswers={handleResetAnswers}
            onOpenCreateModal={handleOpenCreateModal}
            onOpenEditModal={handleOpenEditModal}
            onPasswordChangeSuccess={fetchAdminData}
            onCreateSession={handleCreateSession}
            onUpdateSession={handleUpdateSession}
            onDeleteSession={handleDeleteSession}
            onArchiveSession={handleArchiveSession}
            onActivateSession={handleActivateSession}
            onToggleFeedbackRead={handleToggleFeedbackRead}
            onMarkAllFeedbackRead={handleMarkAllFeedbackRead}
            onStartAttendance={handleStartAttendance}
            onStopAttendance={handleStopAttendance}
            onRefreshAttendance={fetchAdminData}
            onLogout={handleAdminLogout}
          />
        ) : (
          <ParticipantView
            participantId={participantId}
            profile={profile}
            activeQuestion={activeQuestion}
            pollStatus={pollStatus}
            showResults={showResultsToParticipants}
            sessionEnded={sessionEnded}
            isArchived={isArchived}
            sessionTitle={sessionTitle}
            sessionCode={sessionCode}
            sessionDate={sessionDate}
            startTime={startTime}
            endTime={endTime}
            participantAnswer={participantAnswer}
            participantAttendanceRecord={participantAttendanceRecord}
            attendanceExpiresAt={attendanceExpiresAt}
            attendanceSecondsLeft={attendanceSecondsLeft}
            results={results}
            feedbackList={feedbackList}
            onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
            onSubmitAnswer={handleSubmitAnswer}
            onSubmitAttendance={handleSubmitAttendance}
            onSubmitFeedback={handleSubmitFeedback}
            onUpvoteFeedback={handleUpvoteFeedback}
          />
        )}
      </main>

      {/* Modals */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={handleCloseAdminLogin}
        onSuccess={handleAdminLoginSuccess}
      />

      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        leaderboard={leaderboard}
        currentParticipantId={participantId}
        isSessionEnded={sessionEnded}
        sessionTitle={sessionTitle}
        sessionCode={sessionCode}
      />

      <ParticipantProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={profile}
        onSave={handleProfileSave}
      />

      {adminToken && (
        <QuestionEditorModal
          isOpen={isEditorModalOpen}
          onClose={() => setIsEditorModalOpen(false)}
          onSaved={handleQuestionSaved}
          adminToken={adminToken}
          initialQuestion={editingQuestion}
          launchByDefault={editorLaunchByDefault}
        />
      )}
    </div>
  );
}
