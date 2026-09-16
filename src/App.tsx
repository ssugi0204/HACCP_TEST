import React, { useState, useEffect } from "react";
import { 
  Check, 
  X, 
  Clock, 
  User, 
  Award, 
  FileText, 
  RefreshCw, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
  Sparkles, 
  BookOpen, 
  Smartphone, 
  Layout, 
  AlertTriangle,
  GraduationCap,
  History,
  TrendingUp,
  Download,
  Search,
  Trash2,
  Plus,
  Shield,
  Lock,
  FileSpreadsheet,
  ChevronDown,
  Home,
  QrCode,
  Copy,
  CheckCircle2,
  Clock3,
  UserCheck,
  ExternalLink,
  FileCheck,
  RotateCcw,
  Users,
  ListFilter,
  ArrowRight,
  Loader2,
  AlertCircle,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { haccpQuestions, Question } from "./data/questions";
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp, deleteDoc, doc, updateDoc, getDocs } from "firebase/firestore";
import { db } from "./lib/firebase";

// Custom Kooksoondang Logo SVG/HTML Component (High-fidelity corporate brand design)
const KooksoondangLogo = ({ className = "" }: { className?: string }) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div className="relative flex flex-col items-center">
      {/* Golden/Orange Dot above '순' */}
      <div className="flex items-center justify-center font-sans text-2xl font-black text-[#1C1C1C] tracking-[0.25em] pl-[0.25em] relative">
        <span>국</span>
        <span className="relative">
          순
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#E85B24]" />
        </span>
        <span>당</span>
      </div>
      {/* Elegant Underline */}
      <div className="w-full h-[3px] bg-[#E85B24] mt-1.5 rounded-full" />
      <span className="text-[7.5px] font-sans font-bold tracking-[0.3em] text-[#717171] uppercase mt-1 pl-[0.3em]">
        KOOKSOONDANG
      </span>
    </div>
  </div>
);

// Examinee Interface
interface ExamineeInfo {
  name: string;
  dept: string;
  idNo: string;
  date: string;
}

// History record for local storage and Firestore
interface ExamHistory {
  id?: string;
  createdAt?: any;
  date: string;
  year?: number;
  score: number;
  passed: boolean;
  name: string;
  dept: string;
  idNo?: string;
  answers?: Record<number, number>;
  reexamApproved?: boolean; // 관리자 재시험 승인 여부
  isReexam?: boolean;       // 재시험 여부
  round?: number;           // 1차(1) or 2차 재시험(2)
}

// Helper to shuffle array
const shuffleArray = <T,>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// 당일 날짜(YYYY-MM-DD)를 로컬 시간 기준으로 정확히 계산하는 헬퍼 함수
const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 시험 제한 시간 (30분 = 1,800초)
const EXAM_TIME_LIMIT_SECONDS = 30 * 60;

// 인원별 1차 및 2차 시험 종합 요약 인터페이스
export interface PersonExamSummary {
  personKey: string;
  name: string;
  dept: string;
  idNo?: string;
  year: number;
  firstExam?: ExamHistory;
  secondExam?: ExamHistory;
  isTargetForReexam: boolean;
  isReexamApproved: boolean;
  finalStatus: '1st_passed' | '2nd_passed' | '2nd_failed' | 'reexam_ready' | 'reexam_pending';
  latestDate: string;
  bestScore: number;
}

export default function App() {
  // 1. App States
  const [examinee, setExaminee] = useState<ExamineeInfo>(() => ({
    name: "",
    dept: "",
    idNo: "",
    date: getTodayDateString()
  }));
  
  const [isExamStarted, setIsExamStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [quizMode, setQuizMode] = useState<'paper' | 'card'>('paper');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>(haccpQuestions);
  
  // Timer States (30분 제한 시간)
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showTimeExpiredModal, setShowTimeExpiredModal] = useState(false);
  
  // UI States
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [showOMRModalMobile, setShowOMRModalMobile] = useState(false);
  const [examHistory, setExamHistory] = useState<ExamHistory[]>([]);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [myLocalExamRecord, setMyLocalExamRecord] = useState<ExamHistory | null>(null);
  const [activeTab, setActiveTab] = useState<'exam' | 'history'>('exam');
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const [startExamError, setStartExamError] = useState<string | null>(null);
  const [selectedHistoryDetail, setSelectedHistoryDetail] = useState<ExamHistory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'reexam' | 'retrain' | 'reexam_pending' | 'reexam_approved'>('all');
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [dummyCountInput, setDummyCountInput] = useState<string>("5");
  const [adminViewMode, setAdminViewMode] = useState<'grouped' | 'list'>('grouped'); // 인원별 1차·2차 묶음이 기본값

  // 관리자 커스텀 삭제 확인 모달 상태 (iframe 환경에서 window.confirm 차단 문제 완벽 해결)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    targetName?: string;
    description: string;
    warning?: string;
    confirmText?: string;
    onConfirm: () => Promise<void> | void;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {}
  });

  // 관리자 전용 인앱 토스트 알림 상태 (iframe 환경에서 window.alert 차단 문제 완벽 해결)
  const [adminToast, setAdminToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const showAdminToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAdminToast({ message, type });
    setTimeout(() => {
      setAdminToast(null);
    }, 4500);
  };

  // 재시험 모드 및 관리자 승인 관련 상태
  const [isReexamMode, setIsReexamMode] = useState(false);
  const [approvalActionLoading, setApprovalActionLoading] = useState<string | null>(null);
  const [reexamApprovalToast, setReexamApprovalToast] = useState<string | null>(null);

  // 시험지 출력 / 파일 저장 모달 상태
  const [showExamPaperModal, setShowExamPaperModal] = useState(false);
  const [examPaperYear, setExamPaperYear] = useState<string>(() => new Date().getFullYear().toString());
  const [examPaperType, setExamPaperType] = useState<'student' | 'teacher'>('student');
  const [examPreviewTab, setExamPreviewTab] = useState<'both' | 'page1' | 'page2'>('both');
  const [examPreviewZoom, setExamPreviewZoom] = useState<'normal' | 'large' | 'xlarge' | 'xxlarge'>('large');
  const [isExamModalMaximized, setIsExamModalMaximized] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // QR Code 공유 모달 상태
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // 구글 로그인 없이 외부 스마트폰에서 누구나 바로 접속 가능한 공식 Vercel 배포 URL
  const getPublicShareUrl = () => {
    const vercelUrl = "https://haccp-test.vercel.app";
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("saved_custom_qr_url");
      if (saved && saved.trim().startsWith("http")) {
        return saved.trim();
      }
      if (window.location.hostname.includes("vercel.app")) {
        return window.location.origin;
      }
    }
    return vercelUrl;
  };

  // 현재 환경에 맞추어 로그인 불필요 공개 URL로 QR URL 초기화
  useEffect(() => {
    setQrUrl(getPublicShareUrl());
  }, []);

  const passingScoreThreshold = 70; // 70 points out of 100 (14 correct answers)

  // 관리자 모드 관련 상태
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminCountdown, setAdminCountdown] = useState(5);
  const [adminPinInput, setAdminPinInput] = useState("");
  const [expandedRecords, setExpandedRecords] = useState<Record<string, boolean>>({});
  const [selectedQuestionDetail, setSelectedQuestionDetail] = useState<{ question: Question; userAns: number | undefined } | null>(null);

  // 관리자 비밀번호 "국순당" 클릭 시 활성화
  const handleKooksoondangClick = () => {
    if (!isExamStarted && !isAdminMode) {
      setShowAdminPinModal(true);
    }
  };

  const handlePinNumpadClick = (num: string) => {
    setAdminPinInput(prev => {
      const nextVal = prev + num;
      if (nextVal === "5678") {
        setIsAdminMode(true);
        setShowAdminPinModal(false);
        return "";
      }
      if (nextVal.length >= 4) {
        return "";
      }
      return nextVal;
    });
  };

  // 관리자 PIN 모달 5초 카운트다운 타이머
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showAdminPinModal) {
      setAdminCountdown(5);
      setAdminPinInput("");
      
      timer = setInterval(() => {
        setAdminCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setShowAdminPinModal(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showAdminPinModal]);

  // 키보드 입력 및 PIN 검증 처리
  useEffect(() => {
    if (!showAdminPinModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].includes(e.key)) {
        setAdminPinInput(prev => {
          const nextVal = prev + e.key;
          if (nextVal === "5678") {
            setIsAdminMode(true);
            setShowAdminPinModal(false);
            return "";
          }
          if (nextVal.length >= 4) {
            return "";
          }
          return nextVal;
        });
      } else if (e.key === "Backspace") {
        setAdminPinInput(prev => prev.slice(0, -1));
      } else if (e.key === "Escape") {
        setShowAdminPinModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAdminPinModal]);

  // 2. Load and save states from LocalStorage
  useEffect(() => {
    const todayDate = getTodayDateString();
    let initialExaminee = {
      name: "",
      dept: "",
      idNo: "",
      date: todayDate
    };

    const savedInfo = localStorage.getItem("haccp_examinee_info");
    if (savedInfo) {
      try {
        const parsed = JSON.parse(savedInfo);
        initialExaminee = {
          ...initialExaminee,
          ...parsed,
          name: "", // Always blank on start screen
          date: todayDate // 평가일은 항상 접속 당일로 자동 설정
        };
      } catch (e) {
        console.error(e);
      }
    }

    if (!initialExaminee.idNo) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      initialExaminee.idNo = `HS-2026-${randomNum}`;
    }

    setExaminee(initialExaminee);

    const savedLocalRecord = localStorage.getItem("my_haccp_exam_record");
    if (savedLocalRecord) {
      try {
        setMyLocalExamRecord(JSON.parse(savedLocalRecord));
      } catch (e) {
        console.error(e);
      }
    }

    const savedHistory = localStorage.getItem("haccp_exam_history_admin");
    if (savedHistory) {
      try {
        setExamHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error(e);
      }
    }

    // 2. Fetch Exam History from Firestore (Firebase 무료 Spark 플랜 150인 동시 접속 최적화)
    // 150명 일반 응시자는 지속적인 WebSocket 실시간 리스너(100개 제한)를 점유하지 않고 단발성 getDocs로 조회하며,
    // 실시간 모니터링이 필요한 관리자 화면(isAdminMode)에서만 onSnapshot 실시간 스트림을 구독합니다.
    fetchExamHistoryOnce();
  }, []);

  // 단발성 Firestore 데이터 가져오기 헬퍼 (일반 수험생 및 새로고침용: 무료 플랜 소켓 연결 0개 소모)
  const fetchExamHistoryOnce = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "exam_history"));
      const historyData: ExamHistory[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const docDate = data.date || "";
        const fallbackYear = docDate ? parseInt(docDate.split('-')[0], 10) : new Date().getFullYear();
        const recordYear = data.year || (isNaN(fallbackYear) ? new Date().getFullYear() : fallbackYear);
        
        historyData.push({ 
          id: docSnap.id, 
          ...data,
          name: (data.name || "").trim(),
          dept: (data.dept || "").trim(),
          year: recordYear
        } as ExamHistory);
      });

      // 최신 등록 순으로 정렬
      historyData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.date ? new Date(a.date).getTime() : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.date ? new Date(b.date).getTime() : 0);
        return timeB - timeA;
      });

      setExamHistory(historyData);
      setFirebaseError(null);
      setIsHistoryLoaded(true);
      localStorage.setItem("haccp_exam_history_admin", JSON.stringify(historyData));
      return historyData;
    } catch (err: any) {
      console.warn("fetchExamHistoryOnce fallback error:", err);
      setIsHistoryLoaded(true);
      return [];
    }
  };

  // 관리자 모드(isAdminMode)일 때만 실시간 스트림 onSnapshot 리스너 가동 (관리자 1~2명만 연결 소모)
  useEffect(() => {
    if (!isAdminMode) return;

    const unsubscribe = onSnapshot(collection(db, "exam_history"), (snapshot) => {
      const historyData: ExamHistory[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const docDate = data.date || "";
        const fallbackYear = docDate ? parseInt(docDate.split('-')[0], 10) : new Date().getFullYear();
        const recordYear = data.year || (isNaN(fallbackYear) ? new Date().getFullYear() : fallbackYear);
        
        historyData.push({ 
          id: docSnap.id, 
          ...data,
          name: (data.name || "").trim(),
          dept: (data.dept || "").trim(),
          year: recordYear
        } as ExamHistory);
      });

      historyData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.date ? new Date(a.date).getTime() : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.date ? new Date(b.date).getTime() : 0);
        return timeB - timeA;
      });

      setExamHistory(historyData);
      setFirebaseError(null);
      setIsHistoryLoaded(true);
      localStorage.setItem("haccp_exam_history_admin", JSON.stringify(historyData));
    }, (error) => {
      console.error("Admin Firestore onSnapshot error:", error);
      setFirebaseError(error.code || "error");
    });

    return () => unsubscribe();
  }, [isAdminMode]);

  // 3. Timer Effect (30분 제한 시간 관리)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && !isSubmitted) {
      interval = setInterval(() => {
        setSecondsElapsed(prev => {
          const next = prev + 1;
          if (next >= EXAM_TIME_LIMIT_SECONDS) {
            // 30분(1800초) 제한 시간 도달: 타이머 중지 및 시간 초과 모달 활성화
            clearInterval(interval);
            setIsTimerRunning(false);
            setShowTimeExpiredModal(true);
            return EXAM_TIME_LIMIT_SECONDS;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, isSubmitted]);

  // 3-1. Synchronize local examinee record with Firestore latest updates (e.g. reexam approval or record deletion)
  useEffect(() => {
    if (isHistoryLoaded && myLocalExamRecord) {
      const matched = examHistory.find(r => 
        (myLocalExamRecord.id && r.id === myLocalExamRecord.id) ||
        (myLocalExamRecord.idNo && r.idNo === myLocalExamRecord.idNo) ||
        (r.name === myLocalExamRecord.name && r.dept === myLocalExamRecord.dept)
      );

      // 관리자가 DB에서 이력을 리셋했거나 해당 응시자 기록을 삭제한 경우:
      // 서버에 더 이상 기록이 없으므로 로컬 저장소의 이전 응시 기록도 자동 초기화하여 새 시험 응시 허용
      if (!matched && !firebaseError) {
        setMyLocalExamRecord(null);
        localStorage.removeItem("my_haccp_exam_record");
        return;
      }

      if (matched && matched.reexamApproved !== myLocalExamRecord.reexamApproved) {
        const updated = { ...myLocalExamRecord, reexamApproved: matched.reexamApproved };
        setMyLocalExamRecord(updated);
        localStorage.setItem("my_haccp_exam_record", JSON.stringify(updated));
      }
    }
  }, [examHistory, myLocalExamRecord, isHistoryLoaded, firebaseError]);

  // 4. Score Calculation
  const correctCount = haccpQuestions.reduce((acc, q) => {
    return acc + (answers[q.id] === q.correctAnswer ? 1 : 0);
  }, 0);
  const finalScore = correctCount * 5; // 20 questions, 5 points each
  const isPassed = finalScore >= passingScoreThreshold;

  // 사람(이름+부서 또는 idNo)별 1차, 2차 시험 결과 그룹화 헬퍼 함수
  const groupExamsByPerson = (records: ExamHistory[]): PersonExamSummary[] => {
    // 1. idNo -> name / dept 매핑 테이블 생성 (재시험 등에서 이름 누락 시 복원)
    const idToInfo = new Map<string, { name: string; dept: string }>();
    records.forEach(r => {
      const name = (r.name || "").trim();
      const dept = (r.dept || "").trim();
      const idNo = (r.idNo || "").trim();
      if (idNo && name) {
        idToInfo.set(idNo, { name, dept });
      }
    });

    const map = new Map<string, ExamHistory[]>();

    records.forEach(r => {
      let rName = (r.name || "").trim();
      let rDept = (r.dept || "").trim();
      const rIdNo = (r.idNo || "").trim();

      // 이름이 누락된 레코드의 경우 동일 수험번호(idNo)를 통해 이름 및 부서 자동 복원
      if (!rName && rIdNo && idToInfo.has(rIdNo)) {
        const info = idToInfo.get(rIdNo)!;
        rName = info.name;
        if (!rDept) rDept = info.dept;
      }

      // 고유 그룹 키 결정 (TypeError 방지 및 안전한 분리)
      let key = "";
      if (rName) {
        key = `${rName}_${rDept || '기타'}`;
      } else if (rIdNo) {
        key = `idno_${rIdNo}`;
      } else {
        key = `doc_${r.id || Math.random()}`;
      }

      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(r);
    });

    const summaries: PersonExamSummary[] = [];

    map.forEach((personRecords, key) => {
      // 시간순 정렬 (과거 -> 최신)
      const sorted = [...personRecords].sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.date ? new Date(a.date).getTime() : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.date ? new Date(b.date).getTime() : 0);
        return timeA - timeB;
      });

      // 1차 시험 레코드 결정 (round === 1 또는 !isReexam 우선)
      let firstExam = sorted.find(r => r.round === 1 || (!r.isReexam && (r.round === undefined || r.round === 1)));
      if (!firstExam && sorted.length > 0) {
        firstExam = sorted[0];
      }

      // 2차 시험 레코드 결정 (round === 2 또는 isReexam 우선)
      let secondExam = sorted.find(r => r.round === 2 || r.isReexam);
      if (!secondExam && sorted.length > 1) {
        const remaining = sorted.filter(r => r !== firstExam);
        if (remaining.length > 0) {
          secondExam = remaining[remaining.length - 1];
        }
      }

      const rep = sorted[sorted.length - 1];
      const name = (rep.name || "").trim() || (firstExam?.name || "").trim() || (secondExam?.name || "").trim() || "성명 미입력";
      const dept = (rep.dept || "").trim() || (firstExam?.dept || "").trim() || (secondExam?.dept || "").trim() || "부서 미지정";
      const idNo = firstExam?.idNo || rep.idNo || secondExam?.idNo || "";
      const year = rep.year || (rep.date ? parseInt(rep.date.split('-')[0], 10) : new Date().getFullYear());

      const firstScore = firstExam ? firstExam.score : 0;
      const firstPassed = firstScore >= passingScoreThreshold;
      const isTargetForReexam = !firstPassed;
      const isReexamApproved = !!(firstExam?.reexamApproved || rep.reexamApproved);

      let finalStatus: PersonExamSummary['finalStatus'] = 'reexam_pending';
      if (firstPassed) {
        finalStatus = '1st_passed';
      } else if (secondExam) {
        finalStatus = secondExam.score >= passingScoreThreshold ? '2nd_passed' : '2nd_failed';
      } else if (isReexamApproved) {
        finalStatus = 'reexam_ready';
      } else {
        finalStatus = 'reexam_pending';
      }

      const bestScore = Math.max(firstScore, secondExam ? secondExam.score : 0);
      const latestDate = rep.date || getTodayDateString();

      summaries.push({
        personKey: key,
        name,
        dept,
        idNo,
        year,
        firstExam,
        secondExam,
        isTargetForReexam,
        isReexamApproved,
        finalStatus,
        latestDate,
        bestScore
      });
    });

    return summaries;
  };

  // 5. Handlers

  // 재시험 시작 핸들러: 1차 시험과 100% 동일한 이름 및 부서로 자동 설정 및 고정
  const handleStartReexam = (targetRecord?: ExamHistory) => {
    setIsReexamMode(true);
    setAnswers({});
    setSecondsElapsed(0);
    setIsSubmitted(false);
    setShowTimeExpiredModal(false);
    setCurrentCardIndex(0);

    // 1차 기록에서 성명과 소속 부서를 그대로 승계하여 바인딩
    let base = targetRecord || myLocalExamRecord;
    if (!base && examinee.name.trim()) {
      base = examHistory.find(r => 
        (r.name || "").trim() === examinee.name.trim() && 
        (!examinee.dept || (r.dept || "").trim() === examinee.dept.trim())
      );
    }
    if (!base && examinee.idNo) {
      base = examHistory.find(r => (r.idNo || "").trim() === examinee.idNo.trim() && Boolean((r.name || "").trim()));
    }

    if (base && (base.name || "").trim()) {
      const fixedExaminee: ExamineeInfo = {
        name: (base.name || "").trim(),
        dept: (base.dept || "").trim() || "품질보증팀",
        idNo: base.idNo || examinee.idNo,
        date: getTodayDateString()
      };
      setExaminee(fixedExaminee);
      localStorage.setItem("haccp_examinee_info", JSON.stringify(fixedExaminee));
    } else {
      setExaminee(prev => ({ ...prev, date: getTodayDateString() }));
    }

    // 문제 세팅
    setShuffledQuestions(haccpQuestions);
    setIsExamStarted(true);
    setIsTimerRunning(true);
    setStartExamError(null);
  };

  // 관리자 모드: 재시험 승인 / 승인 취소 토글
  const handleToggleReexamApproval = async (record: ExamHistory) => {
    const newApproved = !record.reexamApproved;
    const actionText = newApproved ? "품질보증팀 재시험 승인" : "재시험 승인 취소";
    const targetKey = record.id || record.idNo || `${record.name}-${record.dept}`;
    setApprovalActionLoading(targetKey);

    try {
      // 1. 로컬 상태 즉시 낙관적 업데이트 (UI 지연 및 블로킹 방지)
      const updatedHistory = examHistory.map(r => {
        const isMatch = (record.id && r.id === record.id) ||
                        (record.idNo && r.idNo === record.idNo) ||
                        (r.name === record.name && r.dept === record.dept && (!r.round || r.round === 1));
        if (isMatch) {
          return { ...r, reexamApproved: newApproved };
        }
        return r;
      });
      setExamHistory(updatedHistory);
      localStorage.setItem("haccp_exam_history_admin", JSON.stringify(updatedHistory));

      // 2. 현재 로그인/접속 응시자의 로컬 기록과 일치할 경우 함께 업데이트
      if (myLocalExamRecord && (
        (record.id && myLocalExamRecord.id === record.id) || 
        (record.idNo && myLocalExamRecord.idNo === record.idNo) || 
        (record.name === myLocalExamRecord.name && record.dept === myLocalExamRecord.dept)
      )) {
        const updatedMy = { ...myLocalExamRecord, reexamApproved: newApproved };
        setMyLocalExamRecord(updatedMy);
        localStorage.setItem("my_haccp_exam_record", JSON.stringify(updatedMy));
      }

      // 3. Firestore 원격 데이터베이스에 승인 플래그 업데이트
      if (record.id) {
        try {
          await updateDoc(doc(db, "exam_history", record.id), {
            reexamApproved: newApproved
          });
        } catch (dbErr: any) {
          console.warn("Firestore 승인 플래그 업데이트 중 오류 (로컬 상태는 보존됨):", dbErr);
        }
      }

      setReexamApprovalToast(`[품질보증팀] ${record.name} (${record.dept}) 님의 ${actionText} 처리가 완료되었습니다.`);
      setTimeout(() => setReexamApprovalToast(null), 3500);
    } catch (err: any) {
      console.error("Failed to update reexam approval:", err);
      setReexamApprovalToast(`${record.name} 님의 승인 상태 처리에 오류가 발생했습니다.`);
      setTimeout(() => setReexamApprovalToast(null), 3000);
    } finally {
      setApprovalActionLoading(null);
    }
  };

  const handleStartExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examinee.name.trim() || !examinee.dept.trim()) {
      setStartExamError("성명과 소속을 모두 입력해 주세요.");
      return;
    }

    // Check all previous records of this examinee
    const userRecords = examHistory.filter(r => 
      r.name.trim() === examinee.name.trim() && r.dept.trim() === examinee.dept.trim()
    );

    if (userRecords.length > 0) {
      // 1차 기록과 2차 기록 구분
      const firstRecord = userRecords.find(r => (!r.round || r.round === 1) && !r.isReexam);
      const secondRecord = userRecords.find(r => r.round === 2 || r.isReexam);

      // 이미 2차 재시험까지 모두 마친 경우
      if (secondRecord) {
        setMyLocalExamRecord(secondRecord);
        localStorage.setItem("my_haccp_exam_record", JSON.stringify(secondRecord));
        if (secondRecord.score >= passingScoreThreshold) {
          setStartExamError(`이미 ${secondRecord.name}님은 2차 재시험에서 ${secondRecord.score}점으로 최종 합격하셨습니다.`);
        } else {
          setStartExamError(`${secondRecord.name}님은 1차(${firstRecord?.score ?? '-'}점) 및 2차 재시험(${secondRecord.score}점)을 모두 완료하셨습니다. 추가 조치는 품질보증팀에 문의해주세요.`);
        }
        return;
      }

      // 1차 기록만 있는 경우
      if (firstRecord) {
        if (firstRecord.score >= passingScoreThreshold) {
          setStartExamError(`이미 ${firstRecord.name}님은 ${firstRecord.score}점으로 최종 합격하셨습니다. 재응시 대상이 아닙니다.`);
          setMyLocalExamRecord(firstRecord);
          localStorage.setItem("my_haccp_exam_record", JSON.stringify(firstRecord));
          return;
        } else {
          // 70점 미만 (재평가 또는 재교육+재평가 대상자)
          if (!firstRecord.reexamApproved) {
            const needRetrain = firstRecord.score < 50;
            setStartExamError(
              needRetrain 
                ? `${firstRecord.name}님은 1차 평가 점수(${firstRecord.score}점)로 [재교육+재평가] 대상자입니다. 품질보증팀의 재교육 이수 및 승인 완료 후에만 재시험 응시가 가능합니다.`
                : `${firstRecord.name}님은 1차 평가 점수(${firstRecord.score}점)로 [재평가] 대상자입니다. 품질보증팀의 승인 완료 후에만 재시험 응시가 가능합니다.`
            );
            setMyLocalExamRecord(firstRecord);
            localStorage.setItem("my_haccp_exam_record", JSON.stringify(firstRecord));
            return;
          } else {
            // 관리자 승인이 완료된 재시험 대상자! 1차 시험 결과는 안전하게 보존한 채 2차 재시험 시작
            setMyLocalExamRecord(firstRecord);
            localStorage.setItem("my_haccp_exam_record", JSON.stringify(firstRecord));
            localStorage.setItem("haccp_examinee_info", JSON.stringify(examinee));
            handleStartReexam();
            return;
          }
        }
      }
    }

    setStartExamError(null);
    setIsReexamMode(false);
    const todayDate = getTodayDateString();
    const updatedExaminee = {
      ...examinee,
      date: todayDate
    };
    setExaminee(updatedExaminee);
    // Save info to local storage
    localStorage.setItem("haccp_examinee_info", JSON.stringify(updatedExaminee));
    
    // Reset answers and timer
    setAnswers({});
    setSecondsElapsed(0);
    setIsSubmitted(false);
    setCurrentCardIndex(0);
    setShuffledQuestions(haccpQuestions);
    setIsExamStarted(true);
    setIsTimerRunning(true);
  };

  const handleSelectAnswer = (questionId: number, optionIndex: number) => {
    if (isSubmitted) return;
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const handleSubmitExam = () => {
    if (isSubmitted) return;
    setShowSubmitConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowSubmitConfirmModal(false);
    setIsSubmitted(true);
    setIsTimerRunning(false);
    
    const dateStr = getTodayDateString();
    const currentYear = new Date().getFullYear();
    
    // Add to history in Firestore
    const newRecord: ExamHistory = {
      date: dateStr,
      year: currentYear,
      score: finalScore,
      passed: finalScore >= passingScoreThreshold,
      name: examinee.name,
      dept: examinee.dept,
      idNo: examinee.idNo,
      answers: { ...answers },
      createdAt: Timestamp.now(),
      isReexam: isReexamMode,
      round: isReexamMode ? 2 : 1,
      reexamApproved: false // 응시 완료 후 승인 소진
    };
    
    try {
      const docRef = await addDoc(collection(db, "exam_history"), newRecord);
      newRecord.id = docRef.id;

      // 만약 재시험이었다면 이전 레코드의 reexamApproved도 false로 소진 처리
      if (isReexamMode) {
        const prevRecord = examHistory.find(r => 
          ((r.idNo && r.idNo === examinee.idNo) || (r.name === examinee.name && r.dept === examinee.dept)) && r.id !== docRef.id
        );
        if (prevRecord && prevRecord.id) {
          try {
            await updateDoc(doc(db, "exam_history", prevRecord.id), {
              reexamApproved: false
            });
          } catch (e) {
            console.error("이전 기록 승인 플래그 업데이트 실패:", e);
          }
        }
      }
    } catch (e: any) {
      console.error("Error adding document: ", e);
      if (e.code === 'permission-denied') {
        alert("데이터베이스 쓰기 권한이 없습니다. Firebase 콘솔에서 Firestore 규칙(Rules)을 확인해주세요.");
      } else {
        alert("시험 결과 저장에 실패했습니다: " + e.message);
      }
      // Fallback: manually update local state and storage
      const updatedHistory = [newRecord, ...examHistory];
      setExamHistory(updatedHistory);
      localStorage.setItem("haccp_exam_history_admin", JSON.stringify(updatedHistory));
    }
    
    // Save to local state and storage
    setMyLocalExamRecord(newRecord);
    localStorage.setItem("my_haccp_exam_record", JSON.stringify(newRecord));
    
    // Scroll to top to see result
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddSampleDataOfCount = (count: number) => {
    if (isNaN(count) || count <= 0) {
      alert("올바른 개수를 입력해주세요.");
      return;
    }
    
    const firstNames = ["민준", "서준", "도윤", "예준", "시우", "하준", "주원", "지호", "지후", "준서", "서연", "서윤", "지우", "서현", "하은", "하윤", "민서", "지아", "윤서", "채원"];
    const lastNames = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "전"];
    const departments = ["양조1팀", "양조2팀", "생산지원팀", "설비기술팀", "품질보증팀", "자연그대로"];
    
    const newSamples: ExamHistory[] = [];
    for (let i = 0; i < count; i++) {
      const dept = departments[Math.floor(Math.random() * departments.length)];
      const name = lastNames[Math.floor(Math.random() * lastNames.length)] + firstNames[Math.floor(Math.random() * firstNames.length)];
      
      const correctCount = Math.floor(6 + Math.random() * 15); // 6 to 20 correct answers
      const score = correctCount * 5;
      const randomId = Math.floor(1000 + Math.random() * 9000);
      
      const mockAnswers: Record<number, number> = {};
      haccpQuestions.forEach((q) => {
        const isCorrect = Math.random() < (correctCount / 20);
        if (isCorrect) {
          mockAnswers[q.id] = q.correctAnswer;
        } else {
          const wrongOptions = [1, 2, 3, 4, 5].filter(o => o !== q.correctAnswer);
          mockAnswers[q.id] = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
        }
      });

      const dateObj = new Date();
      // Randomize dates within recent days of 2026
      dateObj.setDate(dateObj.getDate() - Math.floor(Math.random() * 60));
      const dateStr = dateObj.toISOString().split('T')[0];
      const sampleYear = 2026;

      newSamples.push({
        date: dateStr,
        year: sampleYear,
        score: score,
        passed: score >= passingScoreThreshold,
        name: name,
        dept: dept,
        idNo: `HS-${sampleYear}-${randomId}`,
        answers: mockAnswers,
        createdAt: Timestamp.fromDate(dateObj)
      });
    }

    let errorOccurred = false;
    newSamples.forEach(async (sample) => {
      try {
        await addDoc(collection(db, "exam_history"), sample);
      } catch (e) {
        console.error("Error adding sample document: ", e);
        errorOccurred = true;
      }
    });

    if (errorOccurred) {
      const sortedSamples = [...newSamples].sort((a, b) => b.date.localeCompare(a.date));
      const updatedHistory = [...sortedSamples, ...examHistory];
      setExamHistory(updatedHistory);
      localStorage.setItem("haccp_exam_history_admin", JSON.stringify(updatedHistory));
      showAdminToast(`더미 데이터 ${count}건이 로컬 저장소에 추가되었습니다.`, "info");
    } else {
      showAdminToast(`더미 데이터 ${count}건이 성공적으로 생성되었습니다.`, "success");
    }
  };

  // 1) 관리자: 전체 응시 이력 완전 초기화 (모달 확인 후 실행)
  const handleClearHistory = () => {
    if (examHistory.length === 0) {
      showAdminToast("삭제할 응시 이력이 없습니다.", "info");
      return;
    }

    setDeleteConfirmModal({
      isOpen: true,
      title: "전체 응시 이력 완전 초기화",
      description: `현재 등록된 모든 응시자 시험 기록(총 ${examHistory.length}건)을 영구 삭제하시겠습니까?\n\n데이터베이스 및 로컬의 모든 평가 결과가 초기화되며, 모든 임직원이 처음부터 다시 평가에 응시할 수 있게 됩니다.`,
      warning: "삭제된 시험 기록 및 OMR 답안 내역은 절대 복구할 수 없습니다.",
      confirmText: "전체 기록 영구 삭제",
      onConfirm: async () => {
        setIsClearingHistory(true);
        let deletedCount = 0;
        let failCount = 0;

        try {
          // 1. Firestore 컬렉션의 실제 모든 문서를 직접 조회하여 일괄 삭제 (누락 및 유령 문서 완벽 방지)
          let firestoreDocIds: string[] = [];
          try {
            const querySnapshot = await getDocs(collection(db, "exam_history"));
            firestoreDocIds = querySnapshot.docs.map(docSnap => docSnap.id);
          } catch (queryErr) {
            console.warn("getDocs query failed, using local IDs:", queryErr);
            firestoreDocIds = examHistory.map(r => r.id).filter((id): id is string => Boolean(id));
          }

          // 중복 제거 및 local IDs도 합산
          const allTargetIds = new Set<string>(firestoreDocIds);
          examHistory.forEach(r => {
            if (r.id) allTargetIds.add(r.id);
          });

          // 2. 모든 Firestore 문서를 병렬 삭제
          const deletePromises = Array.from(allTargetIds).map(async (docId) => {
            try {
              await deleteDoc(doc(db, "exam_history", docId));
              deletedCount++;
            } catch (delErr) {
              console.error(`문서 삭제 오류 (ID: ${docId}):`, delErr);
              failCount++;
            }
          });
          await Promise.all(deletePromises);

          // 3. 로컬 스토리지 및 로컬 상태 일괄 완전 초기화
          setExamHistory([]);
          localStorage.removeItem("haccp_exam_history_admin");
          setMyLocalExamRecord(null);
          localStorage.removeItem("my_haccp_exam_record");
          localStorage.removeItem("haccp_examinee_info");
          localStorage.removeItem("haccp_exam_answers");
          setAnswers({});
          setIsSubmitted(false);

          if (failCount > 0) {
            showAdminToast(`전체 이력이 초기화되었습니다. (${deletedCount}건 삭제 완료)`, "success");
          } else {
            showAdminToast("모든 응시 이력이 성공적으로 완전 초기화되었습니다.", "success");
          }
        } catch (e: any) {
          console.error("전체 이력 초기화 오류: ", e);
          setExamHistory([]);
          setMyLocalExamRecord(null);
          localStorage.removeItem("haccp_exam_history_admin");
          localStorage.removeItem("my_haccp_exam_record");
          localStorage.removeItem("haccp_examinee_info");
          localStorage.removeItem("haccp_exam_answers");
          showAdminToast("로컬 저장소가 즉시 완전 초기화되었습니다.", "success");
        } finally {
          setIsClearingHistory(false);
        }
      }
    });
  };

  // 2) 관리자: 개별 응시자 기록 삭제 (모달 확인 후 실행)
  const handleDeleteSingleRecord = (record: ExamHistory) => {
    const recName = (record.name || "").trim() || "성명 미입력";
    const recDept = (record.dept || "").trim() || "부서 미지정";
    const recRound = record.round ? `${record.round}차` : (record.isReexam ? "2차" : "1차");
    const targetLabel = `${recName} (${recDept}, ${recRound} 평가, ${record.score}점)`;

    setDeleteConfirmModal({
      isOpen: true,
      title: "개별 평가 기록 삭제",
      targetName: targetLabel,
      description: `선택하신 [${targetLabel}] 기록을 데이터베이스에서 삭제하시겠습니까?\n\n삭제 시 해당 회차 기록이 제거되며, 필요 시 재응시할 수 있습니다.`,
      confirmText: "해당 기록 삭제",
      onConfirm: async () => {
        try {
          // 1. Firestore에서 문서 삭제
          if (record.id) {
            try {
              await deleteDoc(doc(db, "exam_history", record.id));
            } catch (e) {
              console.error(`개별 기록 Firestore 삭제 오류 (ID: ${record.id}):`, e);
            }
          }

          // 2. 로컬 상태 및 localStorage 즉각 업데이트
          const updated = examHistory.filter(r => {
            if (record.id && r.id) {
              return r.id !== record.id;
            }
            return !(
              (r.idNo && record.idNo && r.idNo === record.idNo) ||
              (r.name === record.name && r.dept === record.dept && r.date === record.date && r.round === record.round)
            );
          });
          setExamHistory(updated);
          localStorage.setItem("haccp_exam_history_admin", JSON.stringify(updated));

          // 3. 만약 현재 접속 기기의 시험 기록과 동일한 경우 본인 로컬 기록도 함께 제거
          if (myLocalExamRecord) {
            const isSelf = 
              (record.id && myLocalExamRecord.id === record.id) ||
              (record.idNo && myLocalExamRecord.idNo === record.idNo) ||
              (record.name && myLocalExamRecord.name && record.name === myLocalExamRecord.name && record.dept === myLocalExamRecord.dept);

            if (isSelf) {
              setMyLocalExamRecord(null);
              localStorage.removeItem("my_haccp_exam_record");
              localStorage.removeItem("haccp_examinee_info");
              localStorage.removeItem("haccp_exam_answers");
            }
          }

          showAdminToast(`[${recName}] 님의 시험 기록이 삭제되었습니다.`, "success");
        } catch (err: any) {
          console.error("개별 기록 삭제 오류:", err);
          const updated = examHistory.filter(r => (record.id ? r.id !== record.id : r !== record));
          setExamHistory(updated);
          localStorage.setItem("haccp_exam_history_admin", JSON.stringify(updated));
          showAdminToast(`기록이 삭제되었습니다.`, "success");
        }
      }
    });
  };

  // 2-1) 관리자: 사원별 1차 및 2차 기록 전체 삭제 (모달 확인 후 실행)
  const handleDeletePersonRecords = (person: PersonExamSummary) => {
    const displayName = person.name && person.name !== "성명 미입력"
      ? `${person.name} (${person.dept || '부서 미지정'})`
      : `${person.idNo || '미등록 사원'} (${person.dept || '부서'})`;

    setDeleteConfirmModal({
      isOpen: true,
      title: "사원 전체 시험 이력 삭제",
      targetName: displayName,
      description: `[${displayName}] 님의 모든 응시 기록(1차 및 2차 시험, OMR 답안 내역)을 완전히 삭제하시겠습니까?\n\n삭제 시 해당 사원의 응시 상태가 초기화되어 1차부터 새로 시험에 응시할 수 있게 됩니다.`,
      warning: "해당 사원의 1차 및 2차 시험 결과가 데이터베이스에서 영구히 삭제됩니다.",
      confirmText: "사원 기록 완전 삭제",
      onConfirm: async () => {
        const pName = (person.name || "").trim();
        const pDept = (person.dept || "").trim();
        const pIdNo = (person.idNo || "").trim();
        const firstId = person.firstExam?.id;
        const secondId = person.secondExam?.id;

        // 삭제 대상 레코드 수집
        const recordsToDelete = examHistory.filter(r => {
          const rName = (r.name || "").trim();
          const rDept = (r.dept || "").trim();
          const rIdNo = (r.idNo || "").trim();

          // 1. 고유 ID 일치
          if (r.id && (r.id === firstId || r.id === secondId)) return true;
          // 2. 수험번호 일치
          if (pIdNo && rIdNo && rIdNo === pIdNo) return true;
          // 3. 성명 및 부서 일치
          if (pName && rName && pName !== "성명 미입력" && rName === pName && (!pDept || !rDept || rDept === pDept)) return true;
          // 4. personKey 일치
          if (person.personKey && `${rName}_${rDept}` === person.personKey) return true;

          return false;
        });

        const targetDocIds = new Set<string>();
        if (firstId) targetDocIds.add(firstId);
        if (secondId) targetDocIds.add(secondId);
        recordsToDelete.forEach(r => {
          if (r.id) targetDocIds.add(r.id);
        });

        try {
          // 1. Firestore에서 해당 사원의 모든 문서 병렬 삭제
          const deletePromises = Array.from(targetDocIds).map(async (docId) => {
            try {
              await deleteDoc(doc(db, "exam_history", docId));
            } catch (e) {
              console.error(`사원 기록 Firestore 삭제 오류 (ID: ${docId}):`, e);
            }
          });
          await Promise.all(deletePromises);

          // 2. 로컬 상태 및 localStorage 즉시 동기화
          const updatedHistory = examHistory.filter(r => 
            !recordsToDelete.includes(r) && (!r.id || !targetDocIds.has(r.id))
          );
          setExamHistory(updatedHistory);
          localStorage.setItem("haccp_exam_history_admin", JSON.stringify(updatedHistory));

          // 3. 본인 기기의 기록인 경우 로컬 기록도 완전 초기화
          if (myLocalExamRecord) {
            const myName = (myLocalExamRecord.name || "").trim();
            const myDept = (myLocalExamRecord.dept || "").trim();
            const myIdNo = (myLocalExamRecord.idNo || "").trim();
            const isMyRecord = 
              (myLocalExamRecord.id && targetDocIds.has(myLocalExamRecord.id)) ||
              (pIdNo && myIdNo && myIdNo === pIdNo) ||
              (pName && myName && pName !== "성명 미입력" && myName === pName && (!pDept || !myDept || myDept === pDept));

            if (isMyRecord) {
              setMyLocalExamRecord(null);
              localStorage.removeItem("my_haccp_exam_record");
              localStorage.removeItem("haccp_examinee_info");
              localStorage.removeItem("haccp_exam_answers");
            }
          }

          showAdminToast(`[${person.name || '해당 사원'}] 님의 모든 시험 기록이 삭제되었습니다.`, "success");
        } catch (err: any) {
          console.error("인원별 기록 삭제 오류:", err);
          const updatedHistory = examHistory.filter(r => !recordsToDelete.includes(r));
          setExamHistory(updatedHistory);
          localStorage.setItem("haccp_exam_history_admin", JSON.stringify(updatedHistory));
          showAdminToast(`삭제가 완료되었습니다.`, "success");
        }
      }
    });
  };

  const downloadExcelReport = () => {
    if (examHistory.length === 0) return;

    // 인원별(사원별) 1차 및 2차 시험 결과 그룹화
    const personSummaries = groupExamsByPerson(examHistory);
    // 가나다 성명순 정렬
    personSummaries.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko"));

    const headers = [
      "연도",
      "성명",
      "소속 부서/팀",
      "수험 번호",
      "시험 구분",
      "응시 일자",
      "취득 점수",
      "판정 결과",
      "정답 수 (배점 5점)",
      "오답 수",
      "재시험 승인 상태",
      "개인 최종 수료 상태"
    ];

    // Q1 ~ Q20 문항 답안 및 정오(O/X) 판정 헤더
    for (let i = 1; i <= 20; i++) {
      headers.push(`Q${i} 제출답안`, `Q${i} 판정`);
    }

    const csvRows = [headers.join(",")];

    personSummaries.forEach(person => {
      const recYear = person.year || new Date().getFullYear();
      const idNo = person.idNo || `HS-${recYear}-미부여`;
      const name = person.name || "성명 미입력";
      const dept = person.dept || "부서 미지정";

      // 개인 최종 수료 상태 문구
      let finalStatusText = "";
      if (person.finalStatus === "1st_passed") finalStatusText = "1차 최종 합격 (수료)";
      else if (person.finalStatus === "2nd_passed") finalStatusText = "2차 재시험 합격 (수료)";
      else if (person.finalStatus === "2nd_failed") finalStatusText = "2차 불합격 (재교육 대상)";
      else if (person.finalStatus === "reexam_ready") finalStatusText = "재시험 대기 (승인 완료)";
      else finalStatusText = "1차 불합격 (승인 대기)";

      // ----------------------------------------------------
      // ROW 1: 1차 정기평가 행
      // ----------------------------------------------------
      const first = person.firstExam;
      const has1st = Boolean(first);
      const firstScore = has1st ? first!.score : 0;
      const firstPassed = has1st ? firstScore >= passingScoreThreshold : false;
      const firstCorrect = has1st ? Math.round(firstScore / 5) : 0;
      const firstWrong = has1st ? 20 - firstCorrect : 0;
      const firstDate = has1st ? first!.date : "-";

      const firstRow = [
        `"${recYear}년"`,
        `"${name.replace(/"/g, '""')}"`,
        `"${dept.replace(/"/g, '""')}"`,
        `"${idNo}"`,
        `"1차 정기평가"`,
        has1st ? `"${firstDate}"` : `"미응시"`,
        has1st ? `"${firstScore}점"` : `"-"`,
        has1st ? `"${firstPassed ? "1차 합격" : "재평가 대상 (불합격)"}"` : `"미응시"`,
        has1st ? `"${firstCorrect}개"` : `"-"`,
        has1st ? `"${firstWrong}개"` : `"-"`,
        firstPassed ? `"비해당 (1차 합격)"` : person.isReexamApproved ? `"승인 완료 (응시 가능)"` : `"미승인 (승인 대기)"`,
        `"${finalStatusText}"`
      ];

      for (let i = 1; i <= 20; i++) {
        const q = haccpQuestions.find(question => question.id === i);
        const userAns = first?.answers ? first.answers[i] : undefined;
        if (userAns === undefined) {
          firstRow.push(`"-"`, `"-"`);
        } else {
          const isCorrect = q && userAns === q.correctAnswer;
          firstRow.push(`"${userAns}번"`, `"${isCorrect ? "O" : "X"}"`);
        }
      }

      csvRows.push(firstRow.join(","));

      // ----------------------------------------------------
      // ROW 2: 2차 재시험 행
      // ----------------------------------------------------
      const second = person.secondExam;
      const has2nd = Boolean(second);

      if (has2nd) {
        const secondScore = second!.score;
        const secondPassed = secondScore >= passingScoreThreshold;
        const secondCorrect = Math.round(secondScore / 5);
        const secondWrong = 20 - secondCorrect;
        const secondDate = second!.date;

        const secondRow = [
          `"${recYear}년"`,
          `"${name.replace(/"/g, '""')}"`,
          `"${dept.replace(/"/g, '""')}"`,
          `"${idNo}"`,
          `"2차 재시험"`,
          `"${secondDate}"`,
          `"${secondScore}점"`,
          `"${secondPassed ? "2차 재시험 합격" : "2차 불합격 (재교육 대상)"}"`,
          `"${secondCorrect}개"`,
          `"${secondWrong}개"`,
          `"재시험 응시완료"`,
          `"${finalStatusText}"`
        ];

        for (let i = 1; i <= 20; i++) {
          const q = haccpQuestions.find(question => question.id === i);
          const userAns = second?.answers ? second.answers[i] : undefined;
          if (userAns === undefined) {
            secondRow.push(`"-"`, `"-"`);
          } else {
            const isCorrect = q && userAns === q.correctAnswer;
            secondRow.push(`"${userAns}번"`, `"${isCorrect ? "O" : "X"}"`);
          }
        }

        csvRows.push(secondRow.join(","));
      } else {
        // 2차 재시험을 아직 치르지 않은 경우 (1차 합격으로 비해당이거나, 불합격 후 재시험 대기 중)
        const secondStatusDesc = firstPassed
          ? "해당 없음 (1차 합격 수료)"
          : person.isReexamApproved
            ? "재시험 대기 (승인 완료)"
            : "재시험 대기 (품질보증팀 미승인)";

        const secondApprovalDesc = firstPassed
          ? "비해당 (1차 합격)"
          : person.isReexamApproved
            ? "승인 완료 (응시 가능)"
            : "미승인 (대기)";

        const secondRow = [
          `"${recYear}년"`,
          `"${name.replace(/"/g, '""')}"`,
          `"${dept.replace(/"/g, '""')}"`,
          `"${idNo}"`,
          `"2차 재시험"`,
          `"-"`,
          `"-"`,
          `"${secondStatusDesc}"`,
          `"-"`,
          `"-"`,
          `"${secondApprovalDesc}"`,
          `"${finalStatusText}"`
        ];

        for (let i = 1; i <= 20; i++) {
          secondRow.push(`"-"`, `"-"`);
        }

        csvRows.push(secondRow.join(","));
      }
    });

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `국순당_HACCP_평가결과보고서_(1차·2차_행구분)_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 새 창 / 팝업으로 큰 화면 시험지 열기 (인쇄 및 가독성 최적화)
  const handleOpenExamPaperWindow = (autoPrint: boolean = false) => {
    try {
      const printContainer = document.querySelector('.print-only');
      if (!printContainer) {
        showAdminToast("시험지 내용을 불러오는 중입니다. 다시 시도해주세요.", "error");
        return;
      }

      const popupWin = window.open('', '_blank', 'width=1100,height=950,scrollbars=yes,resizable=yes');
      if (!popupWin) {
        showAdminToast("팝업 창 차단을 해제하시면 시험지를 새 창 및 인쇄 화면으로 바로 보실 수 있습니다.", "info");
        return;
      }

      popupWin.document.open();
      popupWin.document.write(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${examPaperYear}년도 HACCP 정기 위생교육 평가 시험지 - 국순당</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 5mm 6mm 5mm 6mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
              background: #f1f5f9;
              color: #111827;
              width: 100%;
            }
            body {
              padding: 20px;
            }
            .no-print-toolbar {
              max-width: 210mm;
              margin: 0 auto 16px auto;
              background: #ffffff;
              padding: 12px 18px;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.08);
              display: flex;
              align-items: center;
              justify-content: space-between;
              border: 1px solid #e2e8f0;
            }
            .toolbar-btn {
              padding: 8px 16px;
              border-radius: 8px;
              font-size: 13px;
              font-weight: bold;
              border: none;
              cursor: pointer;
              transition: all 0.2s;
            }
            .btn-print {
              background: #047857;
              color: white;
            }
            .btn-print:hover {
              background: #065f46;
            }
            .btn-close {
              background: #4b5563;
              color: white;
            }
            .paper-wrapper {
              max-width: 210mm;
              margin: 0 auto;
              background: white;
              box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            }
            .print-page {
              width: 210mm;
              height: 297mm;
              max-height: 297mm;
              padding: 5mm 7mm 4mm 7mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              page-break-after: always;
              break-after: page;
              page-break-inside: avoid;
              break-inside: avoid;
              background: white;
              overflow: hidden;
            }
            .print-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            @media print {
              @page {
                size: A4 portrait;
                margin: 0;
              }
              html, body {
                background: white !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 210mm !important;
              }
              .no-print-toolbar {
                display: none !important;
              }
              .paper-wrapper {
                box-shadow: none !important;
                margin: 0 !important;
                max-width: 210mm !important;
                width: 210mm !important;
              }
              .print-page {
                width: 210mm !important;
                height: 297mm !important;
                max-height: 297mm !important;
                padding: 5mm 7mm 4mm 7mm !important;
                page-break-after: always !important;
                break-after: page !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                overflow: hidden !important;
              }
              .print-page:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
            }
          </style>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
        </head>
        <body>
          <div class="no-print-toolbar">
            <div>
              <strong style="font-size: 15px; color: #0f172a;">${examPaperYear}년도 HACCP 정기 위생교육 평가 시험지 (양면 1장)</strong>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                첫번째 장(1~10번) · 두번째 장(11~20번) 맑은고딕 가독성 최적화
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="toolbar-btn btn-print" onclick="window.print();">🖨️ 바로 인쇄하기</button>
              <button class="toolbar-btn btn-close" onclick="window.close();">창 닫기</button>
            </div>
          </div>
          <div class="paper-wrapper">
            ${printContainer.innerHTML}
          </div>
          <script>
            window.addEventListener('load', function() {
              ${autoPrint ? `
                setTimeout(function() {
                  window.focus();
                  window.print();
                }, 400);
              ` : ''}
            });
          </script>
        </body>
        </html>
      `);
      popupWin.document.close();
      showAdminToast("시험지가 새 창(팝업)으로 활성화되었습니다.", "success");
    } catch (e) {
      console.error("Popup window error:", e);
      window.print();
    }
  };

  // 1. 시험지 인쇄 (A4 양면 1장 최적화: 앞면 1~10번 2단 / 뒷면 11~20번 2단)
  const handlePrintExamPaper = () => {
    try {
      showAdminToast("시험지 인쇄 창을 활성화합니다. 인쇄 설정에서 '양면 인쇄(긴 면으로 넘김)'를 확인해주세요.", "info");

      // 1순위: 팝업 인쇄 창 시도 (브라우저 iframe 샌드박스 차단 없이 가장 확실하게 인쇄 대화상자 호출)
      const printContainer = document.querySelector('.print-only');
      if (printContainer) {
        const popupWin = window.open('', '_blank', 'width=1050,height=950,scrollbars=yes,resizable=yes');
        if (popupWin) {
          popupWin.document.open();
          popupWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>${examPaperYear}년도 HACCP 정기 위생교육 평가 시험지</title>
              <style>
                @page {
                  size: A4 portrait;
                  margin: 0;
                }
                * {
                  box-sizing: border-box;
                  margin: 0;
                  padding: 0;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                html, body {
                  font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
                  background: white;
                  color: #111827;
                  width: 210mm;
                  margin: 0;
                  padding: 0;
                }
                .print-page {
                  width: 210mm;
                  height: 297mm;
                  max-height: 297mm;
                  padding: 5mm 7mm 4mm 7mm;
                  box-sizing: border-box;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  page-break-after: always;
                  break-after: page;
                  page-break-inside: avoid;
                  break-inside: avoid;
                  overflow: hidden;
                }
                .print-page:last-child {
                  page-break-after: auto;
                  break-after: auto;
                }
                table {
                  border-collapse: collapse;
                  width: 100%;
                }
                @media print {
                  .no-print { display: none !important; }
                  @page {
                    size: A4 portrait;
                    margin: 0;
                  }
                  html, body {
                    background: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 210mm !important;
                  }
                  .print-page {
                    width: 210mm !important;
                    height: 297mm !important;
                    max-height: 297mm !important;
                    padding: 5mm 7mm 4mm 7mm !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    overflow: hidden !important;
                  }
                  .print-page:last-child {
                    page-break-after: auto !important;
                    break-after: auto !important;
                  }
                }
              </style>
              <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
            </head>
            <body>
              <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 9999; background: #047857; color: white; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.2);" onclick="window.print()">
                🖨️ 인쇄 대화상자 열기
              </div>
              ${printContainer.innerHTML}
              <script>
                window.addEventListener('load', function() {
                  setTimeout(function() {
                    window.focus();
                    window.print();
                  }, 400);
                });
              </script>
            </body>
            </html>
          `);
          popupWin.document.close();
          return;
        }

        // 팝업이 브라우저에서 차단된 경우 fallback iframe 인쇄
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
        if (iframeDoc && iframe.contentWindow) {
          iframeDoc.open();
          iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>${examPaperYear}년도 HACCP 정기 위생교육 평가 시험지</title>
              <style>
                @page {
                  size: A4 portrait;
                  margin: 0;
                }
                * {
                  box-sizing: border-box;
                  margin: 0;
                  padding: 0;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                html, body {
                  font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
                  background: white;
                  color: #111827;
                  width: 210mm;
                  margin: 0;
                  padding: 0;
                }
                .print-page {
                  width: 210mm;
                  height: 297mm;
                  max-height: 297mm;
                  padding: 5mm 7mm 4mm 7mm;
                  box-sizing: border-box;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  page-break-after: always;
                  break-after: page;
                  page-break-inside: avoid;
                  break-inside: avoid;
                  overflow: hidden;
                }
                .print-page:last-child {
                  page-break-after: auto;
                  break-after: auto;
                }
                table {
                  border-collapse: collapse;
                  width: 100%;
                }
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 0;
                  }
                  html, body {
                    background: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 210mm !important;
                  }
                  .print-page {
                    width: 210mm !important;
                    height: 297mm !important;
                    max-height: 297mm !important;
                    padding: 5mm 7mm 4mm 7mm !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    overflow: hidden !important;
                  }
                  .print-page:last-child {
                    page-break-after: auto !important;
                    break-after: auto !important;
                  }
                }
              </style>
              <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
            </head>
            <body>
              ${printContainer.innerHTML}
            </body>
            </html>
          `);
          iframeDoc.close();

          setTimeout(() => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
            } catch (iframeErr) {
              console.warn("Iframe print error, falling back to window.print:", iframeErr);
              document.body.classList.add("kooksoondang-printing-exam");
              window.print();
              setTimeout(() => {
                document.body.classList.remove("kooksoondang-printing-exam");
              }, 1000);
            } finally {
              setTimeout(() => {
                if (document.body.contains(iframe)) {
                  document.body.removeChild(iframe);
                }
              }, 2000);
            }
          }, 350);
          return;
        }
      }

      // 기본 fallback
      document.body.classList.add("kooksoondang-printing-exam");
      setTimeout(() => {
        try {
          window.print();
        } finally {
          setTimeout(() => {
            document.body.classList.remove("kooksoondang-printing-exam");
          }, 1000);
        }
      }, 150);
    } catch {
      window.print();
    }
  };

  // 2. 시험지 PDF 파일 직접 다운로드 (A4 양면 1장 규격 / 2페이지 완벽 분할 / 굴림체 / 가독성 강화)
  const handleDownloadExamPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      showAdminToast("가독성을 높인 A4 양면 1장 규격 PDF 파일을 생성 중입니다...", "info");

      const yearText = examPaperYear || new Date().getFullYear().toString();
      const isTeacher = examPaperType === 'teacher';
      const fileName = `${yearText}년도_국순당_HACCP_위생교육_평가시험지(양면1장)${isTeacher ? '_정답해설지' : ''}.pdf`;
      const circleChars = ['①', '②', '③', '④', '⑤'];

      const renderQuestionsPdf = (questions: typeof haccpQuestions, startIndex: number) => {
        return questions.map((q, qIdx) => {
          const num = startIndex + qIdx + 1;
          return `
            <div style="margin-bottom: 10px; padding-bottom: 2px; page-break-inside: avoid;">
              <div style="font-weight: bold; font-size: 10.5px; color: #111827; line-height: 1.32; margin-bottom: 3px; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
                ${num}. ${q.text}
              </div>
              ${q.context ? `
                <div style="background: #f3f4f6; border: 1px solid #d1d5db; padding: 2.5px 5px; font-size: 9px; color: #374151; margin-bottom: 3px; line-height: 1.28; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
                  ${q.context}
                </div>
              ` : ''}
              <div style="padding-left: 2px; font-size: 9.8px; color: #1f2937; line-height: 1.3; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
                ${q.options.map((opt, oIdx) => `
                  <div style="display: flex; align-items: flex-start; gap: 3px; margin-bottom: 1.5px;">
                    <span style="font-weight: bold; color: #111827; flex-shrink: 0;">${circleChars[oIdx] || `(${oIdx + 1})`}</span>
                    <span>${opt}${isTeacher && q.correctAnswer === oIdx + 1 ? '<b style="color: #047857; margin-left: 4px;">[★ 정답]</b>' : ''}</span>
                  </div>
                `).join('')}
              </div>
              ${isTeacher ? `
                <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 3px; padding: 2px 5px; margin-top: 3px; font-size: 9px; color: #065f46; line-height: 1.28; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
                  <b>[정답: ${q.correctAnswer}번]</b> ${q.explanation}
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      };

      // 가상 렌더링 컨테이너 생성 (A4 96 DPI: 794px × 1123px)
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "794px";
      container.style.backgroundColor = "#ffffff";
      container.style.color = "#111827";
      container.style.boxSizing = "border-box";
      container.style.fontFamily = "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif";

      container.innerHTML = `
        <!-- PAGE 1 (앞면: 1~10번) -->
        <div id="pdf-page-1" style="width: 794px; height: 1123px; padding: 18px 24px 16px 24px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; background: #ffffff; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
          <div>
            <div style="text-align: center; margin-bottom: 6px;">
              <div style="font-size: 10px; font-weight: bold; letter-spacing: 2px; color: #4b5563; margin-bottom: 2px;">
                KOOKSOONDANG | 주식회사 국순당 횡성양조장
              </div>
              <h1 style="font-size: 17px; font-weight: bold; margin: 0 0 2px 0; color: #111827; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
                ${yearText}년도 HACCP 및 선행요건 정기 위생교육 평가 시험지
              </h1>
              <div style="font-size: 10.5px; color: #4b5563; font-weight: bold;">
                주관 부서: 품질보증팀 &nbsp;|&nbsp; ${isTeacher ? '[ 관리자용 정답 및 해설지 (제 1 면 - 앞면: 1~10번) ]' : '[ 수험생 응시용 문제지 (제 1 면 - 앞면: 1~10번) ]'}
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 10.5px; text-align: center; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
              <tbody>
                <tr>
                  <th style="border: 1px solid #1f2937; background: #f3f4f6; padding: 2.5px 4px; font-weight: bold;" width="12%">소 속</th>
                  <td style="border: 1px solid #1f2937; padding: 2.5px 4px;" width="24%"></td>
                  <th style="border: 1px solid #1f2937; background: #f3f4f6; padding: 2.5px 4px; font-weight: bold;" width="12%">성 명</th>
                  <td style="border: 1px solid #1f2937; padding: 2.5px 4px;" width="24%"></td>
                  <th style="border: 1px solid #1f2937; background: #f3f4f6; padding: 2.5px 4px; font-weight: bold;" width="14%">결 재</th>
                  <td style="border: 1px solid #1f2937; padding: 2.5px 4px; font-size: 9.5px; font-weight: 500;" width="14%">담당 / 팀장</td>
                </tr>
                <tr>
                  <th style="border: 1px solid #1f2937; background: #f3f4f6; padding: 2.5px 4px; font-weight: bold;">평가 일자</th>
                  <td style="border: 1px solid #1f2937; padding: 2.5px 4px;">${yearText}년 ___월 ___일</td>
                  <th style="border: 1px solid #1f2937; background: #f3f4f6; padding: 2.5px 4px; font-weight: bold;">평가 점수</th>
                  <td style="border: 1px solid #1f2937; padding: 2.5px 4px; font-weight: bold;">_____ 점 / 100점</td>
                  <th style="border: 1px solid #1f2937; background: #f3f4f6; padding: 2.5px 4px; font-weight: bold;">판 정</th>
                  <td style="border: 1px solid #1f2937; padding: 2.5px 4px; font-size: 9.5px; font-weight: bold;">[ 합격 / 재평가 ]</td>
                </tr>
              </tbody>
            </table>

            <div style="border: 1px solid #9ca3af; background: #f9fafb; padding: 3px 8px; margin-bottom: 7px; font-size: 10px; line-height: 1.35; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
              <b>[평가 안내사항]</b> ① 총 20문항(문항당 5점 배점)이며 70점 이상 합격입니다. ② 첫번째 장(앞면): 1~10번 / 두번째 장(뒷면): 11~20번입니다.
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; position: relative;">
              <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: #cbd5e1; transform: translateX(-50%);"></div>
              <div style="padding-right: 8px;">
                ${renderQuestionsPdf(haccpQuestions.slice(0, 5), 0)}
              </div>
              <div style="padding-left: 8px;">
                ${renderQuestionsPdf(haccpQuestions.slice(5, 10), 5)}
              </div>
            </div>
          </div>

          <div style="border-top: 1px solid #cbd5e1; padding-top: 4px; text-align: center; font-size: 10px; color: #4b5563; font-weight: bold; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
            - 1 / 2 면 [ 다음 면(뒷면) 11~20번에 계속 ] -
          </div>
        </div>

        <!-- PAGE 2 (뒷면: 11~20번) -->
        <div id="pdf-page-2" style="width: 794px; height: 1123px; padding: 18px 24px 16px 24px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; background: #ffffff; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #1f2937; padding-bottom: 4px; margin-bottom: 7px; font-size: 10.5px; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
              <span style="font-weight: bold; font-size: 12px; color: #111827;">
                ${yearText}년도 HACCP 정기 위생교육 평가 시험지 (제 2 면 - 뒷면: 11~20번)
              </span>
              <span style="font-weight: bold; color: #374151;">성명: __________________ &nbsp;&nbsp; 소속: __________________</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; position: relative;">
              <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: #cbd5e1; transform: translateX(-50%);"></div>
              <div style="padding-right: 8px;">
                ${renderQuestionsPdf(haccpQuestions.slice(10, 15), 10)}
              </div>
              <div style="padding-left: 8px;">
                ${renderQuestionsPdf(haccpQuestions.slice(15, 20), 15)}
              </div>
            </div>

            <div style="border: 1px solid #9ca3af; background: #f9fafb; padding: 3px 8px; text-align: center; font-size: 10px; color: #374151; margin-top: 7px; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
              <b>[ - 이하 여백 - ]</b> 문제 풀이를 완료하신 후 기재사항 및 누락된 문항이 없는지 다시 점검하십시오. 수고하셨습니다.
            </div>
          </div>

          <div style="border-top: 1px solid #cbd5e1; padding-top: 4px; display: flex; justify-content: space-between; font-size: 10px; color: #4b5563; font-weight: bold; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
            <span>주식회사 국순당 품질보증팀</span>
            <span>- 2 / 2 면 (끝) -</span>
            <span>HACCP 식품안전관리인증기준</span>
          </div>
        </div>
      `;

      document.body.appendChild(container);

      const page1El = container.querySelector("#pdf-page-1") as HTMLElement;
      const page2El = container.querySelector("#pdf-page-2") as HTMLElement;

      const canvas1 = await html2canvas(page1El, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
      });

      const canvas2 = await html2canvas(page2El, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
      });

      document.body.removeChild(container);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const imgData1 = canvas1.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgData1, "JPEG", 0, 0, 210, 297);

      pdf.addPage();
      const imgData2 = canvas2.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgData2, "JPEG", 0, 0, 210, 297);

      pdf.save(fileName);
      showAdminToast("가독성 높은 2페이지 양면 1장 규격 PDF 저장이 완료되었습니다.", "success");
    } catch (err) {
      console.error("PDF generation failed:", err);
      showAdminToast("PDF 직접 생성 중 오류가 발생했습니다. 브라우저 인쇄 기능을 이용해주세요.", "error");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 3. 시험지 DOC 파일 저장 (Word 전용: A4 양면 1장 2단 다단 완벽 2페이지 최적화 / 굴림체 / 문항 간 공백 추가 및 가독성 꽉 차도록 조절)
  const handleDownloadExamDoc = () => {
    const yearText = examPaperYear || new Date().getFullYear().toString();
    const title = `${yearText}년도 국순당 HACCP 및 선행요건 정기 위생교육 평가 시험지`;
    const isTeacher = examPaperType === 'teacher';
    const circleChars = ['①', '②', '③', '④', '⑤'];

    const renderWordQuestions = (questions: typeof haccpQuestions, startIndex: number) => {
      return questions.map((q, qIdx) => {
        const num = startIndex + qIdx + 1;
        return `
          <div style="margin-bottom: 9pt; page-break-inside: avoid; mso-line-height-rule: exactly; font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;">
            <div style="font-size: 10.5pt; font-weight: bold; color: #111111; line-height: 1.35; margin-bottom: 2.5pt;">
              ${num}. ${q.text}
            </div>
            ${q.context ? `
              <div style="background-color: #f3f4f6; border: 0.5pt solid #d1d5db; padding: 2.5pt 4.5pt; font-size: 9.2pt; color: #374151; margin-bottom: 2.5pt; line-height: 1.28;">
                ${q.context}
              </div>
            ` : ''}
            <div style="padding-left: 2pt;">
              ${q.options.map((opt, oIdx) => `
                <div style="font-size: 9.8pt; color: #111111; line-height: 1.32; margin-bottom: 1.8pt;">
                  <b style="color: #111111;">${circleChars[oIdx] || `(${oIdx + 1})`}</b> ${opt}
                  ${isTeacher && q.correctAnswer === oIdx + 1 ? '<b style="color: #15803d; margin-left: 3pt;">[★ 정답]</b>' : ''}
                </div>
              `).join('')}
            </div>
            ${isTeacher ? `
              <div style="background-color: #f0fdf4; border: 0.5pt solid #86efac; padding: 2.5pt 4.5pt; margin-top: 2.5pt; font-size: 9pt; color: #166534; line-height: 1.28;">
                <b>[정답: ${q.correctAnswer}번]</b> ${q.explanation}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    };

    const content = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${title}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page Section1 {
          size: 210mm 297mm;
          margin: 6mm 8mm 6mm 8mm;
          mso-header-margin: 3mm;
          mso-footer-margin: 3mm;
          mso-paper-source: 0;
        }
        div.Section1 {
          page: Section1;
        }
        body {
          font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
          font-size: 9.8pt;
          line-height: 1.32;
          color: #111111;
          margin: 0;
          padding: 0;
        }
        .comp-brand {
          text-align: center;
          font-size: 8.5pt;
          color: #4b5563;
          font-weight: bold;
          letter-spacing: 1.5px;
          margin-bottom: 1pt;
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
        }
        h1 {
          text-align: center;
          font-size: 14pt;
          font-weight: bold;
          margin: 0 0 1pt 0;
          color: #111111;
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
        }
        .sub-title {
          text-align: center;
          font-size: 9pt;
          color: #374151;
          font-weight: bold;
          margin-bottom: 2.5pt;
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
        }
        table.hdr-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 2.5pt;
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
        }
        table.hdr-table th, table.hdr-table td {
          border: 0.5pt solid #333333;
          padding: 2pt 3pt;
          font-size: 9pt;
          text-align: center;
        }
        table.hdr-table th {
          background-color: #f2f4f7;
          font-weight: bold;
        }
        .notice-box {
          border: 0.5pt solid #9ca3af;
          background-color: #f9fbfd;
          padding: 2.5pt 5pt;
          font-size: 8.8pt;
          line-height: 1.3;
          margin-bottom: 3pt;
        }
        table.two-col-grid {
          width: 100%;
          border-collapse: collapse;
          border: none;
        }
        .q-col-left {
          width: 48.5%;
          vertical-align: top;
          padding-right: 7pt;
          border-right: 0.5pt solid #d1d5db;
        }
        .q-col-right {
          width: 48.5%;
          vertical-align: top;
          padding-left: 7pt;
        }
        .page-footer {
          text-align: center;
          font-size: 8.8pt;
          color: #4b5563;
          font-weight: bold;
          margin-top: 2.5pt;
          border-top: 0.5pt solid #cbd5e1;
          padding-top: 2pt;
        }
        .page2-header {
          border-bottom: 0.75pt solid #333333;
          padding-bottom: 2pt;
          margin-bottom: 3pt;
        }
      </style>
    </head>
    <body>
      <div class="Section1">
        <!-- PAGE 1 (앞면: 1번~10번 2단 다단) -->
        <div class="comp-brand">KOOKSOONDANG | 주식회사 국순당 횡성양조장</div>
        <h1>${title}</h1>
        <div class="sub-title">
          [ 주관 부서: 품질보증팀 | ${isTeacher ? '관리자 정답 및 해설지 (제 1 면 - 앞면: 1~10번)' : '수험생 응시용 문제지 (제 1 면 - 앞면: 1~10번)'} ]
        </div>

        <table class="hdr-table">
          <tr>
            <th width="12%">소 속</th>
            <td width="24%"></td>
            <th width="12%">성 명</th>
            <td width="24%"></td>
            <th width="14%">결 재</th>
            <td width="14%">담당 / 품질보증팀장</td>
          </tr>
          <tr>
            <th>평가 일자</th>
            <td>${yearText}년 &nbsp;&nbsp;&nbsp;월 &nbsp;&nbsp;&nbsp;일</td>
            <th>평가 점수</th>
            <td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 점 / 100점</td>
            <th>판 정</th>
            <td>[ 합격 &nbsp;/&nbsp; 재평가 ]</td>
          </tr>
        </table>

        <div class="notice-box">
          <b>[평가 안내사항]</b> ① 총 20문항(문항당 5점 배점)이며 70점 이상 합격입니다. ② 첫번째 장(앞면): 1~10번 / 두번째 장(뒷면): 11~20번입니다.
        </div>

        <table class="two-col-grid" cellpadding="0" cellspacing="0">
          <tr>
            <td class="q-col-left">
              <!-- Q 1 ~ 5 -->
              ${renderWordQuestions(haccpQuestions.slice(0, 5), 0)}
            </td>
            <td class="q-col-right">
              <!-- Q 6 ~ 10 -->
              ${renderWordQuestions(haccpQuestions.slice(5, 10), 5)}
            </td>
          </tr>
        </table>

        <div class="page-footer">
          - 1 / 2 면 [ 다음 면(뒷면) 11~20번에 계속 ] -
        </div>

        <!-- PAGE BREAK FOR DOUBLE-SIDED 1 SHEET (WORD NATIVE PAGE BREAK) -->
        <br clear="all" style="page-break-before: always; mso-special-character: line-break;" />

        <!-- PAGE 2 (뒷면: 11번~20번 2단 다단) -->
        <table width="100%" class="page2-header" cellpadding="0" cellspacing="0">
          <tr>
            <td align="left" style="font-size: 10pt; font-weight: bold; color: #111111;">
              ${yearText}년도 HACCP 및 선행요건 정기 위생교육 평가 시험지 (제 2 면 - 뒷면: 11~20번)
            </td>
            <td align="right" style="font-size: 9pt; font-weight: bold; color: #333333;">
              성명: _______________ &nbsp;&nbsp; 소속: _______________
            </td>
          </tr>
        </table>

        <table class="two-col-grid" cellpadding="0" cellspacing="0">
          <tr>
            <td class="q-col-left">
              <!-- Q 11 ~ 15 -->
              ${renderWordQuestions(haccpQuestions.slice(10, 15), 10)}
            </td>
            <td class="q-col-right">
              <!-- Q 16 ~ 20 -->
              ${renderWordQuestions(haccpQuestions.slice(15, 20), 15)}
            </td>
          </tr>
        </table>

        <div class="notice-box" style="margin-top: 3pt; text-align: center;">
          <b>[ - 이하 여백 - ]</b> 문제 풀이를 완료하신 후 기재사항 및 누락된 문항이 없는지 다시 점검하십시오. 수고하셨습니다.
        </div>

        <div class="page-footer">
          - 2 / 2 면 (끝) &nbsp;|&nbsp; 주식회사 국순당 품질보증팀 -
        </div>
      </div>
    </body>
    </html>
    `;

    const blob = new Blob(['\ufeff' + content], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${yearText}년도_국순당_HACCP_위생교육_평가시험지(양면1장)${isTeacher ? '_해답지' : ''}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showAdminToast("워드 문서(.doc) 저장이 완료되었습니다. A4 규격 2페이지(양면 1장)로 최적화되었습니다.", "success");
  };

  // 시험지 TXT 파일 저장
  const handleDownloadExamTxt = () => {
    const yearText = examPaperYear || new Date().getFullYear().toString();
    let txt = `=================================================================\n`;
    txt += `[국순당 횡성양조장] ${yearText}년도 HACCP 및 선행요건 정기 위생교육 평가 시험지\n`;
    txt += `주관 부서: 품질보증팀 | 대상: 전 임직원 및 작업자 (합격기준: 70점 이상)\n`;
    txt += `=================================================================\n`;
    txt += `소속: _______________   성명: _______________   일자: ${yearText}년 ___월 ___일\n`;
    txt += `점수: _____점 / 100점    판정: [ 합격 / 불합격 ]   확인: 품질보증팀장 (인)\n`;
    txt += `-----------------------------------------------------------------\n\n`;

    haccpQuestions.forEach((q, idx) => {
      txt += `${idx + 1}. ${q.text}\n`;
      q.options.forEach((opt, oIdx) => {
        txt += `   ${oIdx + 1}) ${opt}${examPaperType === 'teacher' && q.correctAnswer === oIdx + 1 ? ' [★ 정답]' : ''}\n`;
      });
      if (examPaperType === 'teacher') {
        txt += `   [정답: ${q.correctAnswer}번] ${q.explanation}\n`;
      }
      txt += `\n`;
    });

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${yearText}년도_국순당_HACCP_위생교육_평가시험지${examPaperType === 'teacher' ? '_해답지' : ''}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExitExam = () => {
    setIsExamStarted(false);
    setIsSubmitted(false);
    setIsReexamMode(false);
    setAnswers({});
    setExaminee(prev => ({
      ...prev,
      name: "" // Ensure name is cleared/blank when returning to start screen
    }));
  };

  // Format Time
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Printing logic
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F4F3EF] text-[#2C2C2A] font-sans flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* ----------------- GLOBAL HEADER (Non-print) ----------------- */}
      <header className="no-print bg-white border-b border-stone-200 sticky top-0 z-40 shadow-xs px-4 py-3 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <KooksoondangLogo />
            <div className="hidden md:flex h-5 w-px bg-stone-200" />
            <span className="hidden md:inline text-xs font-semibold px-2.5 py-1 bg-emerald-55 text-emerald-800 rounded-full border border-emerald-100">
              HACCP 내부평가 시스템
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isAdminMode && (
              <button
                onClick={() => setShowAdminPinModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
                title="관리자 모드 (PIN: 5678)"
              >
                <Lock size={13} className="text-stone-500" />
                <span className="text-[11px] font-semibold">관리자</span>
              </button>
            )}
            <button
              onClick={() => setShowCheatSheet(!showCheatSheet)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100 border border-stone-200 transition-colors"
            >
              <BookOpen size={14} />
              HACCP 핵심 요약
            </button>
          </div>
        </div>
      </header>

      {/* ----------------- MAIN WRAPPER ----------------- */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">
        
        {/* ----------------- INTERACTIVE CHEAT SHEET DRAWER ----------------- */}
        <AnimatePresence>
          {showCheatSheet && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="no-print bg-amber-50/75 border border-amber-200/80 rounded-xl p-5 md:p-6 text-stone-800 shadow-sm relative overflow-hidden"
            >
              <div className="absolute right-4 top-4">
                <button 
                  onClick={() => setShowCheatSheet(false)}
                  className="p-1 hover:bg-amber-100 rounded-full text-stone-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-700 mt-0.5">
                  <Info size={20} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-stone-900 text-base md:text-lg">국순당 횡성양조장 HACCP 핵심 요약 노트</h3>
                  <p className="text-xs text-stone-600 mt-1">시험 시작 전 가볍게 읽고 복습해 보세요.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 text-xs md:text-sm">
                <div className="bg-white/80 p-3.5 rounded-lg border border-amber-100">
                  <h4 className="font-bold text-emerald-800 mb-1.5 flex items-center gap-1">
                    <span>1. 위해요소 3대 분석</span>
                  </h4>
                  <ul className="space-y-1 text-stone-600 list-disc list-inside">
                    <li><strong className="text-stone-800">생물학적:</strong> 병원성 미생물(식중독균, 곰팡이 등)</li>
                    <li><strong className="text-stone-800">화학적:</strong> 세척제 잔류, 윤활유 혼입, 소독수 등</li>
                    <li><strong className="text-stone-800">물리적:</strong> 금속, 유리, 돌, 비닐 등 이물 혼입</li>
                  </ul>
                </div>
                <div className="bg-white/80 p-3.5 rounded-lg border border-amber-100">
                  <h4 className="font-bold text-emerald-800 mb-1.5 flex items-center gap-1">
                    <span>2. CCP와 한계기준</span>
                  </h4>
                  <p className="text-stone-600 leading-relaxed">
                    중요관리점(CCP)은 위해요소를 제거하거나 감소시켜 가식 안전성을 보장하는 핵심 공정입니다. 
                    <strong className="text-stone-800"> 한계기준(CL)</strong>은 위해 관리가 철저히 보장되는 과학적 최대·최소 기준 수치(예: 살균 온도/시간)입니다.
                  </p>
                </div>
                <div className="bg-white/80 p-3.5 rounded-lg border border-amber-100">
                  <h4 className="font-bold text-emerald-800 mb-1.5 flex items-center gap-1">
                    <span>3. 이상 발생 및 기록</span>
                  </h4>
                  <p className="text-stone-600 leading-relaxed">
                    이탈 즉시 상부에 보고하여 조치를 시행하고 전수 기록해야 합니다. 
                    기록은 <strong className="text-stone-800">즉시 수기/전자 입력</strong>되어야 하며, 허위 기록이나 추정 수치 대입은 금지됩니다.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ----------------- TAB: HISTORY VIEW / ADMIN DASHBOARD ----------------- */}
        {isAdminMode ? (
          <div className="space-y-6 animate-fadeIn">
            {/* 1. Admin Header */}
            <div className="bg-stone-900 text-white rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-md">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-emerald-800 rounded-xl text-white">
                    <Shield size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="font-serif font-bold text-xl md:text-2xl tracking-tight">HACCP 내부평가 관리자 시스템</h1>
                      <span className="text-[10px] bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-sans font-bold">
                        주관: 품질보증팀
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-1 font-sans">국순당 횡성양조장 품질보증팀 주관 임직원 HACCP 내부평가 응시 결과 및 통계 관리 화면입니다.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAdminMode(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 self-start md:self-center"
                >
                  <ChevronLeft size={14} />
                  관리자 모드 종료
                </button>
              </div>
            </div>

            {firebaseError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-950 text-xs md:text-sm leading-relaxed space-y-2">
                <div className="flex items-center gap-2 font-bold text-red-850">
                  <AlertTriangle size={18} className="text-red-600 shrink-0" />
                  <span>실시간 데이터베이스 연동 오류 (해결 조치 필요)</span>
                </div>
                <p>
                  현재 Firebase Firestore 데이터베이스 연결 또는 권한에 문제가 있어, 다른 기기(모바일 QR 등)에서 응시한 결과가 이 관리자 화면에 동기화되지 않고 있습니다. 
                  (현재 화면에는 임시로 로컬 브라우저 저장소 데이터만 표시됩니다.)
                </p>
                <div className="bg-white/80 p-3.5 rounded-xl border border-red-100 mt-2 space-y-1.5 text-stone-800 font-sans">
                  <p className="font-bold text-stone-900">해결 방법 (간단한 2가지 확인 사항):</p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>
                      <strong className="text-emerald-800">Firestore Database 생성 여부 확인:</strong><br />
                      Firebase 콘솔(<a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline">https://console.firebase.google.com/</a>)에서 <strong className="text-stone-900">haccp-af46f</strong> 프로젝트를 선택하고, 좌측 메뉴에서 <strong className="text-stone-900">Build &gt; Firestore Database</strong>를 클릭한 후 데이터베이스가 생성되어 있는지 확인해 주세요. (생성되어 있지 않다면 "데이터베이스 만들기"를 클릭해 생성해야 합니다.)
                    </li>
                    <li>
                      <strong className="text-emerald-800">보안 규칙(Rules) 수정:</strong><br />
                      Firestore Database의 <strong className="text-stone-900">규칙(Rules)</strong> 탭으로 이동하여 기본 규칙을 아래와 같이 모든 읽기/쓰기가 가능하도록 수정하고 <strong className="text-stone-900">게시(Publish)</strong> 버튼을 눌러주세요:
                    </li>
                  </ol>
                  <pre className="bg-stone-900 text-stone-100 p-3 rounded-lg text-xs font-mono overflow-x-auto mt-2 select-all leading-normal">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
                  </pre>
                </div>
              </div>
            )}

            {/* Reexam Approval Toast Notification */}
            {reexamApprovalToast && (
              <div className="bg-[#0F5A3E] text-white px-4 py-3 rounded-2xl flex items-center justify-between shadow-md text-xs font-bold animate-in fade-in duration-200">
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-300" />
                  {reexamApprovalToast}
                </span>
                <button 
                  onClick={() => setReexamApprovalToast(null)} 
                  className="text-white/80 hover:text-white cursor-pointer p-1"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Pending Reexam Notification Banner */}
            {(() => {
              const pendingCount = examHistory.filter(r => r.score < passingScoreThreshold && !r.reexamApproved).length;
              if (pendingCount > 0 && statusFilter !== 'reexam_pending') {
                return (
                  <div className="bg-amber-50/90 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0">
                        <Clock3 size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-amber-900">
                          재시험(재평가) 승인 대기 응시자 <span className="underline decoration-amber-500 font-mono text-amber-800 text-sm">{pendingCount}명</span>
                        </div>
                        <div className="text-[11px] text-amber-700">
                          HACCP 평가 규정상 70점 미만 응시자는 품질보증팀의 사전 승인 후에만 재평가를 치를 수 있습니다.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setStatusFilter('reexam_pending')}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 shadow-2xs"
                    >
                      대기자 목록 및 승인하기
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            {/* 2. Admin Stats Grid */}
            {(() => {
              const yearsSet = new Set<number>();
              examHistory.forEach(r => {
                const y = r.year || (r.date ? parseInt(r.date.split('-')[0], 10) : new Date().getFullYear());
                if (!isNaN(y)) yearsSet.add(y);
              });
              yearsSet.add(new Date().getFullYear());
              const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

              const yearFilteredHistory = examHistory.filter(record => {
                const recordYear = record.year || (record.date ? parseInt(record.date.split('-')[0], 10) : new Date().getFullYear());
                return yearFilter === 'all' ? true : recordYear === parseInt(yearFilter, 10);
              });

              const total = yearFilteredHistory.length;
              const passed = yearFilteredHistory.filter(r => r.score >= 70).length;
              const reexam = yearFilteredHistory.filter(r => r.score >= 50 && r.score < 70).length;
              const retrain = yearFilteredHistory.filter(r => r.score < 50).length;
              const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
              const average = total > 0 
                ? Math.round((yearFilteredHistory.reduce((acc, r) => acc + r.score, 0) / total) * 10) / 10 
                : 0;

              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-xs text-stone-400 block font-sans font-medium">총 응시 건수 {yearFilter !== 'all' ? `(${yearFilter}년도)` : ''}</span>
                      <span className="text-2xl font-mono font-bold text-stone-800 block mt-1">{total}건</span>
                    </div>
                    <div className="p-3 bg-stone-50 rounded-xl text-stone-500">
                      <User size={20} />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-xs text-stone-400 block font-sans font-medium">평가 평균 점수</span>
                      <span className="text-2xl font-mono font-bold text-stone-800 block mt-1">{average}점</span>
                    </div>
                    <div className="p-3 bg-stone-50 rounded-xl text-stone-500">
                      <Award size={20} />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-xs text-stone-400 block font-sans font-medium">최종 합격률</span>
                      <span className={`text-2xl font-mono font-bold block mt-1 ${passRate >= 70 ? 'text-emerald-700' : 'text-amber-700'}`}>{passRate}%</span>
                    </div>
                    <div className="p-3 bg-stone-50 rounded-xl text-stone-500">
                      <TrendingUp size={20} />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
                    <span className="text-xs text-stone-400 block font-sans font-medium mb-1">결과 판정 분포</span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] font-bold bg-emerald-55 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-full">
                        합격: {passed}
                      </span>
                      <span className="text-[10px] font-bold bg-amber-55 text-amber-800 border border-amber-100 px-2 py-0.5 rounded-full">
                        재평가: {reexam}
                      </span>
                      <span className="text-[10px] font-bold bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full">
                        재교육+재평가: {retrain}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 3. Search & Control Bar */}
            {(() => {
              const yearsSet = new Set<number>();
              examHistory.forEach(r => {
                const y = r.year || (r.date ? parseInt(r.date.split('-')[0], 10) : new Date().getFullYear());
                if (!isNaN(y)) yearsSet.add(y);
              });
              yearsSet.add(new Date().getFullYear());
              const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

              return (
                <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 flex flex-col sm:flex-row gap-2.5">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                          <Search size={16} />
                        </span>
                        <input
                          type="text"
                          placeholder="평가자 성명 또는 소속 부서 검색..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-250 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-800 focus:bg-white transition-all text-stone-800 placeholder-stone-400"
                        />
                      </div>

                      {/* Year Filter Dropdown */}
                      <select
                        value={yearFilter}
                        onChange={e => setYearFilter(e.target.value)}
                        className="px-3 py-2 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-800 cursor-pointer"
                      >
                        <option value="all">📅 전체 연도 (통합)</option>
                        {availableYears.map(year => (
                          <option key={year} value={year.toString()}>{year}년도 평가</option>
                        ))}
                      </select>

                      <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="px-3 py-2 bg-stone-50 border border-stone-250 rounded-xl text-xs text-stone-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-800 focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="all">전체 평가 판정 결과</option>
                        <option value="passed">합격 (70점 이상)</option>
                        <option value="reexam">재평가 대상 (50점 ~ 69점)</option>
                        <option value="retrain">재교육+재평가 대상 (50점 미만)</option>
                        <option value="reexam_pending">⏳ 재시험 승인 대기자 ({examHistory.filter(r => r.score < passingScoreThreshold && !r.reexamApproved).length}명)</option>
                        <option value="reexam_approved">✅ 재시험 승인 완료자 ({examHistory.filter(r => r.score < passingScoreThreshold && r.reexamApproved).length}명)</option>
                      </select>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setExamPaperYear(yearFilter === 'all' ? new Date().getFullYear().toString() : yearFilter);
                          setShowExamPaperModal(true);
                        }}
                        className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        title="해당 연도의 시험지 인쇄 및 파일 저장"
                      >
                        <Printer size={14} />
                        시험지 출력 / 파일 저장
                      </button>

                      <button
                        onClick={() => {
                          setQrUrl(getPublicShareUrl());
                          setShowQrModal(true);
                        }}
                        className="px-4 py-2 bg-[#0F5A3E] hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        title="임직원 스마트폰 카메라 응시용 공개 QR코드 열기"
                      >
                        <QrCode size={14} />
                        모바일 응시 QR코드
                      </button>

                      <button
                        onClick={downloadExcelReport}
                        className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <FileSpreadsheet size={14} />
                        Excel 내보내기 (.csv)
                      </button>
                      
                      <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-250 rounded-xl px-2.5 py-1">
                        <span className="text-[11px] text-stone-500 font-sans font-medium">더미 생성:</span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={dummyCountInput}
                          onChange={e => setDummyCountInput(e.target.value)}
                          className="w-10 text-[11px] font-mono font-bold bg-transparent text-center border-b border-stone-300 focus:outline-hidden text-stone-800"
                        />
                        <button
                          onClick={() => {
                            const count = parseInt(dummyCountInput, 10);
                            if (isNaN(count) || count <= 0) {
                              showAdminToast("올바른 개수를 입력하세요.", "error");
                              return;
                            }
                            handleAddSampleDataOfCount(count);
                          }}
                          className="px-2 py-0.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-[11px] font-bold rounded-md cursor-pointer"
                        >
                          생성
                        </button>
                      </div>

                      <button
                        onClick={handleClearHistory}
                        disabled={isClearingHistory}
                        className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
                        title="모든 응시자 시험 이력 영구 삭제 및 완전 초기화"
                      >
                        <Trash2 size={14} />
                        {isClearingHistory ? "초기화 진행 중..." : "전체 이력 초기화"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 4. View Mode Toggle & Examinee List */}
            {(() => {
              const allPersonSummaries = groupExamsByPerson(examHistory);

              // 1) 인원별 필터링
              const filteredPersons = allPersonSummaries.filter(person => {
                const pName = (person.name || "").toLowerCase();
                const pDept = (person.dept || "").toLowerCase();
                const pIdNo = (person.idNo || "").toLowerCase();
                const sQuery = searchQuery.toLowerCase().trim();

                const matchesSearch = !sQuery || pName.includes(sQuery) || pDept.includes(sQuery) || pIdNo.includes(sQuery);
                  
                const matchesYear = 
                  yearFilter === 'all' ? true : person.year === parseInt(yearFilter, 10);
                  
                const matchesStatus = 
                  statusFilter === 'all' ? true :
                  statusFilter === 'passed' ? (person.finalStatus === '1st_passed' || person.finalStatus === '2nd_passed') :
                  statusFilter === 'reexam' ? (person.firstExam && person.firstExam.score >= 50 && person.firstExam.score < 70) :
                  statusFilter === 'retrain' ? (person.firstExam && person.firstExam.score < 50) :
                  statusFilter === 'reexam_pending' ? person.finalStatus === 'reexam_pending' :
                  statusFilter === 'reexam_approved' ? person.finalStatus === 'reexam_ready' : true;

                return matchesSearch && matchesYear && matchesStatus;
              });

              // 2) 시간순 개별 기록 필터링
              const filtered = examHistory.filter(record => {
                const recordYear = record.year || (record.date ? parseInt(record.date.split('-')[0], 10) : new Date().getFullYear());
                const rName = (record.name || "").toLowerCase();
                const rDept = (record.dept || "").toLowerCase();
                const rIdNo = (record.idNo || "").toLowerCase();
                const sQuery = searchQuery.toLowerCase().trim();

                const matchesSearch = !sQuery || rName.includes(sQuery) || rDept.includes(sQuery) || rIdNo.includes(sQuery);
                  
                const matchesStatus = 
                  statusFilter === 'all' ? true :
                  statusFilter === 'passed' ? record.score >= 70 :
                  statusFilter === 'reexam' ? record.score >= 50 && record.score < 70 :
                  statusFilter === 'retrain' ? record.score < 50 :
                  statusFilter === 'reexam_pending' ? record.score < passingScoreThreshold && !record.reexamApproved :
                  statusFilter === 'reexam_approved' ? record.score < passingScoreThreshold && !!record.reexamApproved : true;

                const matchesYear = 
                  yearFilter === 'all' ? true : recordYear === parseInt(yearFilter, 10);
                  
                return matchesSearch && matchesStatus && matchesYear;
              });

              return (
                <div className="space-y-4">
                  {/* View Mode Switching Tabs */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-100/80 p-2 rounded-2xl border border-stone-200">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setAdminViewMode('grouped')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                          adminViewMode === 'grouped'
                            ? 'bg-[#0F5A3E] text-white shadow-xs'
                            : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
                        }`}
                      >
                        <Users size={15} />
                        인원별 1차·2차 통합 분류 ({filteredPersons.length}명)
                      </button>
                      <button
                        onClick={() => setAdminViewMode('list')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                          adminViewMode === 'list'
                            ? 'bg-[#0F5A3E] text-white shadow-xs'
                            : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
                        }`}
                      >
                        <ListFilter size={15} />
                        전체 개별 내역 ({filtered.length}건)
                      </button>
                    </div>

                    <span className="text-[11px] text-stone-500 font-sans px-2">
                      {adminViewMode === 'grouped' 
                        ? '※ 동일 인원의 1차 시험 및 2차 재시험 결과를 분류하여 한눈에 확인합니다.' 
                        : '※ 개별 응시 기록을 시간순으로 나열합니다.'}
                    </span>
                  </div>

                  {/* Grouped View (인원별 1차·2차 통합) */}
                  {adminViewMode === 'grouped' && (
                    filteredPersons.length === 0 ? (
                      <div className="bg-white rounded-2xl p-12 text-center text-stone-400 border border-stone-200">
                        <Users className="mx-auto text-stone-300 mb-3" size={48} />
                        <p className="text-sm font-sans font-medium">
                          선택하신 조건에 일치하는 응시자 결과가 없습니다.
                        </p>
                        <p className="text-xs mt-1 font-sans">검색어나 필터 조건을 변경해보세요.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredPersons.map(person => {
                          const has1st = !!person.firstExam;
                          const has2nd = !!person.secondExam;
                          const firstScore = person.firstExam?.score ?? 0;
                          const firstPassed = firstScore >= passingScoreThreshold;

                          return (
                            <div 
                              key={person.personKey}
                              className={`bg-white rounded-2xl border overflow-hidden shadow-xs hover:shadow-sm transition-all ${
                                person.finalStatus === 'reexam_pending'
                                  ? 'border-amber-300'
                                  : person.finalStatus === 'reexam_ready'
                                    ? 'border-blue-300'
                                    : 'border-stone-200'
                              }`}
                            >
                              {/* Person Summary Top Header */}
                              <div className="p-4 md:p-5 bg-stone-50/70 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center flex-wrap gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold text-xs">
                                    {person.name.slice(0, 1)}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-base text-stone-900">{person.name}</span>
                                      <span className="text-xs font-semibold text-stone-600 bg-white px-2.5 py-0.5 rounded-full border border-stone-250">
                                        {person.dept}
                                      </span>
                                      <span className="text-[11px] font-mono text-stone-400">
                                        {person.idNo || '수험번호 자동배정'}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-stone-400 font-sans mt-0.5">
                                      평가 연도: {person.year}년도 | 최근 응시일: {person.latestDate}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5 flex-wrap">
                                  {/* Final Status Badge */}
                                  {person.finalStatus === '1st_passed' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs">
                                      <CheckCircle2 size={14} />
                                      1차 최종 합격 ({firstScore}점)
                                    </span>
                                  ) : person.finalStatus === '2nd_passed' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-xl text-xs font-bold shadow-2xs">
                                      <CheckCircle2 size={14} />
                                      2차 재시험 합격 ({person.secondExam?.score}점)
                                    </span>
                                  ) : person.finalStatus === '2nd_failed' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 border border-red-300 rounded-xl text-xs font-bold shadow-2xs">
                                      <AlertTriangle size={14} />
                                      2차 재시험 불합격 ({person.secondExam?.score}점)
                                    </span>
                                  ) : person.finalStatus === 'reexam_ready' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 border border-blue-300 rounded-xl text-xs font-bold shadow-2xs">
                                      <Check size={14} />
                                      재시험 승인 완료 (응시 대기)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold shadow-2xs">
                                      <Clock3 size={14} />
                                      품질보증팀 승인 대기
                                    </span>
                                  )}

                                  {/* Delete Person Entire Records Button */}
                                  <button
                                    onClick={() => handleDeletePersonRecords(person)}
                                    className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                                    title="해당 사원의 모든 시험 기록 삭제 및 초기화"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>

                              {/* 1st & 2nd Exam Comparison Panels */}
                              <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Panel A: 1차 평가 결과 */}
                                <div className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${
                                  has1st 
                                    ? firstPassed 
                                      ? 'bg-emerald-50/40 border-emerald-200' 
                                      : 'bg-amber-50/40 border-amber-200' 
                                    : 'bg-stone-50 border-stone-200'
                                }`}>
                                  <div>
                                    <div className="flex items-center justify-between pb-2 border-b border-stone-200/60 mb-2.5">
                                      <div className="flex items-center gap-1.5 font-bold text-xs text-stone-800">
                                        <FileText size={14} className="text-emerald-800" />
                                        <span>1차 정기 위생교육 평가</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {has1st && (
                                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                            firstPassed 
                                              ? 'bg-emerald-100 text-emerald-800' 
                                              : firstScore >= 50 
                                                ? 'bg-amber-100 text-amber-800' 
                                                : 'bg-red-100 text-red-800'
                                          }`}>
                                            {firstPassed ? '합격' : firstScore >= 50 ? '재평가 대상' : '재교육+재평가'}
                                          </span>
                                        )}
                                        {has1st && (
                                          <button
                                            onClick={() => handleDeleteSingleRecord(person.firstExam!)}
                                            className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                            title="1차 평가 기록만 삭제"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {has1st ? (
                                      <div className="space-y-1.5 text-xs text-stone-600">
                                        <div className="flex justify-between items-baseline">
                                          <span className="text-stone-500">평가 점수:</span>
                                          <span className="font-mono text-base font-bold text-stone-900">
                                            {person.firstExam?.score}점
                                            <span className="text-xs font-normal text-stone-500 ml-1">
                                              ({Math.round((person.firstExam?.score || 0) / 5)} / 20문항 정답)
                                            </span>
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] text-stone-500">
                                          <span>응시 일자:</span>
                                          <span>{person.firstExam?.date}</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="py-4 text-center text-xs text-stone-400">
                                        1차 응시 기록이 없습니다.
                                      </div>
                                    )}
                                  </div>

                                  {has1st && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedHistoryDetail(person.firstExam!)}
                                      className="w-full py-2 bg-stone-50 hover:bg-emerald-50 border border-stone-250 hover:border-emerald-300 text-stone-700 hover:text-emerald-900 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-98"
                                    >
                                      <FileCheck size={14} className="text-emerald-700" />
                                      1차 시험 OMR 답안 및 문항 확인
                                    </button>
                                  )}
                                </div>

                                {/* Panel B: 2차 재시험 상태 및 결과 */}
                                <div className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${
                                  has2nd 
                                    ? person.secondExam!.score >= passingScoreThreshold
                                      ? 'bg-indigo-50/40 border-indigo-200'
                                      : 'bg-red-50/40 border-red-200'
                                    : firstPassed
                                      ? 'bg-stone-50/50 border-stone-200'
                                      : person.isReexamApproved
                                        ? 'bg-blue-50/40 border-blue-200'
                                        : 'bg-amber-50/40 border-amber-200'
                                }`}>
                                  <div>
                                    <div className="flex items-center justify-between pb-2 border-b border-stone-200/60 mb-2.5">
                                      <div className="flex items-center gap-1.5 font-bold text-xs text-stone-800">
                                        <RotateCcw size={14} className="text-indigo-600" />
                                        <span>2차 HACCP 재시험</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {has2nd ? (
                                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                            person.secondExam!.score >= passingScoreThreshold
                                              ? 'bg-indigo-100 text-indigo-800'
                                              : 'bg-red-100 text-red-800'
                                          }`}>
                                            {person.secondExam!.score >= passingScoreThreshold ? '재시험 합격' : '재불합격'}
                                          </span>
                                        ) : firstPassed ? (
                                          <span className="text-[11px] font-medium text-stone-400">
                                            재시험 비해당
                                          </span>
                                        ) : (
                                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                            person.isReexamApproved 
                                              ? 'bg-blue-100 text-blue-800' 
                                              : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {person.isReexamApproved ? '승인 완료 (응시대기)' : '품질보증팀 미승인'}
                                          </span>
                                        )}
                                        {has2nd && (
                                          <button
                                            onClick={() => handleDeleteSingleRecord(person.secondExam!)}
                                            className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                            title="2차 재시험 기록만 삭제 (1차 대기 상태로 복원)"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {has2nd ? (
                                      <div className="space-y-1.5 text-xs text-stone-600">
                                        <div className="flex justify-between items-baseline">
                                          <span className="text-stone-500">재시험 점수:</span>
                                          <span className="font-mono text-base font-bold text-stone-900">
                                            {person.secondExam?.score}점
                                            <span className="text-xs font-normal text-stone-500 ml-1">
                                              ({Math.round((person.secondExam?.score || 0) / 5)} / 20문항 정답)
                                            </span>
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] text-stone-500">
                                          <span>재시험 일자:</span>
                                          <span>{person.secondExam?.date}</span>
                                        </div>
                                      </div>
                                    ) : firstPassed ? (
                                      <div className="py-4 text-center text-xs text-stone-400">
                                        1차 평가 기준을 충족하여 추가 재시험이 없습니다.
                                      </div>
                                    ) : (
                                      <div className="space-y-2 py-1">
                                        <p className="text-xs text-stone-600">
                                          {person.isReexamApproved 
                                            ? '품질보증팀 승인이 완료되었습니다. 응시자가 메인 화면에서 동일 이름으로 2차 재시험을 진행할 수 있습니다.' 
                                            : '1차 평가 미달 인원입니다. 재교육 확인 후 우측 버튼으로 재시험을 승인해 주십시오.'}
                                        </p>
                                        <div className="flex items-center gap-2">
                                          {person.firstExam && (
                                            <button
                                              disabled={approvalActionLoading === (person.firstExam.id || person.firstExam.idNo || person.name)}
                                              onClick={() => handleToggleReexamApproval(person.firstExam!)}
                                              className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                                person.isReexamApproved
                                                  ? 'bg-stone-200 hover:bg-red-50 text-stone-700 hover:text-red-600 border border-stone-300'
                                                  : 'bg-[#0F5A3E] hover:bg-emerald-800 text-white shadow-xs'
                                              }`}
                                            >
                                              {person.isReexamApproved ? (
                                                <>승인 취소하기</>
                                              ) : (
                                                <>
                                                  <CheckCircle2 size={14} />
                                                  품질보증팀 재시험 승인
                                                </>
                                              )}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {has2nd && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedHistoryDetail(person.secondExam!)}
                                      className="w-full py-2 bg-stone-50 hover:bg-indigo-50 border border-stone-250 hover:border-indigo-300 text-stone-700 hover:text-indigo-900 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-98"
                                    >
                                      <FileCheck size={14} className="text-indigo-600" />
                                      2차 재시험 OMR 답안 및 문항 확인
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* Chronological List View (전체 개별 내역) */}
                  {adminViewMode === 'list' && (
                    filtered.length === 0 ? (
                      <div className="bg-white rounded-2xl p-12 text-center text-stone-400 border border-stone-200">
                        <User className="mx-auto text-stone-300 mb-3" size={48} />
                        <p className="text-sm font-sans font-medium">
                          선택하신 조건({yearFilter !== 'all' ? `${yearFilter}년도` : '전체 연도'})에 만족하는 응시자 결과가 없습니다.
                        </p>
                        <p className="text-xs mt-1 font-sans">연도 필터나 검색어, 판정 결과를 변경해보세요.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                  {filtered.map((record, index) => {
                    const recordKey = record.id || record.idNo || `HS-${index}`;
                    const isExpanded = expandedRecords[recordKey];
                    const recordStatus = record.score >= 70 ? "passed" : record.score >= 50 ? "reexam" : "retrain";
                    const recYear = record.year || (record.date ? record.date.split('-')[0] : '2026');
                    const isTargetForReexam = record.score < passingScoreThreshold;
                    const isApproved = !!record.reexamApproved;
                    const actionTargetKey = record.id || record.idNo || record.name;

                    return (
                      <div 
                        key={recordKey}
                        className={`bg-white rounded-2xl border overflow-hidden shadow-xs hover:shadow-sm transition-all ${
                          isTargetForReexam && !isApproved 
                            ? 'border-amber-200/90' 
                            : 'border-stone-200'
                        }`}
                      >
                        {/* Summary Block */}
                        <div 
                          onClick={() => setExpandedRecords(prev => ({ ...prev, [recordKey]: !isExpanded }))}
                          className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-stone-50/50 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="font-bold text-sm text-stone-850">{record.name}</span>
                              <span className="text-xs text-stone-500">| {record.dept}</span>
                              <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-bold font-mono">
                                {recYear}년도
                              </span>
                              {record.isReexam && (
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md font-bold">
                                  2차 재시험
                                </span>
                              )}
                              <span className="text-[10px] text-stone-400 font-mono">({record.idNo || 'ID 없음'})</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-stone-450 font-sans">
                              <span>응시일: {record.date}</span>
                              {record.round && (
                                <span>차수: {record.round}차</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-5">
                            {/* Reexam Admin Approval Action Area */}
                            {isTargetForReexam ? (
                              <div 
                                className="flex items-center gap-1.5"
                                onClick={e => e.stopPropagation()}
                              >
                                {isApproved ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                      <UserCheck size={13} />
                                      재시험 승인됨
                                    </span>
                                    <button
                                      disabled={approvalActionLoading === actionTargetKey}
                                      onClick={() => handleToggleReexamApproval(record)}
                                      className="px-2.5 py-1 text-[11px] font-medium text-stone-500 hover:text-red-600 hover:bg-red-50 border border-stone-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                      title="재시험 승인 취소"
                                    >
                                      승인 취소
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                                      <Clock3 size={13} />
                                      승인 대기
                                    </span>
                                    <button
                                      disabled={approvalActionLoading === actionTargetKey}
                                      onClick={() => handleToggleReexamApproval(record)}
                                      className="px-3 py-1 text-[11px] font-bold bg-[#0F5A3E] hover:bg-emerald-800 text-white rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                      title="품질보증팀 재시험 승인"
                                    >
                                      <CheckCircle2 size={13} />
                                      재시험 승인
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-stone-400 font-sans hidden sm:inline-block">
                                합격 완료 (재시험 불필요)
                              </span>
                            )}

                            <div className="text-right shrink-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-lg font-mono font-bold text-stone-800">{record.score}점</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  recordStatus === 'passed' 
                                    ? 'bg-emerald-55 text-emerald-800 border border-emerald-100' 
                                    : recordStatus === 'reexam' 
                                      ? 'bg-amber-55 text-amber-800 border border-amber-100' 
                                      : 'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                  {recordStatus === 'passed' ? '합격' : recordStatus === 'reexam' ? '재평가' : '재교육+재평가'}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSingleRecord(record);
                              }}
                              className="p-1.5 text-stone-350 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="해당 응시자 기록 삭제 (새로 응시할 수 있도록 초기화)"
                            >
                              <Trash2 size={15} />
                            </button>
                            <div className={`p-1.5 rounded-lg text-stone-400 hover:text-stone-700 transition-colors ${isExpanded ? 'rotate-180' : ''}`}>
                              <ChevronDown size={18} className="transition-transform duration-200" />
                            </div>
                          </div>
                        </div>

                        {/* Detailed Dropdown Panel (각 문항별 정오답 여부) */}
                        {isExpanded && (
                          <div className="border-t border-stone-150 p-4 md:p-5 bg-stone-50/50 space-y-4">
                            {/* Reexam Status Detail Box */}
                            {isTargetForReexam && (
                              <div className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                isApproved 
                                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
                                  : 'bg-amber-50/70 border-amber-200 text-amber-900'
                              }`}>
                                <div className="flex items-center gap-2">
                                  {isApproved ? (
                                    <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                                  ) : (
                                    <Clock3 size={16} className="text-amber-700 shrink-0" />
                                  )}
                                  <div>
                                    <span className="font-bold">
                                      {isApproved ? '품질보증팀 재시험 승인 완료 상태' : '품질보증팀 재시험 승인 대기 상태'}
                                    </span>
                                    <span className="text-[11px] block text-stone-600">
                                      {isApproved 
                                        ? '품질보증팀 승인이 완료되어, 응시자는 시작 화면에서 즉시 재시험에 응시할 수 있습니다.' 
                                        : '응시자가 재시험을 치르려면 품질보증팀의 승인이 필요합니다.'}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  disabled={approvalActionLoading === actionTargetKey}
                                  onClick={() => handleToggleReexamApproval(record)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                    isApproved 
                                      ? 'bg-white border border-stone-300 text-stone-600 hover:bg-stone-100 hover:text-red-600' 
                                      : 'bg-[#0F5A3E] text-white hover:bg-emerald-800 shadow-2xs'
                                  }`}
                                >
                                  {isApproved ? '승인 취소하기' : '품질보증팀 승인하기'}
                                </button>
                              </div>
                            )}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                                <FileText size={14} className="text-emerald-800" />
                                <span>문항별 평가 결과 (정답 여부)</span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-stone-400 font-sans hidden lg:inline">※ 각 문항 아이콘을 클릭하면 세부 내용 및 정답/해설이 표시됩니다.</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedHistoryDetail(record)}
                                  className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-250 text-stone-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="해당 응시자의 전체 OMR 답안 및 20문항 상세 확인"
                                >
                                  <FileCheck size={13} className="text-emerald-700" />
                                  전체 OMR 답안 및 문항 상세 확인
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                              {haccpQuestions.map(q => {
                                const userAns = record.answers?.[q.id];
                                const isCorrect = userAns === q.correctAnswer;

                                return (
                                  <button
                                    key={q.id}
                                    onClick={() => setSelectedQuestionDetail({ question: q, userAns })}
                                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                      isCorrect 
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/80 shadow-2xs' 
                                        : 'bg-red-50 border-red-200 text-red-850 hover:bg-red-100/80 shadow-2xs'
                                    }`}
                                  >
                                    <span className="text-[10px] font-mono font-bold block mb-1">Q{q.id}</span>
                                    {isCorrect ? (
                                      <Check size={14} className="text-emerald-600 stroke-[3.5px]" />
                                    ) : (
                                      <X size={14} className="text-red-500 stroke-[3.5px]" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        );
      })()}
          </div>
        ) : (
          /* ----------------- TAB: EXAM CORE ----------------- */
          <>
            {/* 1. ONBOARDING SCREEN (BEFORE EXAM START) */}
            {!isExamStarted ? (
              <div className="no-print bg-white rounded-2xl shadow-sm border border-stone-200 max-w-xl mx-auto w-full overflow-hidden">
                <div className="bg-[#0F5A3E] px-6 py-8 text-center text-white relative">
                  <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />
                  <div 
                    onClick={handleKooksoondangClick}
                    className="select-none"
                  >
                    <KooksoondangLogo className="justify-center text-white mb-3 filter brightness-0 invert transition-opacity" />
                    <h1 className="font-serif font-bold text-2xl tracking-tight transition-colors">
                      국순당 횡성양조장
                    </h1>
                  </div>
                  <h2 className="font-serif text-lg text-emerald-100/90 mt-1">{new Date().getFullYear()}년도 HACCP 내부평가</h2>
                  <div className="mt-2.5 flex justify-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 border border-white/25 rounded-full text-xs font-semibold text-emerald-50 shadow-2xs">
                      <Shield size={13} className="text-emerald-300" />
                      주관 부서: 품질보증팀
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/80 mt-3 max-w-md mx-auto leading-relaxed">
                    본 평가는 국순당 횡성양조장 품질보증팀 주관으로 전 임직원의 위생 품질과 HACCP 관리 프로세스를 점검하기 위해 실시되는 내부 필수 평가입니다.
                  </p>
                </div>

                {myLocalExamRecord !== null ? (() => {
                  const latestRecord = examHistory.find(r => 
                    (myLocalExamRecord.id && r.id === myLocalExamRecord.id) ||
                    (myLocalExamRecord.idNo && r.idNo === myLocalExamRecord.idNo) ||
                    (r.name === myLocalExamRecord.name && r.dept === myLocalExamRecord.dept)
                  ) || myLocalExamRecord;

                  const isCandidatePassed = latestRecord.score >= passingScoreThreshold;
                  const isReexamApproved = !!latestRecord.reexamApproved;

                  return (
                    <div className="p-6 md:p-8 space-y-6">
                      {/* Status Banner */}
                      {isCandidatePassed ? (
                        <div className="bg-emerald-50 text-emerald-900 text-xs p-4 rounded-xl border border-emerald-200 flex items-start gap-3 leading-relaxed">
                          <CheckCircle2 className="text-emerald-700 shrink-0 mt-0.5" size={20} />
                          <div className="space-y-1">
                            <p className="font-bold text-emerald-950 text-sm">2026년도 HACCP 내부평가 최종 합격</p>
                            <p className="text-emerald-800">
                              귀하는 종합 점수 <strong className="font-bold text-emerald-950 font-mono">{latestRecord.score}점</strong>으로 합격 기준({passingScoreThreshold}점)을 충족하여 우수한 성적으로 평가를 완료하셨습니다.
                            </p>
                            <p className="text-emerald-700 text-[11px]">
                              ※ HACCP 내부 규정에 따라 합격자는 추가 재응시가 불필요합니다.
                            </p>
                          </div>
                        </div>
                      ) : isReexamApproved ? (
                        <div className="bg-emerald-50 text-emerald-900 text-xs p-4 rounded-xl border border-emerald-300 flex items-start gap-3 leading-relaxed shadow-2xs">
                          <CheckCircle2 className="text-emerald-700 shrink-0 mt-0.5" size={20} />
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-emerald-950 text-sm">품질보증팀 재시험 승인 완료</p>
                              <span className="px-2 py-0.5 bg-emerald-200/80 text-emerald-900 rounded-md font-bold text-[10px]">
                                재시험 가능
                              </span>
                            </div>
                            <p className="text-emerald-800 leading-normal">
                              품질보증팀의 재시험 승인이 완료되었습니다.
                            </p>
                            <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200 text-[11px] text-emerald-900 font-medium">
                              ※ 아래 [재시험 시작하기] 버튼을 눌러 평가를 진행해 주시기 바랍니다.
                            </div>
                          </div>
                        </div>
                      ) : latestRecord.score < 50 ? (
                        /* 50점 미만: 재교육 + 재평가 대상 */
                        <div className="bg-red-50 text-red-900 text-xs p-4 rounded-xl border border-red-200 flex items-start gap-3 leading-relaxed shadow-2xs">
                          <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-red-950 text-sm">
                                재교육 + 재평가 대상자 (품질보증팀 승인 대기)
                              </p>
                              <span className="px-2 py-0.5 bg-red-200/80 text-red-900 rounded-md font-bold text-[10px]">
                                재교육 및 승인 필요
                              </span>
                            </div>
                            <p className="text-red-800">
                              귀하는 1차 평가 점수 <strong className="font-bold text-red-950 font-mono">{latestRecord.score}점</strong>으로 <strong className="underline decoration-red-500">[재교육 + 재평가]</strong> 대상입니다.
                            </p>
                            <p className="text-red-800">
                              HACCP 사내 규정에 따라 <strong className="font-bold underline decoration-red-600">품질보증팀의 재교육을 이수</strong>하신 후 품질보증팀의 사전 승인이 완료되어야만 재평가에 응시하실 수 있습니다.
                            </p>
                            <p className="text-stone-500 text-[11px] pt-1">
                              품질보증팀에 재교육 이수 확인 및 승인을 요청해 주시기 바랍니다.
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* 70점 미만 (50점 이상): 재평가 대상 */
                        <div className="bg-amber-50 text-amber-900 text-xs p-4 rounded-xl border border-amber-200 flex items-start gap-3 leading-relaxed shadow-2xs">
                          <Clock3 className="text-amber-700 shrink-0 mt-0.5" size={20} />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-amber-950 text-sm">
                                재평가 대상자 (품질보증팀 승인 대기)
                              </p>
                              <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-md font-bold text-[10px]">
                                승인 필요
                              </span>
                            </div>
                            <p className="text-amber-800">
                              귀하는 1차 평가 점수 <strong className="font-bold text-amber-950 font-mono">{latestRecord.score}점</strong>으로 <strong className="underline decoration-amber-600">[재평가]</strong> 대상입니다.
                            </p>
                            <p className="text-amber-800">
                              HACCP 사내 규정에 따라 <strong className="font-bold underline decoration-amber-600">품질보증팀의 사전 승인</strong>이 완료되어야만 재평가에 응시하실 수 있습니다.
                            </p>
                            <p className="text-stone-500 text-[11px] pt-1">
                              품질보증팀에 승인을 요청하신 뒤, 승인이 완료되면 본 화면에서 재평가를 시작하실 수 있습니다.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Reexam Start Button / Refresh Button */}
                      {!isCandidatePassed && (
                        <div>
                          {isReexamApproved ? (
                            <div className="space-y-3">
                              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-900">
                                <Clock size={16} className="text-amber-700 shrink-0" />
                                <div className="leading-tight">
                                  <span className="font-bold">재시험 시간(30분):</span> 재시험 또한 동일하게 30분의 제한 시간이 주어지며, 30분이 지나면 시험이 자동 종료됩니다.
                                </div>
                              </div>
                              <button
                                onClick={handleStartReexam}
                                className="w-full py-3.5 bg-[#0F5A3E] hover:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <FileCheck size={18} />
                                {new Date().getFullYear()}년도 HACCP 재시험 시작하기
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <button
                                disabled
                                className="w-full py-3 bg-stone-200 text-stone-400 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
                              >
                                <Clock3 size={15} />
                                품질보증팀 승인 후 재시험 응시 가능
                              </button>
                              <button
                                onClick={async () => {
                                  const refreshed = await fetchExamHistoryOnce();
                                  const updatedRec = refreshed.find(r => 
                                    (examinee.idNo && r.idNo === examinee.idNo) ||
                                    (examinee.name && r.name === examinee.name && examinee.dept && r.dept === examinee.dept)
                                  ) || latestRecord;

                                  if (updatedRec?.reexamApproved) {
                                    alert("품질보증팀 재시험 승인이 완료되었습니다! 즉시 재시험을 시작할 수 있습니다.");
                                  } else {
                                    alert("현재 품질보증팀 승인 대기 중입니다. 품질보증팀에 승인을 요청해 주세요.");
                                  }
                                }}
                                className="w-full py-2 bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-250 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Clock3 size={14} className="text-stone-500" />
                                품질보증팀 승인 상태 새로고침 / 확인
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Candidate Record Card */}
                      <div className="border border-stone-200 rounded-xl p-5 bg-stone-50/50 space-y-3 relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 w-28 h-28 border-4 border-double rounded-full opacity-10 flex items-center justify-center rotate-12">
                          <span className="font-bold text-lg font-sans">완료</span>
                        </div>
                        
                        <div className="flex items-center justify-between border-b border-stone-200 pb-2 mb-3">
                          <h3 className="font-semibold text-stone-800 text-sm font-sans">최종 응시 기록</h3>
                          {latestRecord.isReexam && (
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                              2차 재시험 기록
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs text-stone-600">
                          <div>
                            <span className="text-stone-400 block font-medium">성명</span>
                            <span className="font-semibold text-stone-800 text-sm">{latestRecord.name}</span>
                          </div>
                          <div>
                            <span className="text-stone-400 block font-medium">소속 부서 / 팀</span>
                            <span className="font-semibold text-stone-800 text-sm">{latestRecord.dept}</span>
                          </div>
                          <div>
                            <span className="text-stone-400 block font-medium">수험 번호</span>
                            <span className="font-mono text-stone-700">{latestRecord.idNo || 'HS-2026-7713'}</span>
                          </div>
                          <div>
                            <span className="text-stone-400 block font-medium">평가 완료일</span>
                            <span className="text-stone-700">{latestRecord.date}</span>
                          </div>
                          <div className="col-span-2 border-t border-stone-150 pt-2.5 mt-1 flex justify-between items-center">
                            <div>
                              <span className="text-stone-400 block font-medium">종합 평가 결과</span>
                              <span className={`text-lg font-bold ${latestRecord.score >= 70 ? 'text-emerald-800' : latestRecord.score >= 50 ? 'text-amber-700' : 'text-red-600'}`}>
                                {latestRecord.score}점 ({latestRecord.score >= 70 ? '합격' : latestRecord.score >= 50 ? '재평가 대상' : '재교육+재평가 대상'})
                              </span>
                              {!isCandidatePassed && (
                                <span className="block text-[11px] font-medium text-stone-500 mt-0.5">
                                  재시험 승인: <strong className={isReexamApproved ? 'text-emerald-700' : 'text-amber-700'}>{isReexamApproved ? '품질보증팀 승인 완료' : '품질보증팀 승인 대기'}</strong>
                                </span>
                              )}
                            </div>
                            
                            {/* Circle Stamp */}
                            <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full border-2 ${
                              latestRecord.score >= 70 
                                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/70' 
                                : latestRecord.score >= 50 
                                  ? 'border-amber-600 text-amber-700 bg-amber-50/70' 
                                  : 'border-red-600 text-red-700 bg-red-50/70'
                            } flex flex-col items-center justify-center font-bold rotate-12 shrink-0 shadow-xs p-1 border-dashed`}>
                              <span className="text-[7px] md:text-[8px] leading-none text-stone-500 font-sans">국순당</span>
                              {latestRecord.score >= 70 ? (
                                <span className="font-extrabold text-xs md:text-sm text-emerald-800 tracking-wider my-0.5">합 격</span>
                              ) : latestRecord.score >= 50 ? (
                                <span className="font-extrabold text-xs md:text-sm text-amber-700 tracking-wider my-0.5">재평가</span>
                              ) : (
                                <div className="flex flex-col items-center justify-center leading-none my-0.5">
                                  <span className="font-black text-[9px] md:text-[10px] text-red-700">재교육</span>
                                  <span className="font-black text-[8px] md:text-[9px] text-red-600 mt-0.5">+ 재평가</span>
                                </div>
                              )}
                              <span className="text-[6px] md:text-[7px] leading-none text-stone-400 font-sans">횡성양조장</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Security & Admin Notice Box */}
                      <div className="pt-3 border-t border-stone-200">
                        <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200 flex items-center gap-2.5 text-stone-600 text-xs">
                          <Shield size={16} className="text-[#0F5A3E] shrink-0" />
                          <p className="text-[11px] leading-relaxed">
                            ※ 시험 응시 기록 관리 및 이력 초기화는 사내 HACCP 평가 관리 규정에 따라 <strong className="text-stone-800 font-semibold">품질보증팀 관리자 승인</strong> 하에서만 처리 가능합니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <form onSubmit={handleStartExam} className="p-6 md:p-8 space-y-5">
                    <div className="bg-amber-50/80 rounded-xl p-4 border border-amber-100 text-xs text-stone-700 leading-relaxed flex items-start gap-2.5">
                      <Info className="text-amber-600 shrink-0 mt-0.5" size={16} />
                      <div className="space-y-1">
                        <p className="font-semibold text-stone-900">평가 안내 사항:</p>
                        <p>• 문항 수: 총 20문항 (객관식 5지선다형)</p>
                        <p>• 합격 기준: <strong className="text-emerald-800">70점 이상</strong> (14개 이상 정답)</p>
                        <p>• 평가 결과에 따른 후속 조치:</p>
                        <p className="pl-3 text-amber-700 font-medium">• 70점 미만: 재평가 실시</p>
                        <p className="pl-3 text-red-600 font-medium">• 50점 미만: 재교육 이수 및 재평가 실시</p>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-stone-600 mb-1">성명</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                            <User size={16} />
                          </span>
                          <input
                            type="text"
                            required
                            value={examinee.name}
                            onChange={e => setExaminee(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="성명을 입력해세요"
                            className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-250 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-800 focus:bg-white transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-600 mb-1">소속 부서 / 팀</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                            <GraduationCap size={16} />
                          </span>
                          <select
                            required
                            value={examinee.dept}
                            onChange={e => setExaminee(prev => ({ ...prev, dept: e.target.value }))}
                            className="w-full pl-9 pr-10 py-2.5 bg-stone-50 border border-stone-250 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-800 focus:bg-white transition-all appearance-none cursor-pointer text-stone-850"
                          >
                            <option value="" disabled>소속 팀을 선택해주세요</option>
                            <option value="양조1팀">양조1팀</option>
                            <option value="양조2팀">양조2팀</option>
                            <option value="생산지원팀">생산지원팀</option>
                            <option value="설비기술팀">설비기술팀</option>
                            <option value="품질보증팀">품질보증팀</option>
                            <option value="자연그대로">자연그대로</option>
                          </select>
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                            <ChevronDown size={16} />
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-stone-600 mb-1">수험번호 (자동발급)</label>
                          <input
                            type="text"
                            readOnly
                            value={examinee.idNo}
                            className="w-full px-3 py-2.5 bg-stone-100 border border-stone-200 rounded-xl text-sm text-stone-500 font-mono focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-600 mb-1 flex items-center justify-between">
                            <span>평가일</span>
                            <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-300">
                              당일 자동설정
                            </span>
                          </label>
                          <input
                            type="date"
                            readOnly
                            value={examinee.date || getTodayDateString()}
                            className="w-full px-3 py-2.5 bg-stone-100 border border-stone-200 rounded-xl text-sm text-stone-700 font-medium focus:outline-hidden cursor-not-allowed select-none"
                            title="평가일은 응시 당일로 자동 설정됩니다."
                          />
                        </div>
                      </div>
                    </div>

                    {startExamError && (
                      <div className="bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-100 font-medium animate-pulse text-center">
                        {startExamError}
                      </div>
                    )}

                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-900">
                      <Clock size={16} className="text-amber-700 shrink-0" />
                      <div className="leading-tight">
                        <span className="font-bold">시험 시간(30분):</span> 시험 시작 후 30분의 제한 시간이 적용되며, 30분이 지나면 시험이 자동으로 종료되고 안내 창이 나타납니다.
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-[#0F5A3E] hover:bg-emerald-800 text-white font-medium text-sm rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      <FileText size={18} />
                      HACCP 내부평가 시험 시작
                    </button>

                    <div className="pt-2.5 border-t border-stone-150 flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          setQrUrl(getPublicShareUrl());
                          setShowQrModal(true);
                        }}
                        className="flex items-center gap-1.5 text-xs text-[#0F5A3E] hover:text-emerald-900 font-semibold transition-all py-1.5 px-3.5 bg-emerald-50/70 hover:bg-emerald-50 rounded-lg cursor-pointer"
                      >
                        <QrCode size={14} />
                        모바일 시험 응시용 QR코드 열기
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* 2. LIVE EXAM CONTEXT */
              <div className="flex flex-col lg:flex-row gap-6 relative">
                
                {/* LEFT SIDE: THE EXAM CONTENT */}
                <div className="flex-1 flex flex-col gap-5">
                  
                  {/* MODE TOGGLER & TIMER BAR */}
                  <div className="no-print bg-white p-4 rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-lg">
                      <button
                        onClick={() => setQuizMode('paper')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                          quizMode === 'paper' 
                            ? 'bg-white text-stone-800 shadow-xs' 
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        <Layout size={14} />
                        시험지 전체보기
                      </button>
                      <button
                        onClick={() => setQuizMode('card')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                          quizMode === 'card' 
                            ? 'bg-white text-stone-800 shadow-xs' 
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        <Smartphone size={14} />
                        모바일 한문제씩 풀기
                      </button>
                    </div>

                    <div className="flex items-center gap-4">
                      {isSubmitted ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded-full">
                            제출완료
                          </span>
                          <button
                            onClick={handleExitExam}
                            className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Home size={13} />
                            처음 화면으로 이동
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center flex-wrap gap-2 text-stone-700">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 border border-stone-250 rounded-lg text-xs font-medium">
                            <Clock className={`size-3.5 ${secondsElapsed >= 1500 ? 'text-red-600 animate-pulse' : 'text-emerald-800'}`} />
                            <span className="text-stone-500">제한시간:</span>
                            <span className="font-bold font-mono text-stone-800">30분</span>
                          </div>
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs ${
                            secondsElapsed >= 1500 
                              ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' 
                              : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                          }`}>
                            <span className="text-[11px] font-medium">남은 시간:</span>
                            <span className="font-mono text-sm">{formatTime(Math.max(0, EXAM_TIME_LIMIT_SECONDS - secondsElapsed))}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RE-EXAM MODE INDICATOR BANNER */}
                  {isReexamMode && (
                    <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2 font-bold">
                        <CheckCircle2 size={15} className="text-indigo-600 shrink-0" />
                        <span>[2차 재시험 진행 중] 품질보증팀 승인 완료 — 2차 재시험에 응시합니다.</span>
                      </div>
                      <span className="text-[10px] bg-indigo-200/70 text-indigo-900 px-2 py-0.5 rounded font-mono font-bold shrink-0">
                        2차 재시험
                      </span>
                    </div>
                  )}

                  {/* SUBMISSION RESULT HEADER BANNER (IF SUBMITTED) */}
                  {isSubmitted && (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white rounded-2xl border-2 border-stone-200 overflow-hidden shadow-md"
                    >
                      <div className={`p-6 text-center ${isPassed ? 'bg-emerald-50/50' : 'bg-orange-50/40'} border-b border-stone-150 relative`}>
                        {/* Stamp Overlay */}
                        <div className="absolute right-4 top-4 md:right-12 md:top-8 rotate-12 select-none pointer-events-none">
                          <div className={`w-28 h-28 md:w-32 md:h-32 rounded-full border-4 ${
                            finalScore >= 70 
                              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/80' 
                              : finalScore >= 50 
                                ? 'border-amber-600 text-amber-700 bg-amber-50/80' 
                                : 'border-red-600 text-red-700 bg-red-50/80'
                          } flex flex-col items-center justify-center font-bold text-center border-dashed p-1 shadow-sm`}>
                            <span className="text-[10px] md:text-xs leading-none font-sans font-semibold">국순당</span>
                            {finalScore >= 70 ? (
                              <span className="text-base md:text-lg font-extrabold tracking-widest my-1 font-sans text-emerald-800">
                                합 격
                              </span>
                            ) : finalScore >= 50 ? (
                              <span className="text-base md:text-lg font-extrabold tracking-wider my-1 font-sans text-amber-700">
                                재평가
                              </span>
                            ) : (
                              <div className="flex flex-col items-center justify-center leading-tight my-0.5">
                                <span className="text-xs md:text-sm font-black tracking-tight text-red-700">
                                  재교육
                                </span>
                                <span className="text-[11px] md:text-xs font-black tracking-tight text-red-600">
                                  + 재평가
                                </span>
                              </div>
                            )}
                            <span className="text-[9px] md:text-[10px] leading-none font-sans font-medium">횡성양조장</span>
                          </div>
                        </div>

                        <div className="max-w-md mx-auto">
                          <Award className={`mx-auto mb-2 ${isPassed ? 'text-emerald-700' : 'text-amber-600'}`} size={44} />
                          <h2 className="text-xl font-serif font-bold text-stone-900">
                            {isReexamMode ? "2차 재시험 채점 결과 리포트" : "채점 결과 리포트"}
                          </h2>
                          <p className="text-xs text-stone-500 mt-1">
                            {isReexamMode ? "제출하신 2차 재시험 답안지가 정상 채점되었습니다." : "수고하셨습니다! 제출하신 HACCP 답안지가 정상 채점되었습니다."}
                          </p>
                          
                          <div className="grid grid-cols-3 gap-3 my-6 bg-white rounded-xl p-4 border border-stone-200">
                            <div>
                              <span className="text-[10px] font-bold text-stone-400 block uppercase">종합 점수</span>
                              <span className={`text-2xl font-mono font-black ${isPassed ? 'text-emerald-800' : finalScore >= 50 ? 'text-amber-700' : 'text-red-600'}`}>{finalScore}점</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-stone-400 block uppercase">정답 개수</span>
                              <span className="text-xl font-mono font-bold text-stone-700">{correctCount} / 20개</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-stone-400 block uppercase">응시 시간</span>
                              <span className="text-xl font-mono font-bold text-stone-700">{formatTime(secondsElapsed)}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-3">
                            {isPassed ? (
                              <div className="space-y-3 w-full">
                                <p className="text-sm text-emerald-800 font-semibold flex items-center justify-center gap-1.5 bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                                  <Check size={18} className="text-emerald-700" />
                                  <span>축하합니다! 합격 기준({passingScoreThreshold}점)을 충족하여 평가를 무사히 통과하였습니다.</span>
                                </p>
                                <div className="flex justify-center gap-2">
                                  <button
                                    onClick={handleExitExam}
                                    className="px-6 py-2.5 bg-[#0F5A3E] text-white hover:bg-emerald-800 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                                  >
                                    확인 및 처음으로
                                  </button>
                                </div>
                              </div>
                            ) : finalScore < 50 ? (
                              /* 50점 미만: 재교육 + 재평가 대상 (빨간색 테마) */
                              <div className="space-y-3 w-full">
                                <div className="text-xs text-red-700 flex flex-col items-center justify-center gap-1.5 font-medium bg-red-50 p-4 rounded-xl border border-red-200 leading-relaxed shadow-2xs">
                                  <span className="flex items-center gap-1.5 text-sm font-bold text-red-800">
                                    <AlertTriangle size={18} className="text-red-600 shrink-0" />
                                    <span>HACCP 재교육 + 재평가 대상 (50점 미만)</span>
                                  </span>
                                  <span className="text-center mt-1 max-w-lg text-red-900 leading-normal">
                                    {isReexamMode 
                                      ? `2차 재시험에서도 기준 점수(${passingScoreThreshold}점)에 도달하지 못했습니다. 품질보증팀의 별도 심층 교육 및 지도 지침에 따라 주시기 바랍니다.`
                                      : `귀하의 취득 점수는 ${finalScore}점으로, 50점 미만 [재교육 + 재평가] 대상입니다. 사내 HACCP 평가 규정에 따라 품질보증팀의 재교육을 이수하신 후 품질보증팀의 승인을 받아 재평가에 응시하실 수 있습니다.`}
                                  </span>
                                </div>
                                <div className="flex justify-center gap-2">
                                  <button
                                    onClick={handleExitExam}
                                    className="px-6 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                                  >
                                    확인 및 처음으로
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* 70점 미만 (50점 이상): 재평가 대상 (주황색/앰버 테마) */
                              <div className="space-y-3 w-full">
                                <div className="text-xs text-amber-900 flex flex-col items-center justify-center gap-1.5 font-medium bg-amber-50 p-4 rounded-xl border border-amber-200 leading-relaxed shadow-2xs">
                                  <span className="flex items-center gap-1.5 text-sm font-bold text-amber-950">
                                    <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                                    <span>HACCP 재평가 대상 (70점 미만)</span>
                                  </span>
                                  <span className="text-center mt-1 max-w-lg text-amber-900 leading-normal">
                                    {isReexamMode 
                                      ? `2차 재시험에서도 기준 점수(${passingScoreThreshold}점)에 도달하지 못했습니다. 품질보증팀의 별도 교육 및 지도 지침에 따라 주시기 바랍니다.`
                                      : `귀하의 취득 점수는 ${finalScore}점으로, 합격 기준(${passingScoreThreshold}점) 미만 [재평가] 대상입니다. 사내 HACCP 평가 규정에 따라 품질보증팀의 승인을 받으신 후 재평가에 응시하실 수 있습니다.`}
                                  </span>
                                </div>
                                <div className="flex justify-center gap-2">
                                  <button
                                    onClick={handleExitExam}
                                    className="px-6 py-2.5 bg-stone-700 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                                  >
                                    확인 및 처음으로
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* --- MODE 1: CLASSIC TEST PAPER VIEW (시험지 형식) --- */}
                  {quizMode === 'paper' ? (
                    <div className="test-paper-bg border border-stone-250 p-6 md:p-12 rounded-3xl relative overflow-hidden">
                      {/* Watermark Logo inside Paper */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] select-none rotate-12">
                        <div className="font-serif font-bold text-9xl">국순당</div>
                      </div>

                      {/* Header Section of the Traditional Paper */}
                      <div className="border-4 border-double border-[#0F5A3E] p-4 text-center relative mb-8">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b-2 border-stone-350 pb-4 mb-4">
                          <KooksoondangLogo />
                          <div className="text-center font-serif">
                            <span className="text-[11px] tracking-widest text-stone-400 block font-sans">2026년도</span>
                            <h2 className="text-xl md:text-2xl font-bold text-stone-900 tracking-tight">HACCP 내부평가</h2>
                          </div>
                          <div className="w-10 h-10 hidden md:block" /> {/* spacer for balance */}
                        </div>

                        {/* Candidate Info Table inside the test paper */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-sans">
                          <div className="text-left text-stone-500">
                            ※ 각 문항을 읽고, 해당 답안 번호에 <strong className="text-stone-700">체크(V)</strong> 또는 우측 <strong className="text-stone-700">OMR 카드</strong>를 완성한 후 최종 제출해 주십시오.
                          </div>
                          
                          <table className="border-collapse border border-stone-450 text-center w-full md:w-auto shrink-0 bg-white">
                            <tbody>
                              <tr>
                                <td className="border border-stone-450 bg-stone-50 px-3 py-1 font-semibold text-stone-600">소 속</td>
                                <td className="border border-stone-450 px-4 py-1 text-stone-800 min-w-24 font-medium">{examinee.dept}</td>
                                <td className="border border-stone-450 bg-stone-50 px-3 py-1 font-semibold text-stone-600">성 명</td>
                                <td className="border border-stone-450 px-4 py-1 text-[#0F5A3E] font-bold min-w-24">{examinee.name}</td>
                              </tr>
                              <tr>
                                <td className="border border-stone-450 bg-stone-50 px-3 py-1 font-semibold text-stone-600">수험번호</td>
                                <td className="border border-stone-450 px-4 py-1 text-stone-500 font-mono text-[11px]">{examinee.idNo}</td>
                                <td className="border border-stone-450 bg-stone-50 px-3 py-1 font-semibold text-stone-600">평가일</td>
                                <td className="border border-stone-450 px-4 py-1 text-stone-500">{examinee.date}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Double ruled divider */}
                      <div className="border-b-4 border-double border-stone-350 my-6" />

                      {/* QUESTIONS LIST */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                        {shuffledQuestions.map((q, idx) => {
                          const isCorrect = answers[q.id] === q.correctAnswer;
                          const hasAnswered = answers[q.id] !== undefined;

                          return (
                            <div 
                              key={q.id} 
                              id={`q-paper-${q.id}`} 
                              className={`scroll-mt-24 p-4 rounded-xl transition-all ${
                                isSubmitted 
                                  ? isCorrect 
                                    ? 'bg-emerald-50/40 border border-emerald-150' 
                                    : 'bg-red-50/40 border border-red-150'
                                  : 'hover:bg-stone-50/50 border border-transparent'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                {/* Question Title */}
                                <div className="font-serif font-bold text-stone-900 text-sm md:text-base whitespace-nowrap pt-0.5">
                                  {idx + 1}.
                                </div>
                                <div className="space-y-2 w-full">
                                  <h3 className="font-serif font-bold text-stone-900 text-sm md:text-base leading-relaxed whitespace-pre-line">
                                    {q.text}
                                    <span className="text-stone-400 ml-1 font-sans text-xs">
                                      {answers[q.id] ? `( ${answers[q.id]} )` : '(  )'}
                                    </span>
                                  </h3>

                                  {/* Optional context box (Q7 or Q20) */}
                                  {q.context && (
                                    <div className="bg-[#FFFDF3] border-l-3 border-amber-500 p-3 text-xs text-stone-700 rounded-r-lg my-2 font-serif leading-relaxed italic whitespace-pre-wrap">
                                      {q.context}
                                    </div>
                                  )}

                                  {/* Options rendering */}
                                  <div className="space-y-1.5 mt-3 text-xs md:text-sm font-sans">
                                    {q.options.map((option, oIdx) => {
                                      const oNum = oIdx + 1;
                                      const isSelected = answers[q.id] === oNum;
                                      
                                      // Traditional markings: checkmark or cross on correct/incorrect
                                      const isCorrectOption = q.correctAnswer === oNum;
                                      const wasIncorrectlySelected = isSelected && !isCorrectOption;

                                      return (
                                        <button
                                          key={oIdx}
                                          disabled={isSubmitted}
                                          onClick={() => handleSelectAnswer(q.id, oNum)}
                                          className={`w-full text-left p-2 rounded-lg flex items-start gap-2.5 transition-all group ${
                                            isSubmitted 
                                              ? isCorrectOption
                                                ? 'bg-emerald-100/60 font-semibold text-emerald-900 border border-emerald-200'
                                                : wasIncorrectlySelected
                                                  ? 'bg-red-100/60 text-red-900 border border-red-200'
                                                  : 'text-stone-400'
                                              : isSelected
                                                ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 font-medium'
                                                : 'hover:bg-stone-100/80 text-stone-600'
                                          }`}
                                        >
                                          {/* Traditional Styled Numbers ① ② ③ ④ ⑤ */}
                                          <span className={`inline-flex shrink-0 w-5 h-5 items-center justify-center rounded-full text-xs transition-colors ${
                                            isSubmitted
                                              ? isCorrectOption
                                                ? 'bg-emerald-700 text-white'
                                                : wasIncorrectlySelected
                                                  ? 'bg-red-600 text-white'
                                                  : 'bg-stone-200 text-stone-400'
                                              : isSelected
                                                ? 'bg-[#0F5A3E] text-white'
                                                : 'bg-stone-100 text-stone-500 group-hover:bg-stone-200 group-hover:text-stone-700'
                                          }`}>
                                            {oNum}
                                          </span>
                                          <span className="leading-relaxed">{option}</span>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Explanation block (visible after submission) */}
                                  {isSubmitted && (
                                    <div className="mt-4 pt-3 border-t border-dashed border-stone-200">
                                      <div className={`text-xs p-3 rounded-lg leading-relaxed ${isCorrect ? 'bg-emerald-50/50 text-emerald-900' : 'bg-red-50/50 text-stone-800'}`}>
                                        <div className="flex items-center gap-1.5 font-bold mb-1">
                                          {isCorrect ? (
                                            <span className="text-emerald-700 flex items-center gap-0.5">
                                              <Check size={14} /> 정답입니다!
                                            </span>
                                          ) : (
                                            <span className="text-red-700 flex items-center gap-0.5">
                                              <X size={14} /> 오답 (정답: {q.correctAnswer}번)
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-stone-600 font-sans"><strong className="text-stone-800">해설:</strong> {q.explanation}</p>
                                      </div>
                                    </div>
                                  )}

                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer signatures */}
                      <div className="mt-16 text-center border-t-2 border-stone-300 pt-8 flex flex-col items-center">
                        <div className="flex items-center gap-1">
                          <KooksoondangLogo className="scale-90" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* --- MODE 2: RESPONSIVE STEP CARD VIEW (한문제씩 풀기) --- */
                    <div className="bg-white rounded-2xl border border-stone-200 p-6 md:p-8 flex flex-col min-h-[400px]">
                      
                      {/* Active Card Index and Progress Indicator */}
                      <div className="flex items-center justify-between mb-6">
                        <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full">
                          문제 {currentCardIndex + 1} / 20
                        </span>
                        
                        <div className="w-1/2 bg-stone-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-[#0F5A3E] h-full transition-all duration-300"
                            style={{ width: `${((currentCardIndex + 1) / 20) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Render Current Single Question Card */}
                      {(() => {
                        const q = shuffledQuestions[currentCardIndex];
                        const isCorrect = answers[q.id] === q.correctAnswer;
                        const hasAnswered = answers[q.id] !== undefined;

                        return (
                          <div className="flex-1 flex flex-col">
                            <h3 className="font-serif font-bold text-stone-900 text-base md:text-lg leading-relaxed mb-3 whitespace-pre-line">
                              {currentCardIndex + 1}. {q.text}
                            </h3>

                            {/* Context Situation */}
                            {q.context && (
                              <div className="bg-[#FFFDF3] border-l-4 border-amber-500 p-4 text-xs md:text-sm text-stone-700 rounded-r-xl my-3 font-serif leading-relaxed italic whitespace-pre-wrap">
                                {q.context}
                              </div>
                            )}

                            {/* Step options */}
                            <div className="space-y-2 my-4">
                              {q.options.map((option, oIdx) => {
                                const oNum = oIdx + 1;
                                const isSelected = answers[q.id] === oNum;
                                const isCorrectOption = q.correctAnswer === oNum;
                                const wasIncorrectlySelected = isSelected && !isCorrectOption;

                                return (
                                  <button
                                    key={oIdx}
                                    disabled={isSubmitted}
                                    onClick={() => handleSelectAnswer(q.id, oNum)}
                                    className={`w-full text-left p-3.5 rounded-xl border flex items-center gap-3.5 transition-all group ${
                                      isSubmitted
                                        ? isCorrectOption
                                          ? 'bg-emerald-100/60 font-semibold text-emerald-900 border-emerald-300'
                                          : wasIncorrectlySelected
                                            ? 'bg-red-100/60 text-red-900 border-red-300'
                                            : 'text-stone-400 border-stone-200'
                                        : isSelected
                                          ? 'bg-emerald-50 border-emerald-400 text-[#0F5A3E] font-semibold'
                                          : 'bg-stone-50 border-stone-200 hover:bg-stone-100 text-stone-600'
                                    }`}
                                  >
                                    <span className={`inline-flex shrink-0 w-6 h-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                                      isSubmitted
                                        ? isCorrectOption
                                          ? 'bg-emerald-700 text-white'
                                          : wasIncorrectlySelected
                                            ? 'bg-red-600 text-white'
                                            : 'bg-stone-200 text-stone-400'
                                        : isSelected
                                          ? 'bg-[#0F5A3E] text-white shadow-xs'
                                          : 'bg-white text-stone-600 border border-stone-200 group-hover:bg-stone-100'
                                    }`}>
                                      {oNum}
                                    </span>
                                    <span className="text-sm">{option}</span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Explanation Box inside single card mode after submit */}
                            {isSubmitted && (
                              <div className="mt-4 p-4 rounded-xl bg-stone-50 border border-stone-200 leading-relaxed text-xs">
                                <div className="flex items-center gap-1.5 font-bold mb-1.5">
                                  {isCorrect ? (
                                    <span className="text-emerald-700 flex items-center gap-0.5">
                                      <Check size={14} /> 정답입니다!
                                    </span>
                                  ) : (
                                    <span className="text-red-700 flex items-center gap-0.5">
                                      <X size={14} /> 오답 (정답: {q.correctAnswer}번)
                                    </span>
                                  )}
                                </div>
                                <p className="text-stone-600 font-sans"><strong className="text-stone-800">정답 해설:</strong> {q.explanation}</p>
                              </div>
                            )}

                            {/* Stepper Navigation Buttons */}
                            <div className="mt-auto pt-6 border-t border-stone-100 flex items-center justify-between gap-4">
                              <button
                                type="button"
                                disabled={currentCardIndex === 0}
                                onClick={() => setCurrentCardIndex(prev => prev - 1)}
                                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 disabled:hover:bg-stone-100 text-stone-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <ChevronLeft size={16} />
                                이전 문제
                              </button>

                              <span className="text-xs font-mono text-stone-400">
                                {currentCardIndex + 1} / 20
                              </span>

                              {currentCardIndex < shuffledQuestions.length - 1 ? (
                                <button
                                  type="button"
                                  onClick={() => setCurrentCardIndex(prev => prev + 1)}
                                  className="px-4 py-2 bg-[#0F5A3E] hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  다음 문제
                                  <ChevronRight size={16} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleSubmitExam}
                                  disabled={isSubmitted}
                                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
                                >
                                  답안지 최종 제출
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                    </div>
                  )}

                </div>

                {/* --- RIGHT SIDE: OMR ANSWER SHEET PANEL (Desktop Sidebar / Collapsible Mobile) --- */}
                <aside className="no-print w-full lg:w-72 shrink-0 flex flex-col gap-5">
                  
                  {/* Examinee Quick Overview */}
                  <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
                    <h3 className="text-xs font-bold text-stone-400 mb-3 uppercase tracking-wider">수험 정보</h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-stone-100 pb-1.5">
                        <span className="text-stone-400">성명</span>
                        <span className="font-bold text-stone-800">{examinee.name}</span>
                      </div>
                      <div className="flex justify-between border-b border-stone-100 pb-1.5">
                        <span className="text-stone-400">소속</span>
                        <span className="font-semibold text-stone-700">{examinee.dept}</span>
                      </div>
                      <div className="flex justify-between border-b border-stone-100 pb-1.5">
                        <span className="text-stone-400">수험번호</span>
                        <span className="font-mono text-stone-600">{examinee.idNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-400">응시 구분</span>
                        <span className="text-emerald-800 font-semibold">정기 HACCP 교육시험</span>
                      </div>
                    </div>
                  </div>

                  {/* OMR PANEL - Standard Desktop View */}
                  <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs flex-1 flex flex-col min-h-[480px]">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-3">
                      <div className="flex items-center gap-1.5">
                        <FileText className="text-stone-500" size={16} />
                        <h3 className="text-sm font-bold text-stone-800">OMR 답안지 기록카드</h3>
                      </div>
                      <span className="text-[10px] font-mono text-stone-400 font-bold">
                        완료: {Object.keys(answers).length} / 20
                      </span>
                    </div>

                    {/* OMR Questions Container */}
                    <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[450px] pr-1 scrollbar-thin">
                      {shuffledQuestions.map((q, idx) => {
                        const selectedNum = answers[q.id];
                        const isCorrect = answers[q.id] === q.correctAnswer;

                        return (
                          <div 
                            key={q.id} 
                            onClick={() => {
                              if (quizMode === 'card') {
                                setCurrentCardIndex(idx);
                              } else {
                                const el = document.getElementById(`q-paper-${q.id}`);
                                el?.scrollIntoView({ behavior: 'smooth' });
                              }
                            }}
                            className={`flex items-center justify-between p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                              quizMode === 'card' && currentCardIndex === idx
                                ? 'bg-amber-50/50 border border-amber-200' 
                                : 'hover:bg-stone-50 border border-transparent'
                            }`}
                          >
                            <span className="w-6 font-mono font-bold text-stone-500 text-center">
                              {(idx + 1).toString().padStart(2, '0')}
                            </span>
                            
                            <div className="flex gap-1.5">
                              {[1, 2, 3, 4, 5].map(oNum => {
                                const isOptionSelected = selectedNum === oNum;
                                const isCorrectAnswer = q.correctAnswer === oNum;

                                return (
                                  <button
                                    key={oNum}
                                    type="button"
                                    disabled={isSubmitted}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectAnswer(q.id, oNum);
                                    }}
                                    className={`w-6 h-6 rounded-full font-sans text-[10px] font-semibold flex items-center justify-center transition-all ${
                                      isSubmitted
                                        ? isCorrectAnswer
                                          ? 'bg-emerald-700 text-white font-bold'
                                          : isOptionSelected
                                            ? 'bg-red-600 text-white'
                                            : 'bg-stone-100 text-stone-300'
                                        : isOptionSelected
                                          ? 'bg-[#0F5A3E] text-white font-bold scale-110 shadow-xs'
                                          : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                    }`}
                                  >
                                    {oNum}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Small correctness indicator */}
                            <div className="w-5 flex justify-center">
                              {isSubmitted && (
                                isCorrect ? (
                                  <Check size={14} className="text-emerald-700 font-bold" />
                                ) : (
                                  <X size={14} className="text-red-600 font-bold" />
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* RED Submit Button */}
                    <div className="mt-4 pt-3 border-t border-stone-100">
                      {!isSubmitted ? (
                        <button
                          type="button"
                          onClick={handleSubmitExam}
                          className="w-full py-2.5 bg-[#C23B22] hover:bg-[#a6301b] text-white text-xs font-bold rounded-xl transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <FileText size={14} />
                          답안 제출 (채점하기)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleExitExam}
                          className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          확인 및 처음으로
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Exit Button */}
                  <button
                    onClick={handleExitExam}
                    className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 text-xs font-medium rounded-xl border border-stone-200 transition-colors"
                  >
                    평가 종료 (초기화)
                  </button>
                </aside>

              </div>
            )}
          </>
        )}

      </main>

      {/* ----------------- MODAL OVERLAY: SUBMIT CONFIRMATION (Custom Dialog) ----------------- */}
      <AnimatePresence>
        {showSubmitConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col p-6 border border-stone-200"
            >
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-50/50 flex items-center justify-center shrink-0">
                  <FileText className="text-amber-600" size={20} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-stone-900 text-lg">HACCP 내부평가 답안 제출</h3>
                  <p className="text-xs text-stone-400 font-sans mt-0.5">평가 최종 제출 및 채점하기</p>
                </div>
              </div>

              <div className="space-y-3.5 my-3">
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-150 text-sm">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-stone-500 font-medium">총 문항 수</span>
                    <span className="font-semibold text-stone-800">20문항</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-stone-100 mt-1">
                    <span className="text-stone-500 font-medium">기록된 답안</span>
                    <span className="font-bold text-emerald-800">{Object.keys(answers).length}개 완료</span>
                  </div>
                </div>

                {/* Unanswered count notice */}
                {20 - Object.keys(answers).length > 0 ? (
                  <div className="bg-amber-50 text-amber-800 text-xs p-3.5 rounded-xl border border-amber-100 flex items-start gap-2.5 leading-relaxed">
                    <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                    <div>
                      <p className="font-semibold text-amber-900">아직 풀지 않은 문제가 있습니다!</p>
                      <p className="mt-0.5">
                        총 <strong className="font-bold">{20 - Object.keys(answers).length}개</strong>의 문제를 풀지 않았습니다. 이대로 제출하시겠습니까?
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50/50 text-emerald-800 text-xs p-3.5 rounded-xl border border-emerald-100 flex items-start gap-2.5 leading-relaxed">
                    <Check className="text-emerald-700 shrink-0 mt-0.5" size={16} />
                    <div>
                      <p className="font-semibold text-emerald-900">모든 문항을 완료했습니다!</p>
                      <p className="mt-0.5">20개 문항의 답안을 완벽하게 마킹하셨습니다. 이제 최종 제출할 수 있습니다.</p>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-stone-400 text-center font-sans">
                  ※ 답안지를 최종 제출하시면 더 이상 답안을 수정할 수 없습니다.
                </p>
              </div>

              <div className="flex gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirmModal(false)}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  className="flex-1 py-2.5 bg-[#C23B22] hover:bg-[#a6301b] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  제출 및 채점하기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- MODAL OVERLAY: ADMIN PIN ENTRY (Custom Keypad) ----------------- */}
      <AnimatePresence>
        {showAdminPinModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl relative overflow-hidden flex flex-col p-6 border border-stone-200 text-center"
            >
              <div className="flex flex-col items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-2 text-emerald-800 border border-emerald-100">
                  <Lock size={22} className="animate-pulse" />
                </div>
                <h3 className="font-serif font-bold text-stone-900 text-lg">관리자 모드 비밀번호 입력</h3>
                <p className="text-xs text-stone-400 mt-1">5초 이내에 관리자 비밀번호를 입력해 주세요.</p>
              </div>

              {/* Countdown Progress Bar */}
              <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mb-5">
                <div 
                  className="h-full bg-emerald-700 transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(adminCountdown / 5) * 100}%` }}
                />
              </div>

              {/* Typed PIN Indicator */}
              <div className="flex justify-center gap-3 mb-6">
                {[0, 1, 2, 3].map(idx => (
                  <div 
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      adminPinInput.length > idx 
                        ? 'bg-emerald-800 border-emerald-800 scale-110 shadow-xs' 
                        : 'border-stone-300'
                    }`}
                  />
                ))}
              </div>

              {/* Numeric Keypad Grid */}
              <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto mb-4">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(num => (
                  <button
                    key={num}
                    onClick={() => handlePinNumpadClick(num)}
                    className="py-3 bg-stone-50 hover:bg-stone-100 active:bg-stone-200 text-stone-700 text-base font-bold rounded-xl border border-stone-200 shadow-3xs hover:shadow-2xs active:scale-95 transition-all cursor-pointer font-sans"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => setAdminPinInput(prev => prev.slice(0, -1))}
                  className="py-3 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-600 text-xs font-bold rounded-xl border border-stone-200 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                >
                  지우기
                </button>
                <button
                  onClick={() => handlePinNumpadClick("0")}
                  className="py-3 bg-stone-50 hover:bg-stone-100 active:bg-stone-200 text-stone-700 text-base font-bold rounded-xl border border-stone-200 shadow-3xs hover:shadow-2xs active:scale-95 transition-all cursor-pointer"
                >
                  0
                </button>
                <button
                  onClick={() => setShowAdminPinModal(false)}
                  className="py-3 bg-stone-100 hover:bg-red-50 hover:text-red-600 hover:border-red-100 text-stone-600 text-xs font-bold rounded-xl border border-stone-200 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                >
                  취소
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- MODAL OVERLAY: ADMIN QUESTION DETAIL VIEW (Examinee breakdown) ----------------- */}
      <AnimatePresence>
        {selectedQuestionDetail && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-3xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col p-6 border border-stone-200"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 bg-stone-100 text-stone-700 border border-stone-200 rounded-md">
                    문항 Q{selectedQuestionDetail.question.id}
                  </span>
                  {selectedQuestionDetail.userAns === selectedQuestionDetail.question.correctAnswer ? (
                    <span className="text-[10px] font-bold bg-emerald-55 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-full">
                      정답 채점 완료
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-red-55 text-red-850 border border-red-100 px-2 py-0.5 rounded-full">
                      오답 채점 완료
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setSelectedQuestionDetail(null)}
                  className="text-stone-400 hover:text-stone-600 p-1 hover:bg-stone-50 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto max-h-[400px] pr-1">
                {/* Question Text */}
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-stone-850 leading-relaxed font-sans">
                    {selectedQuestionDetail.question.text}
                  </h4>
                  {selectedQuestionDetail.question.context && (
                    <p className="text-xs text-stone-500 bg-stone-50 p-3 rounded-lg border border-stone-150 whitespace-pre-wrap leading-relaxed">
                      {selectedQuestionDetail.question.context}
                    </p>
                  )}
                </div>

                {/* Question Options */}
                <div className="space-y-2">
                  {selectedQuestionDetail.question.options.map((option, idx) => {
                    const optNum = idx + 1;
                    const isCorrectOption = optNum === selectedQuestionDetail.question.correctAnswer;
                    const isUserSelectedOption = optNum === selectedQuestionDetail.userAns;

                    return (
                      <div 
                        key={idx}
                        className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-colors ${
                          isCorrectOption 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium' 
                            : isUserSelectedOption
                              ? 'bg-red-50 border-red-200 text-red-900'
                              : 'bg-stone-50/50 border-stone-150 text-stone-600'
                        }`}
                      >
                        <span className={`flex w-5 h-5 rounded-full items-center justify-center text-[10px] font-bold shrink-0 ${
                          isCorrectOption 
                            ? 'bg-emerald-600 text-white' 
                            : isUserSelectedOption
                              ? 'bg-red-500 text-white'
                              : 'bg-stone-200 text-stone-600'
                        }`}>
                          {optNum}
                        </span>
                        <span className="flex-1 leading-normal">{option}</span>
                        <div className="shrink-0 pt-0.5">
                          {isCorrectOption && <Check size={14} className="text-emerald-700 font-bold" />}
                          {!isCorrectOption && isUserSelectedOption && <X size={14} className="text-red-600 font-bold" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                <div className="bg-emerald-50/20 border border-emerald-100 rounded-xl p-4 space-y-1.5">
                  <h5 className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                    <Info size={13} className="text-emerald-800" />
                    <span>정답 해설 및 교육 가이드</span>
                  </h5>
                  <p className="text-xs text-stone-650 leading-relaxed">
                    {selectedQuestionDetail.question.explanation}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-stone-150 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedQuestionDetail(null)}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ----------------- MODAL OVERLAY: ADMIN FULL OMR & EXAM DETAIL VIEW (개인별 1차, 2차 OMR 및 문항 확인) ----------------- */}
        {selectedHistoryDetail && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl relative overflow-hidden flex flex-col border border-stone-250 max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 bg-stone-900 text-white flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-700/80 text-white flex items-center justify-center shrink-0">
                    <FileCheck size={22} />
                  </div>
                  <div>
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-lg font-bold text-white font-sans tracking-tight">
                        {selectedHistoryDetail.name || "응시자"} 님
                      </span>
                      <span className="text-xs text-stone-300 font-sans">
                        | {selectedHistoryDetail.dept || "부서 미지정"}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        selectedHistoryDetail.round === 2 || selectedHistoryDetail.isReexam
                          ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
                          : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                      }`}>
                        {selectedHistoryDetail.round === 2 || selectedHistoryDetail.isReexam ? '2차 재시험' : '1차 정기평가'}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        selectedHistoryDetail.score >= passingScoreThreshold
                          ? 'bg-emerald-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}>
                        {selectedHistoryDetail.score >= passingScoreThreshold ? '합격' : '불합격'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-300 mt-1 font-sans flex items-center flex-wrap gap-3">
                      <span>수험번호: <strong className="text-white font-mono">{selectedHistoryDetail.idNo || 'HS-기록없음'}</strong></span>
                      <span>응시일: <strong className="text-white">{selectedHistoryDetail.date}</strong></span>
                      <span>점수: <strong className="text-white font-mono text-sm">{selectedHistoryDetail.score}점</strong> ({Math.round(selectedHistoryDetail.score / 5)}/20문항 정답)</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedHistoryDetail(null)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="닫기"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body: Scrollable */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-stone-50/50">
                {/* 1. OMR 답안지 한눈에 보기 카드 */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs">
                  <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-emerald-800" />
                      <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                        OMR 제출 답안 및 정오표 (20문항)
                      </h4>
                    </div>
                    <div className="text-[11px] text-stone-500 font-sans flex items-center gap-3">
                      <span className="flex items-center gap-1 text-emerald-700 font-bold">
                        <Check size={13} className="stroke-[3px]" /> 정답: {Math.round(selectedHistoryDetail.score / 5)}개
                      </span>
                      <span className="flex items-center gap-1 text-red-600 font-bold">
                        <X size={13} className="stroke-[3px]" /> 오답: {20 - Math.round(selectedHistoryDetail.score / 5)}개
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-2">
                    {haccpQuestions.map(q => {
                      const userAns = selectedHistoryDetail.answers?.[q.id];
                      const isCorrect = userAns === q.correctAnswer;
                      const isUnanswered = userAns === undefined;

                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            const elem = document.getElementById(`omr-modal-q-${q.id}`);
                            if (elem) {
                              elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                            isUnanswered
                              ? 'bg-stone-100 border-stone-250 text-stone-500'
                              : isCorrect
                                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                                : 'bg-red-50/90 border-red-200 text-red-900 hover:bg-red-100'
                          }`}
                          title={`문항 ${q.id}번 확인하기 (클릭 시 이동)`}
                        >
                          <span className="text-[10px] font-mono font-bold block text-stone-500">Q{q.id}</span>
                          <div className="flex items-center justify-center gap-1 my-1">
                            <span className="text-xs font-bold font-mono">
                              {userAns ? `${userAns}번` : '미응시'}
                            </span>
                            {isCorrect ? (
                              <Check size={12} className="text-emerald-700 stroke-[3.5px]" />
                            ) : (
                              <X size={12} className="text-red-600 stroke-[3.5px]" />
                            )}
                          </div>
                          {!isCorrect && (
                            <span className="text-[9px] text-stone-400 block">정답:{q.correctAnswer}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-stone-400 text-right mt-2 font-sans">
                    ※ 각 문항 박스를 클릭하면 아래 해당 문제의 상세 풀이 및 해설 위치로 즉시 이동합니다.
                  </p>
                </div>

                {/* 2. 문항별 전체 상세 리스트 (질문, 4지선다, 마킹내역, 정답해설) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <ListFilter size={16} className="text-stone-700" />
                      전 문항 상세 확인 및 오답 분석
                    </h4>
                    <span className="text-xs text-stone-500 font-sans">
                      총 20문항 (문항당 5점 배점)
                    </span>
                  </div>

                  {haccpQuestions.map((q) => {
                    const userAns = selectedHistoryDetail.answers?.[q.id];
                    const isCorrect = userAns === q.correctAnswer;
                    const isUnanswered = userAns === undefined;

                    return (
                      <div
                        id={`omr-modal-q-${q.id}`}
                        key={q.id}
                        className={`bg-white rounded-2xl border p-5 sm:p-6 transition-all shadow-xs ${
                          isCorrect 
                            ? 'border-emerald-200' 
                            : 'border-red-250 bg-red-50/10'
                        }`}
                      >
                        {/* Question Header */}
                        <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-100 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold px-2.5 py-1 bg-stone-100 text-stone-800 rounded-lg border border-stone-200">
                              문항 {q.id}
                            </span>
                            <span className="text-[11px] text-stone-400 font-sans">배점: 5점</span>
                          </div>
                          <div>
                            {isUnanswered ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-stone-200 text-stone-700">
                                미응답
                              </span>
                            ) : isCorrect ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                <Check size={13} className="stroke-[3px]" />
                                정답 (5점 획득)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200 shadow-2xs">
                                <X size={13} className="stroke-[3px]" />
                                오답 (0점 / 감점)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Question Title & Context */}
                        <div className="space-y-2 mb-4">
                          <h5 className="text-sm sm:text-base font-bold text-stone-900 leading-snug font-sans">
                            {q.id}. {q.text}
                          </h5>
                          {q.context && (
                            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-650 leading-relaxed font-sans whitespace-pre-line">
                              {q.context}
                            </div>
                          )}
                        </div>

                        {/* Options List */}
                        <div className="space-y-2 mb-4">
                          {q.options.map((opt, optIdx) => {
                            const optNum = optIdx + 1;
                            const isSelected = userAns === optNum;
                            const isRealAnswer = q.correctAnswer === optNum;

                            return (
                              <div
                                key={optIdx}
                                className={`p-3 rounded-xl border text-xs sm:text-sm flex items-start gap-3 transition-colors ${
                                  isRealAnswer
                                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                                    : isSelected
                                      ? 'bg-red-50 border-red-300 text-red-900'
                                      : 'bg-white border-stone-200 text-stone-700'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                                  isRealAnswer
                                    ? 'bg-emerald-700 text-white'
                                    : isSelected
                                      ? 'bg-red-600 text-white'
                                      : 'bg-stone-200 text-stone-700'
                                }`}>
                                  {optNum}
                                </span>
                                <span className="flex-1 leading-relaxed">{opt}</span>
                                <div className="shrink-0 text-right">
                                  {isRealAnswer && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                                      <Check size={12} className="stroke-[3px]" /> 실제 정답
                                    </span>
                                  )}
                                  {isSelected && !isRealAnswer && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                                      <X size={12} className="stroke-[3px]" /> 수험자 선택(오답)
                                    </span>
                                  )}
                                  {isSelected && isRealAnswer && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-md ml-1.5">
                                      수험자 선택
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation Box */}
                        <div className="bg-emerald-50/30 border border-emerald-200 rounded-xl p-3.5 space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1">
                            <Info size={14} className="text-emerald-800" />
                            <span>HACCP 기준 및 정답 해설</span>
                          </div>
                          <p className="text-stone-700 leading-relaxed font-sans">
                            {q.explanation}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-white border-t border-stone-200 flex items-center justify-between gap-4 shrink-0">
                <div className="text-xs text-stone-500 font-sans hidden sm:block">
                  ※ 인쇄가 필요하신 경우 상단 시험지 인쇄 기능을 활용하실 수 있습니다.
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedHistoryDetail(null)}
                    className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    확인 및 닫기
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* 30-Minute Time Expired Modal (30분 시험 시간 종료 안내 모달) */}
        {showTimeExpiredModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border-2 border-red-300 shadow-2xl max-w-md w-full p-6 text-center space-y-4"
            >
              <div className="w-14 h-14 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Clock3 size={32} className="animate-pulse" />
              </div>

              <div className="space-y-1.5">
                <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                  제한시간 30분 초과
                </div>
                <h3 className="font-serif font-bold text-xl text-stone-900">
                  시험 시간이 종료되었습니다
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed max-w-xs mx-auto">
                  정해진 시험 제한 시간(30분)이 모두 경과하였습니다.<br />
                  현재까지 작성하신 답안으로 즉시 채점을 완료하거나 시험을 종료하실 수 있습니다.
                </p>
              </div>

              <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200 text-left text-xs space-y-1.5">
                <div className="flex justify-between text-stone-600">
                  <span className="text-stone-400">수험생:</span>
                  <span className="font-bold text-stone-800">{examinee.name} ({examinee.dept})</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span className="text-stone-400">응시 구분:</span>
                  <span className="font-bold text-stone-800">{isReexamMode ? '2차 재시험' : '1차 정기 위생교육 평가'}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span className="text-stone-400">답안 표기 문항:</span>
                  <span className="font-mono font-bold text-emerald-800">{Object.keys(answers).length} / 20문항</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTimeExpiredModal(false);
                    handleConfirmSubmit();
                  }}
                  className="w-full py-3 bg-[#0F5A3E] hover:bg-emerald-900 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  현재 답안으로 시험 제출 및 채점하기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTimeExpiredModal(false);
                    handleExitExam();
                  }}
                  className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  시험 포기 및 처음 화면으로 이동
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* QR Code sharing modal */}
        {showQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-md w-full p-6 space-y-4 text-center relative"
            >
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="absolute right-4 top-4 text-stone-400 hover:text-stone-600 p-1.5 hover:bg-stone-50 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex flex-col items-center pt-1">
                <div className="w-11 h-11 bg-emerald-50 rounded-full flex items-center justify-center text-[#0F5A3E] mb-2">
                  <QrCode size={22} />
                </div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                    주관: 품질보증팀
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-300">
                    모바일 응시 QR
                  </span>
                </div>
                <h3 className="font-serif font-bold text-lg text-stone-900">
                  모바일 시험 응시용 QR코드
                </h3>
                <p className="text-xs text-stone-500 mt-1 max-w-sm leading-normal">
                  스마트폰 카메라로 아래 QR코드를 스캔하면 성명·소속 입력 후 {new Date().getFullYear()}년도 HACCP 시험지로 즉시 이동합니다.
                </p>
              </div>

              {/* QR Image Container */}
              <div className="flex flex-col items-center justify-center p-3.5 bg-stone-50 rounded-xl border border-stone-150">
                {qrUrl ? (
                  <div className="relative p-2 bg-white rounded-xl border border-stone-200 shadow-sm">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrUrl)}`}
                      alt="Exam QR Code"
                      className="w-[180px] h-[180px]"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-[180px] h-[180px] flex items-center justify-center text-xs text-stone-400">
                    URL을 입력해주세요
                  </div>
                )}
                <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-semibold mt-2">
                  <CheckCircle2 size={13} className="text-emerald-700" />
                  <span>스마트폰 스캔 시 시험 화면으로 즉시 연결</span>
                </div>
              </div>

              {/* URL input and Copy / Paste buttons */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-stone-700">
                    시험지 연결 주소 (URL)
                  </label>
                  <div className="flex items-center gap-2">
                    {qrUrl !== getPublicShareUrl() && (
                      <button
                        type="button"
                        onClick={() => {
                          const pubUrl = getPublicShareUrl();
                          setQrUrl(pubUrl);
                          localStorage.setItem("saved_custom_qr_url", pubUrl);
                        }}
                        className="text-[10px] font-bold text-stone-500 hover:text-stone-800 underline cursor-pointer"
                      >
                        기본 주소(Vercel)로 복원
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={qrUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQrUrl(val);
                      setCopied(false);
                      if (val.trim()) {
                        localStorage.setItem("saved_custom_qr_url", val.trim());
                      }
                    }}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 bg-stone-50 border border-stone-250 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-emerald-800 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text && text.startsWith("http")) {
                          setQrUrl(text.trim());
                          localStorage.setItem("saved_custom_qr_url", text.trim());
                          setCopied(false);
                        } else {
                          alert("클립보드에 유효한 링크(URL)가 없습니다.");
                        }
                      } catch {
                        const entered = prompt("복사한 공개 링크(Share URL)를 붙여넣어 주세요:", qrUrl);
                        if (entered && entered.trim().startsWith("http")) {
                          setQrUrl(entered.trim());
                          localStorage.setItem("saved_custom_qr_url", entered.trim());
                        }
                      }
                    }}
                    className="px-2.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                    title="클립보드에서 붙여넣기"
                  >
                    붙여넣기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (qrUrl) {
                        navigator.clipboard.writeText(qrUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                      copied
                        ? 'bg-emerald-800 border-emerald-800 text-white'
                        : 'bg-stone-900 border-stone-900 text-white hover:bg-stone-850'
                    }`}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? "복사완료" : "복사"}</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const newWindow = window.open(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrUrl)}`, '_blank');
                    if (newWindow) newWindow.focus();
                  }}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl border border-stone-200 transition-all cursor-pointer"
                >
                  QR 크게보기 / 인쇄
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.open(qrUrl, '_blank');
                  }}
                  className="px-3 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl border border-stone-200 transition-all cursor-pointer flex items-center gap-1"
                >
                  <ExternalLink size={14} />
                  새 탭 열기
                </button>
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  className="px-4 py-2.5 bg-stone-900 hover:bg-stone-850 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Exam Paper Print / Download Modal */}
        {showExamPaperModal && (
          <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs no-print ${
            isExamModalMaximized ? 'p-0.5 sm:p-1' : 'p-1 sm:p-3 md:p-4'
          }`}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`bg-white rounded-2xl border border-stone-200 shadow-2xl w-full relative flex flex-col transition-all ${
                isExamModalMaximized 
                  ? 'max-w-[99.5vw] h-[98.5vh] p-3 sm:p-5 space-y-2.5' 
                  : 'max-w-[96vw] xl:max-w-7xl h-[95vh] p-4 sm:p-6 space-y-3.5'
              }`}
            >
              {/* Top Header Buttons: Fullscreen & Close */}
              <div className="absolute right-4 top-4 flex items-center gap-1.5 z-10">
                <button
                  type="button"
                  onClick={() => setIsExamModalMaximized(prev => !prev)}
                  className="text-stone-500 hover:text-stone-800 p-2 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                  title={isExamModalMaximized ? "원래 크기로 복원" : "미리보기 화면 최대화"}
                >
                  {isExamModalMaximized ? (
                    <>
                      <Minimize2 size={18} />
                      <span className="hidden sm:inline">화면 축소</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 size={18} />
                      <span className="hidden sm:inline">화면 최대화</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowExamPaperModal(false)}
                  className="text-stone-400 hover:text-stone-600 p-2 hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
                  title="닫기"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-center gap-3.5 border-b border-stone-150 pb-3 pr-28">
                <div className="w-11 h-11 bg-stone-900 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                  <Printer size={22} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-xl text-stone-900 flex items-center gap-2">
                    연도별 HACCP 평가 시험지 출력 및 파일 저장
                    <span className="text-xs font-sans font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                      A4 양면 1장 표준 규격
                    </span>
                  </h3>
                </div>
              </div>

              {/* Controls bar inside modal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs">
                {/* Year Select */}
                <div className="flex items-center gap-2">
                  <label className="font-bold text-stone-700 shrink-0">출력 연도 선택:</label>
                  <select
                    value={examPaperYear}
                    onChange={e => setExamPaperYear(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-lg font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-800 focus:outline-hidden cursor-pointer text-xs sm:text-sm"
                  >
                    {[2026].map(y => (
                      <option key={y} value={y.toString()}>{y}년도 평가 시험지 (온라인 정식 시행)</option>
                    ))}
                  </select>
                </div>

                {/* Exam Paper Type */}
                <div className="flex items-center gap-2">
                  <label className="font-bold text-stone-700 shrink-0">시험지 유형:</label>
                  <div className="flex gap-1.5 flex-1">
                    <button
                      type="button"
                      onClick={() => setExamPaperType('student')}
                      className={`flex-1 py-2 px-3 rounded-lg font-medium text-xs transition-all cursor-pointer border ${
                        examPaperType === 'student'
                          ? 'bg-stone-900 text-white border-stone-900 font-bold shadow-2xs'
                          : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      📝 응시자용 (문제지)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExamPaperType('teacher')}
                      className={`flex-1 py-2 px-3 rounded-lg font-medium text-xs transition-all cursor-pointer border ${
                        examPaperType === 'teacher'
                          ? 'bg-emerald-800 text-white border-emerald-800 font-bold shadow-2xs'
                          : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      💡 관리자/해답용 (정답&해설)
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons Toolbar & Zoom Controls */}
              <div className="flex flex-col gap-2.5 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Preview Tabs & Zoom Controls */}
                  <div className="flex flex-wrap items-center gap-2 w-full justify-between">
                    <div className="flex items-center gap-1 bg-white/90 p-1 rounded-lg border border-emerald-200 text-xs">
                      <span className="text-[11px] font-bold text-stone-600 px-1">면 선택:</span>
                      <button
                        type="button"
                        onClick={() => setExamPreviewTab('both')}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                          examPreviewTab === 'both' ? 'bg-emerald-800 text-white shadow-2xs' : 'text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        전체보기
                      </button>
                      <button
                        type="button"
                        onClick={() => setExamPreviewTab('page1')}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                          examPreviewTab === 'page1' ? 'bg-emerald-800 text-white shadow-2xs' : 'text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        앞면 (1~10번)
                      </button>
                      <button
                        type="button"
                        onClick={() => setExamPreviewTab('page2')}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                          examPreviewTab === 'page2' ? 'bg-emerald-800 text-white shadow-2xs' : 'text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        뒷면 (11~20번)
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 bg-white/90 p-1 rounded-lg border border-stone-200 text-xs">
                        <span className="text-[11px] font-bold text-stone-600 px-1 flex items-center gap-1">
                          <ZoomIn size={12} />
                          글자 크기:
                        </span>
                        <button
                          type="button"
                          onClick={() => setExamPreviewZoom('normal')}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                            examPreviewZoom === 'normal' ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          보통
                        </button>
                        <button
                          type="button"
                          onClick={() => setExamPreviewZoom('large')}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                            examPreviewZoom === 'large' ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          크게
                        </button>
                        <button
                          type="button"
                          onClick={() => setExamPreviewZoom('xlarge')}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                            examPreviewZoom === 'xlarge' ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          아주 크게
                        </button>
                        <button
                          type="button"
                          onClick={() => setExamPreviewZoom('xxlarge')}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                            examPreviewZoom === 'xxlarge' ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          최대 크기
                        </button>
                      </div>

                      {/* 팝업 새 창으로 크게 보기 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleOpenExamPaperWindow(false)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="새 팝업 브라우저 창에서 넓은 전체 화면으로 보기"
                      >
                        <ExternalLink size={13} />
                        <span>팝업 새 창으로 크게보기</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsExamModalMaximized(prev => !prev)}
                        className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        {isExamModalMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        <span>{isExamModalMaximized ? '기본창' : '미리보기 창 전체확대'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-100">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    내보내기 실행:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrintExamPaper}
                      className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="양면 인쇄로 A4 1장 출력"
                    >
                      <Printer size={16} />
                      시험지 인쇄 (양면 1장)
                    </button>
                    <button
                      type="button"
                      disabled={isGeneratingPdf}
                      onClick={handleDownloadExamPdf}
                      className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                      title="A4 양면 1장 규격 PDF 파일 다운로드"
                    >
                      {isGeneratingPdf ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          PDF 생성 중...
                        </>
                      ) : (
                        <>
                          <Download size={16} />
                          PDF 저장
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadExamDoc}
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="Word에서 열어 양면 인쇄 시 1장으로 출력 (2페이지 완벽 규격)"
                    >
                      <Download size={16} />
                      Word 저장 (.doc)
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadExamTxt}
                      className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <FileText size={16} />
                      TXT 저장 (.txt)
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Preview Paper - 2 Column Double-Sided Layout */}
              <div 
                style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif" }}
                className={`flex-1 overflow-y-auto bg-stone-200/70 rounded-xl p-3 sm:p-5 md:p-6 border border-stone-300 text-stone-900 space-y-6 ${
                  isExamModalMaximized ? 'max-h-[82vh]' : 'max-h-[72vh]'
                }`}
              >
                {/* PAGE 1: 앞면 (1~10번) */}
                {(examPreviewTab === 'both' || examPreviewTab === 'page1') && (
                  <div className={`bg-white rounded-xl border border-stone-300 shadow-md space-y-5 mx-auto transition-all ${
                    examPreviewZoom === 'xxlarge' 
                      ? 'w-full max-w-7xl p-8 sm:p-10 md:p-12' 
                      : examPreviewZoom === 'xlarge' 
                        ? 'w-full max-w-6xl p-7 sm:p-9 md:p-11' 
                        : examPreviewZoom === 'large'
                          ? 'w-full max-w-5xl p-6 sm:p-8 md:p-10'
                          : 'w-full max-w-5xl p-6 sm:p-8 md:p-10'
                  }`}>
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2.5 text-xs text-stone-500 font-sans">
                      <span className="font-bold text-stone-700 text-xs sm:text-sm">KOOKSOONDANG | 주식회사 국순당 횡성양조장</span>
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 font-bold rounded-md text-xs sm:text-sm">
                        [ 제 1 면 - 앞면 (1번 ~ 10번) ]
                      </span>
                    </div>

                    <div className="text-center space-y-1.5">
                      <h2 className={`font-bold text-stone-900 tracking-tight ${
                        examPreviewZoom === 'xxlarge' ? 'text-2xl sm:text-3xl' : examPreviewZoom === 'xlarge' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
                      }`}>
                        {examPaperYear}년도 HACCP 및 선행요건 정기 위생교육 평가 시험지
                      </h2>
                      <p className="text-xs sm:text-sm text-stone-600 font-sans font-medium">
                        주관 부서: 품질보증팀 &nbsp;|&nbsp; {examPaperType === 'student' ? '[ 수험생 응시용 문제지 ]' : '[ 관리자용 정답 및 해설지 ]'}
                      </p>
                    </div>

                    {/* Header Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-stone-800 text-center font-sans text-xs sm:text-sm">
                        <tbody>
                          <tr>
                            <th className="border border-stone-800 bg-stone-100 p-2 font-bold" width="12%">소 속</th>
                            <td className="border border-stone-800 p-2" width="24%"></td>
                            <th className="border border-stone-800 bg-stone-100 p-2 font-bold" width="12%">성 명</th>
                            <td className="border border-stone-800 p-2" width="24%"></td>
                            <th className="border border-stone-800 bg-stone-100 p-2 font-bold" width="14%">결 재</th>
                            <td className="border border-stone-800 p-2 text-xs" width="14%">담당 / 팀장</td>
                          </tr>
                          <tr>
                            <th className="border border-stone-800 bg-stone-100 p-2 font-bold">평가 일자</th>
                            <td className="border border-stone-800 p-2">{examPaperYear}년 &nbsp;&nbsp;&nbsp;월 &nbsp;&nbsp;&nbsp;일</td>
                            <th className="border border-stone-800 bg-stone-100 p-2 font-bold">평가 점수</th>
                            <td className="border border-stone-800 p-2 font-bold text-emerald-900">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 점 / 100점</td>
                            <th className="border border-stone-800 bg-stone-100 p-2 font-bold">판 정</th>
                            <td className="border border-stone-800 p-2 font-bold text-xs sm:text-sm">[ 합격 / 재평가 ]</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Notice */}
                    <div className="p-3 bg-stone-50 border border-stone-300 rounded-lg text-xs sm:text-sm font-sans text-stone-700 leading-normal">
                      <b>[평가 안내사항]</b> ① 총 20문항(문항당 5점 배점)이며 70점 이상 취득 시 합격입니다. ② 각 문항을 읽고 가장 알맞은 번호(①~⑤)를 선택하십시오.
                    </div>

                    {/* 2-Column Grid for Questions 1 ~ 10 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      {/* Left Column: 1 ~ 5 */}
                      <div className="space-y-5 md:pr-4 md:border-r md:border-stone-200">
                        {haccpQuestions.slice(0, 5).map((q, idx) => (
                          <div key={q.id} className="space-y-2">
                            <p className={`font-bold text-stone-900 leading-snug ${
                              examPreviewZoom === 'xxlarge' 
                                ? 'text-lg sm:text-xl' 
                                : examPreviewZoom === 'xlarge' 
                                  ? 'text-base sm:text-lg' 
                                  : examPreviewZoom === 'large' 
                                    ? 'text-sm sm:text-base' 
                                    : 'text-xs sm:text-sm'
                            }`}>
                              <span className="text-emerald-950 mr-1.5 font-extrabold">{idx + 1}.</span> {q.text}
                            </p>
                            {q.context && (
                              <div className={`bg-stone-50 border border-stone-250 p-2 text-stone-600 rounded-md font-sans ${
                                examPreviewZoom === 'xxlarge' || examPreviewZoom === 'xlarge' ? 'text-sm' : 'text-xs'
                              }`}>
                                {q.context}
                              </div>
                            )}
                            <div className={`pl-2 space-y-1.5 text-stone-800 font-sans ${
                              examPreviewZoom === 'xxlarge' 
                                ? 'text-base sm:text-lg' 
                                : examPreviewZoom === 'xlarge' 
                                  ? 'text-sm sm:text-base' 
                                  : examPreviewZoom === 'large' 
                                    ? 'text-xs sm:text-sm' 
                                    : 'text-xs'
                            }`}>
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-start gap-1.5">
                                  <span className="font-bold text-stone-900 shrink-0">{['①', '②', '③', '④', '⑤'][oIdx]}</span>
                                  <span className={examPaperType === 'teacher' && q.correctAnswer === oIdx + 1 ? 'font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded' : ''}>
                                    {opt}
                                    {examPaperType === 'teacher' && q.correctAnswer === oIdx + 1 && (
                                      <span className="text-emerald-700 font-bold ml-1.5">[★ 정답]</span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {examPaperType === 'teacher' && (
                              <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs sm:text-sm font-sans text-emerald-900 leading-relaxed">
                                <span className="font-bold">[정답: {q.correctAnswer}번]</span> {q.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Right Column: 6 ~ 10 */}
                      <div className="space-y-5 md:pl-4">
                        {haccpQuestions.slice(5, 10).map((q, idx) => (
                          <div key={q.id} className="space-y-2">
                            <p className={`font-bold text-stone-900 leading-snug ${
                              examPreviewZoom === 'xxlarge' 
                                ? 'text-lg sm:text-xl' 
                                : examPreviewZoom === 'xlarge' 
                                  ? 'text-base sm:text-lg' 
                                  : examPreviewZoom === 'large' 
                                    ? 'text-sm sm:text-base' 
                                    : 'text-xs sm:text-sm'
                            }`}>
                              <span className="text-emerald-950 mr-1.5 font-extrabold">{idx + 6}.</span> {q.text}
                            </p>
                            {q.context && (
                              <div className={`bg-stone-50 border border-stone-250 p-2 text-stone-600 rounded-md font-sans ${
                                examPreviewZoom === 'xxlarge' || examPreviewZoom === 'xlarge' ? 'text-sm' : 'text-xs'
                              }`}>
                                {q.context}
                              </div>
                            )}
                            <div className={`pl-2 space-y-1.5 text-stone-800 font-sans ${
                              examPreviewZoom === 'xxlarge' 
                                ? 'text-base sm:text-lg' 
                                : examPreviewZoom === 'xlarge' 
                                  ? 'text-sm sm:text-base' 
                                  : examPreviewZoom === 'large' 
                                    ? 'text-xs sm:text-sm' 
                                    : 'text-xs'
                            }`}>
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-start gap-1.5">
                                  <span className="font-bold text-stone-900 shrink-0">{['①', '②', '③', '④', '⑤'][oIdx]}</span>
                                  <span className={examPaperType === 'teacher' && q.correctAnswer === oIdx + 1 ? 'font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded' : ''}>
                                    {opt}
                                    {examPaperType === 'teacher' && q.correctAnswer === oIdx + 1 && (
                                      <span className="text-emerald-700 font-bold ml-1.5">[★ 정답]</span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {examPaperType === 'teacher' && (
                              <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs sm:text-sm font-sans text-emerald-900 leading-relaxed">
                                <span className="font-bold">[정답: {q.correctAnswer}번]</span> {q.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="text-center pt-4 border-t border-stone-200 text-xs sm:text-sm text-stone-600 font-sans font-bold">
                      - 1 / 2 면 [ 다음 면(뒷면) 11~20번에 계속 ] -
                    </div>
                  </div>
                )}

                {/* PAGE 2: 뒷면 (11~20번) */}
                {(examPreviewTab === 'both' || examPreviewTab === 'page2') && (
                  <div className={`bg-white rounded-xl border border-stone-300 shadow-md space-y-5 mx-auto transition-all ${
                    examPreviewZoom === 'xxlarge' 
                      ? 'w-full max-w-7xl p-8 sm:p-10 md:p-12' 
                      : examPreviewZoom === 'xlarge' 
                        ? 'w-full max-w-6xl p-7 sm:p-9 md:p-11' 
                        : examPreviewZoom === 'large'
                          ? 'w-full max-w-5xl p-6 sm:p-8 md:p-10'
                          : 'w-full max-w-5xl p-6 sm:p-8 md:p-10'
                  }`}>
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2.5 text-xs text-stone-500 font-sans">
                      <span className="font-bold text-stone-700 text-xs sm:text-sm">KOOKSOONDANG | 주식회사 국순당 횡성양조장</span>
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-900 font-bold rounded-md text-xs sm:text-sm">
                        [ 제 2 면 - 뒷면 (11번 ~ 20번) ]
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-stone-800 pb-2 text-xs sm:text-sm font-sans">
                      <span className="font-bold text-stone-900">
                        {examPaperYear}년도 HACCP 및 선행요건 정기 위생교육 평가 시험지 (제 2 면 - 뒷면)
                      </span>
                      <span className="text-stone-600 font-medium">성명: ____________ &nbsp;&nbsp; 소속: ____________</span>
                    </div>

                    {/* 2-Column Grid for Questions 11 ~ 20 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      {/* Left Column: 11 ~ 15 */}
                      <div className="space-y-5 md:pr-4 md:border-r md:border-stone-200">
                        {haccpQuestions.slice(10, 15).map((q, idx) => (
                          <div key={q.id} className="space-y-2">
                            <p className={`font-bold text-stone-900 leading-snug ${
                              examPreviewZoom === 'xxlarge' 
                                ? 'text-lg sm:text-xl' 
                                : examPreviewZoom === 'xlarge' 
                                  ? 'text-base sm:text-lg' 
                                  : examPreviewZoom === 'large' 
                                    ? 'text-sm sm:text-base' 
                                    : 'text-xs sm:text-sm'
                            }`}>
                              <span className="text-emerald-950 mr-1.5 font-extrabold">{idx + 11}.</span> {q.text}
                            </p>
                            {q.context && (
                              <div className={`bg-stone-50 border border-stone-250 p-2 text-stone-600 rounded-md font-sans ${
                                examPreviewZoom === 'xxlarge' || examPreviewZoom === 'xlarge' ? 'text-sm' : 'text-xs'
                              }`}>
                                {q.context}
                              </div>
                            )}
                            <div className={`pl-2 space-y-1.5 text-stone-800 font-sans ${
                              examPreviewZoom === 'xxlarge' 
                                ? 'text-base sm:text-lg' 
                                : examPreviewZoom === 'xlarge' 
                                  ? 'text-sm sm:text-base' 
                                  : examPreviewZoom === 'large' 
                                    ? 'text-xs sm:text-sm' 
                                    : 'text-xs'
                            }`}>
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-start gap-1.5">
                                  <span className="font-bold text-stone-900 shrink-0">{['①', '②', '③', '④', '⑤'][oIdx]}</span>
                                  <span className={examPaperType === 'teacher' && q.correctAnswer === oIdx + 1 ? 'font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded' : ''}>
                                    {opt}
                                    {examPaperType === 'teacher' && q.correctAnswer === oIdx + 1 && (
                                      <span className="text-emerald-700 font-bold ml-1.5">[★ 정답]</span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {examPaperType === 'teacher' && (
                              <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs sm:text-sm font-sans text-emerald-900 leading-relaxed">
                                <span className="font-bold">[정답: {q.correctAnswer}번]</span> {q.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Right Column: 16 ~ 20 */}
                      <div className="space-y-5 md:pl-4">
                        {haccpQuestions.slice(15, 20).map((q, idx) => (
                          <div key={q.id} className="space-y-2">
                            <p className={`font-bold text-stone-900 leading-snug ${
                              examPreviewZoom === 'xxlarge' 
                                ? 'text-lg sm:text-xl' 
                                : examPreviewZoom === 'xlarge' 
                                  ? 'text-base sm:text-lg' 
                                  : examPreviewZoom === 'large' 
                                    ? 'text-sm sm:text-base' 
                                    : 'text-xs sm:text-sm'
                            }`}>
                              <span className="text-emerald-950 mr-1.5 font-extrabold">{idx + 16}.</span> {q.text}
                            </p>
                            {q.context && (
                              <div className={`bg-stone-50 border border-stone-250 p-2 text-stone-600 rounded-md font-sans ${
                                examPreviewZoom === 'xxlarge' || examPreviewZoom === 'xlarge' ? 'text-sm' : 'text-xs'
                              }`}>
                                {q.context}
                              </div>
                            )}
                            <div className={`pl-2 space-y-1.5 text-stone-800 font-sans ${
                              examPreviewZoom === 'xxlarge' 
                                ? 'text-base sm:text-lg' 
                                : examPreviewZoom === 'xlarge' 
                                  ? 'text-sm sm:text-base' 
                                  : examPreviewZoom === 'large' 
                                    ? 'text-xs sm:text-sm' 
                                    : 'text-xs'
                            }`}>
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-start gap-1.5">
                                  <span className="font-bold text-stone-900 shrink-0">{['①', '②', '③', '④', '⑤'][oIdx]}</span>
                                  <span className={examPaperType === 'teacher' && q.correctAnswer === oIdx + 1 ? 'font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded' : ''}>
                                    {opt}
                                    {examPaperType === 'teacher' && q.correctAnswer === oIdx + 1 && (
                                      <span className="text-emerald-700 font-bold ml-1.5">[★ 정답]</span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {examPaperType === 'teacher' && (
                              <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs sm:text-sm font-sans text-emerald-900 leading-relaxed">
                                <span className="font-bold">[정답: {q.correctAnswer}번]</span> {q.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-stone-50 border border-stone-300 rounded-lg text-center text-xs sm:text-sm font-sans text-stone-700">
                      <b>[ - 이하 여백 - ]</b> 문제 풀이를 완료하신 후 기재사항 및 누락된 문항이 없는지 다시 점검하십시오. 수고하셨습니다.
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-stone-200 text-xs text-stone-400 font-sans">
                      <span>주식회사 국순당 품질보증팀</span>
                      <span>- 2 / 2 면 (끝) -</span>
                      <span>HACCP 관리인증</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Close Footer */}
              <div className="pt-2 border-t border-stone-150 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowExamPaperModal(false)}
                  className="px-6 py-2.5 bg-stone-900 hover:bg-stone-850 text-white text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. 관리자 커스텀 삭제 확인 모달 (iframe sandbox 및 브라우저 완벽 호환) */}
      <AnimatePresence>
        {deleteConfirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-250 overflow-hidden"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-stone-900 leading-tight">
                    {deleteConfirmModal.title}
                  </h3>
                  {deleteConfirmModal.targetName && (
                    <p className="text-xs font-bold text-red-600 bg-red-50 inline-block px-2.5 py-1 rounded-lg mt-1.5 border border-red-200">
                      {deleteConfirmModal.targetName}
                    </p>
                  )}
                  <p className="text-xs text-stone-600 mt-2.5 leading-relaxed whitespace-pre-line">
                    {deleteConfirmModal.description}
                  </p>
                  {deleteConfirmModal.warning && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2 leading-relaxed">
                      <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
                      <span>{deleteConfirmModal.warning}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  disabled={deleteConfirmModal.isLoading}
                  onClick={() => setDeleteConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmModal.isLoading}
                  onClick={async () => {
                    setDeleteConfirmModal(prev => ({ ...prev, isLoading: true }));
                    try {
                      await deleteConfirmModal.onConfirm();
                    } finally {
                      setDeleteConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
                    }
                  }}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {deleteConfirmModal.isLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      삭제 처리 중...
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      {deleteConfirmModal.confirmText || "확인 및 삭제"}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. 관리자 인앱 알림 토스트 (iframe sandbox 호환) */}
      <AnimatePresence>
        {adminToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold transition-all ${
              adminToast.type === 'error'
                ? 'bg-red-900 text-white border-red-700'
                : adminToast.type === 'info'
                  ? 'bg-stone-800 text-white border-stone-600'
                  : 'bg-emerald-900 text-white border-emerald-700'
            }`}
          >
            {adminToast.type === 'error' ? (
              <AlertTriangle size={16} className="text-red-400" />
            ) : adminToast.type === 'info' ? (
              <AlertCircle size={16} className="text-stone-300" />
            ) : (
              <CheckCircle2 size={16} className="text-emerald-400" />
            )}
            <span>{adminToast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------- PRINT ONLY EXAM PAPER CONTAINER FOR WINDOW.PRINT() (A4 양면 1장) ----------------- */}
      <div className="print-only bg-white text-stone-900" style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif" }}>
        {/* PAGE 1 (앞면: 1번~10번 2단 다단) */}
        <div className="print-page flex flex-col justify-between" style={{ width: '210mm', height: '297mm', maxHeight: '297mm', boxSizing: 'border-box', pageBreakAfter: 'always', breakAfter: 'page', pageBreakInside: 'avoid', breakInside: 'avoid', overflow: 'hidden', padding: '5mm 7mm 4mm 7mm', fontFamily: "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif" }}>
          <div>
            <div className="text-center mb-0.5 text-[9px] font-bold tracking-widest text-stone-600">
              KOOKSOONDANG | 주식회사 국순당 횡성양조장
            </div>
            <h1 className="text-center text-[14px] font-bold text-stone-900 mb-0.5" style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}>
              {examPaperYear}년도 HACCP 및 선행요건 정기 위생교육 평가 시험지
            </h1>
            <p className="text-center text-[9px] text-stone-600 font-bold mb-1">
              주관 부서: 품질보증팀 &nbsp;|&nbsp; {examPaperType === 'student' ? '[ 수험생 응시용 문제지 (제 1 면 - 앞면: 1~10번) ]' : '[ 관리자용 정답 및 해설지 (제 1 면 - 앞면: 1~10번) ]'}
            </p>

            <table className="w-full border-collapse border border-stone-900 text-center text-[9px] mb-1" style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}>
              <tbody>
                <tr>
                  <th className="border border-stone-900 bg-stone-100 p-0.5 font-bold" width="12%">소 속</th>
                  <td className="border border-stone-900 p-0.5" width="24%"></td>
                  <th className="border border-stone-900 bg-stone-100 p-0.5 font-bold" width="12%">성 명</th>
                  <td className="border border-stone-900 p-0.5" width="24%"></td>
                  <th className="border border-stone-900 bg-stone-100 p-0.5 font-bold" width="14%">결 재</th>
                  <td className="border border-stone-900 p-0.5 text-[8px]" width="14%">담당 / 팀장</td>
                </tr>
                <tr>
                  <th className="border border-stone-900 bg-stone-100 p-0.5 font-bold">평가 일자</th>
                  <td className="border border-stone-900 p-0.5">{examPaperYear}년 &nbsp;&nbsp;&nbsp;월 &nbsp;&nbsp;&nbsp;일</td>
                  <th className="border border-stone-900 bg-stone-100 p-0.5 font-bold">평가 점수</th>
                  <td className="border border-stone-900 p-0.5 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 점 / 100점</td>
                  <th className="border border-stone-900 bg-stone-100 p-0.5 font-bold">판 정</th>
                  <td className="border border-stone-900 p-0.5 font-bold text-[9px]">[ 합격 &nbsp;/&nbsp; 재평가 ]</td>
                </tr>
              </tbody>
            </table>

            <div className="border border-stone-400 bg-stone-50 px-2 py-0.5 mb-1.5 text-[8.5px] leading-tight" style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}>
              <b>[평가 안내사항]</b> ① 총 20문항(문항당 5점 배점)이며 70점 이상 합격입니다. ② 첫번째 장(앞면): 1~10번 / 두번째 장(뒷면): 11~20번입니다.
            </div>

            {/* 2-Column Grid */}
            <div className="grid grid-cols-2 gap-x-4 relative text-[9px]" style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}>
              <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-stone-300 -translate-x-1/2" />
              {/* Col 1: 1~5 */}
              <div className="pr-2 space-y-2">
                {haccpQuestions.slice(0, 5).map((q, idx) => (
                  <div key={q.id} className="pb-0.5" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <p className="font-bold text-stone-900 leading-snug mb-0.5">
                      <span className="font-bold mr-0.5">{idx + 1}.</span> {q.text}
                    </p>
                    {q.context && (
                      <div className="bg-stone-50 border border-stone-200 px-1 py-0.5 mb-0.5 text-[8px] text-stone-600 leading-tight">
                        {q.context}
                      </div>
                    )}
                    <div className="pl-1 text-stone-800 leading-tight space-y-0.5">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-start gap-1">
                          <span className="font-bold text-stone-900 shrink-0">{['①', '②', '③', '④', '⑤'][oIdx]}</span>
                          <span>
                            {opt}
                            {examPaperType === 'teacher' && q.correctAnswer === oIdx + 1 && (
                              <span className="text-emerald-800 font-bold ml-1">[★ 정답]</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    {examPaperType === 'teacher' && (
                      <div className="mt-0.5 p-0.5 bg-emerald-50 border border-emerald-300 rounded text-[8px] text-emerald-900 leading-tight">
                        <b>[정답: {q.correctAnswer}번]</b> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Col 2: 6~10 */}
              <div className="pl-2 space-y-2">
                {haccpQuestions.slice(5, 10).map((q, idx) => (
                  <div key={q.id} className="pb-0.5" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <p className="font-bold text-stone-900 leading-snug mb-0.5">
                      <span className="font-bold mr-0.5">{idx + 6}.</span> {q.text}
                    </p>
                    {q.context && (
                      <div className="bg-stone-50 border border-stone-200 px-1 py-0.5 mb-0.5 text-[8px] text-stone-600 leading-tight">
                        {q.context}
                      </div>
                    )}
                    <div className="pl-1 text-stone-800 leading-tight space-y-0.5">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-start gap-1">
                          <span className="font-bold text-stone-900 shrink-0">{['①', '②', '③', '④', '⑤'][oIdx]}</span>
                          <span>
                            {opt}
                            {examPaperType === 'teacher' && q.correctAnswer === oIdx + 1 && (
                              <span className="text-emerald-800 font-bold ml-1">[★ 정답]</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    {examPaperType === 'teacher' && (
                      <div className="mt-0.5 p-0.5 bg-emerald-50 border border-emerald-300 rounded text-[8px] text-emerald-900 leading-tight">
                        <b>[정답: {q.correctAnswer}번]</b> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-center pt-0.5 mt-0.5 border-t border-stone-300 text-[8.5px] text-stone-600 font-bold" style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}>
            - 1 / 2 면 [ 다음 면(뒷면) 11~20번에 계속 ] -
          </div>
        </div>

        {/* PAGE 2 (뒷면: 11번~20번 2단 다단) */}
        <div className="print-page flex flex-col justify-between" style={{ width: '210mm', height: '297mm', maxHeight: '297mm', boxSizing: 'border-box', pageBreakInside: 'avoid', breakInside: 'avoid', overflow: 'hidden', padding: '5mm 7mm 4mm 7mm', fontFamily: "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif" }}>
          <div>
            <div className="flex justify-between items-center border-b border-stone-900 pb-0.5 mb-1 text-[9px]" style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}>
              <span className="font-bold text-stone-900 text-[10.5px]">
                {examPaperYear}년도 HACCP 및 선행요건 정기 위생교육 평가 시험지 (제 2 면 - 뒷면: 11~20번)
              </span>
              <span className="text-stone-700 font-bold text-[8.5px]">성명: ______________ &nbsp;&nbsp; 소속: ______________</span>
            </div>

            {/* 2-Column Grid */}
            <div className="grid grid-cols-2 gap-x-4 relative text-[9px]" style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}>
              <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-stone-300 -translate-x-1/2" />
              {/* Col 1: 11~15 */}
              <div className="pr-2 space-y-2">
                {haccpQuestions.slice(10, 15).map((q, idx) => (
                  <div key={q.id} className="pb-0.5" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <p className="font-bold text-stone-900 leading-snug mb-0.5">
                      <span className="font-bold mr-0.5">{idx + 11}.</span> {q.text}
                    </p>
                    {q.context && (
                      <div className="bg-stone-50 border border-stone-200 px-1 py-0.5 mb-0.5 text-[8px] text-stone-600 leading-tight">
                        {q.context}
                      </div>
                    )}
                    <div className="pl-1 text-stone-800 leading-tight space-y-0.5">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-start gap-1">
                          <span className="font-bold text-stone-900 shrink-0">{['①', '②', '③', '④', '⑤'][oIdx]}</span>
                          <span>
                            {opt}
                            {examPaperType === 'teacher' && q.correctAnswer === oIdx + 1 && (
                              <span className="text-emerald-800 font-bold ml-1">[★ 정답]</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    {examPaperType === 'teacher' && (
                      <div className="mt-0.5 p-0.5 bg-emerald-50 border border-emerald-300 rounded text-[8px] text-emerald-900 leading-tight">
                        <b>[정답: {q.correctAnswer}번]</b> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Col 2: 16~20 */}
              <div className="pl-2 space-y-2">
                {haccpQuestions.slice(15, 20).map((q, idx) => (
                  <div key={q.id} className="pb-0.5" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <p className="font-bold text-stone-900 leading-snug mb-0.5">
                      <span className="font-bold mr-0.5">{idx + 16}.</span> {q.text}
                    </p>
                    {q.context && (
                      <div className="bg-stone-50 border border-stone-200 px-1 py-0.5 mb-0.5 text-[8px] text-stone-600 leading-tight">
                        {q.context}
                      </div>
                    )}
                    <div className="pl-1 text-stone-800 leading-tight space-y-0.5">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-start gap-1">
                          <span className="font-bold text-stone-900 shrink-0">{['①', '②', '③', '④', '⑤'][oIdx]}</span>
                          <span>
                            {opt}
                            {examPaperType === 'teacher' && q.correctAnswer === oIdx + 1 && (
                              <span className="text-emerald-800 font-bold ml-1">[★ 정답]</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    {examPaperType === 'teacher' && (
                      <div className="mt-0.5 p-0.5 bg-emerald-50 border border-emerald-300 rounded text-[8px] text-emerald-900 leading-tight">
                        <b>[정답: {q.correctAnswer}번]</b> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-stone-400 bg-stone-50 px-2 py-0.5 mt-1.5 text-center text-[8.5px] text-stone-700" style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}>
              <b>[ - 이하 여백 - ]</b> 문제 풀이를 완료하신 후 기재사항 및 누락된 문항이 없는지 다시 점검하십시오. 수고하셨습니다.
            </div>
          </div>

          <div className="flex justify-between items-center pt-0.5 border-t border-stone-300 text-[8.5px] text-stone-500" style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}>
            <span>주식회사 국순당 품질보증팀</span>
            <span>- 2 / 2 면 (끝) -</span>
            <span>HACCP 식품안전관리인증기준</span>
          </div>
        </div>
      </div>

      {/* NOTE: Certificate issuance content has been removed by user request. */}

    </div>
  );
}
