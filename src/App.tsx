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
  Home
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { haccpQuestions, Question } from "./data/questions";

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

// History record for local storage
interface ExamHistory {
  date: string;
  score: number;
  passed: boolean;
  name: string;
  dept: string;
  idNo?: string;
  answers?: Record<number, number>;
}

export default function App() {
  // 1. App States
  const [examinee, setExaminee] = useState<ExamineeInfo>({
    name: "",
    dept: "",
    idNo: "",
    date: new Date().toISOString().split('T')[0]
  });
  
  const [isExamStarted, setIsExamStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [quizMode, setQuizMode] = useState<'paper' | 'card'>('paper');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  
  // Timer States
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  // UI States
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [showOMRModalMobile, setShowOMRModalMobile] = useState(false);
  const [examHistory, setExamHistory] = useState<ExamHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'exam' | 'history'>('exam');
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const [startExamError, setStartExamError] = useState<string | null>(null);
  const [selectedHistoryDetail, setSelectedHistoryDetail] = useState<ExamHistory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'reexam' | 'retrain'>('all');
  const [dummyCountInput, setDummyCountInput] = useState<string>("5");

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
      if (nextVal === "1234") {
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
          if (nextVal === "1234") {
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
    const savedInfo = localStorage.getItem("haccp_examinee_info");
    if (savedInfo) {
      try {
        setExaminee(JSON.parse(savedInfo));
      } catch (e) {
        console.error(e);
      }
    }

    const savedHistory = localStorage.getItem("haccp_exam_history");
    if (savedHistory) {
      try {
        setExamHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error(e);
      }
    }
    
    // Auto-generate examinee ID if empty
    setExaminee(prev => {
      if (!prev.idNo) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return { ...prev, idNo: `HS-2026-${randomNum}` };
      }
      return prev;
    });
  }, []);

  // 3. Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && !isSubmitted) {
      interval = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, isSubmitted]);

  // 4. Score Calculation
  const correctCount = haccpQuestions.reduce((acc, q) => {
    return acc + (answers[q.id] === q.correctAnswer ? 1 : 0);
  }, 0);
  const finalScore = correctCount * 5; // 20 questions, 5 points each
  const isPassed = finalScore >= passingScoreThreshold;

  // 5. Handlers
  const handleStartExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examinee.name.trim() || !examinee.dept.trim()) {
      setStartExamError("성명과 소속을 모두 입력해 주세요.");
      return;
    }
    setStartExamError(null);
    // Save info to local storage
    localStorage.setItem("haccp_examinee_info", JSON.stringify(examinee));
    
    // Reset answers and timer
    setAnswers({});
    setSecondsElapsed(0);
    setIsSubmitted(false);
    setCurrentCardIndex(0);
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

  const handleConfirmSubmit = () => {
    setShowSubmitConfirmModal(false);
    setIsSubmitted(true);
    setIsTimerRunning(false);
    
    // Add to history
    const newRecord: ExamHistory = {
      date: new Date().toISOString().split('T')[0],
      score: finalScore,
      passed: finalScore >= passingScoreThreshold,
      name: examinee.name,
      dept: examinee.dept,
      idNo: examinee.idNo,
      answers: { ...answers }
    };
    
    const updatedHistory = [newRecord, ...examHistory];
    setExamHistory(updatedHistory);
    localStorage.setItem("haccp_exam_history", JSON.stringify(updatedHistory));
    
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
    const departments = ["품질관리과", "약주발효팀", "포장생산과", "원료위생팀", "제품안전팀", "기획관리과", "생산관리팀", "출하검사과"];
    
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
      dateObj.setDate(dateObj.getDate() - Math.floor(Math.random() * 30));
      const dateStr = dateObj.toISOString().split('T')[0];

      newSamples.push({
        date: dateStr,
        score: score,
        passed: score >= passingScoreThreshold,
        name: name,
        dept: dept,
        idNo: `HS-2026-${randomId}`,
        answers: mockAnswers
      });
    }

    const sortedSamples = [...newSamples].sort((a, b) => b.date.localeCompare(a.date));
    const updatedHistory = [...sortedSamples, ...examHistory];
    
    setExamHistory(updatedHistory);
    // localdb에 저장
    localStorage.setItem("haccp_exam_history", JSON.stringify(updatedHistory));
    alert(`성공적으로 더미 데이터 ${count}건이 생성되어 LocalDB(localStorage)에 저장되었습니다.`);
  };

  const handleClearHistory = () => {
    if (window.confirm("모든 응시 이력을 정말 삭제하시겠습니까?")) {
      localStorage.removeItem("haccp_exam_history");
      setExamHistory([]);
    }
  };

  const downloadExcelReport = () => {
    if (examHistory.length === 0) return;

    const headers = [
      "수험 번호",
      "성명",
      "소속 부서/팀",
      "응시일",
      "점수",
      "판정 결과",
      "맞은 개수",
      "틀린 개수"
    ];

    for (let i = 1; i <= 20; i++) {
      headers.push(`Q${i} 제출답안`, `Q${i} 판정`);
    }

    const csvRows = [headers.join(",")];

    examHistory.forEach(record => {
      const score = record.score;
      const status = score >= 70 ? "합격" : score >= 50 ? "재시험" : "재교육";
      const correctAnsCount = Math.round(score / 5);
      const wrongAnsCount = 20 - correctAnsCount;
      const idNo = record.idNo || "HS-2026-기록없음";

      const row = [
        `"${idNo}"`,
        `"${record.name.replace(/"/g, '""')}"`,
        `"${record.dept.replace(/"/g, '""')}"`,
        `"${record.date}"`,
        `"${score}점"`,
        `"${status}"`,
        `"${correctAnsCount}개"`,
        `"${wrongAnsCount}개"`
      ];

      for (let i = 1; i <= 20; i++) {
        const q = haccpQuestions.find(question => question.id === i);
        const userAns = record.answers ? record.answers[i] : undefined;

        if (userAns === undefined) {
          row.push(`"미응답"`, `"-"`);
        } else {
          const isCorrect = q && userAns === q.correctAnswer;
          row.push(`"${userAns}번"`, `"${isCorrect ? "O" : "X"}"`);
        }
      }

      csvRows.push(row.join(","));
    });

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `국순당_HACCP_내부평가_결과보고서_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExitExam = () => {
    setIsExamStarted(false);
    setIsSubmitted(false);
    setAnswers({});
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

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab(activeTab === 'exam' ? 'history' : 'exam')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'history' 
                  ? 'bg-emerald-800 text-white' 
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <History size={14} />
              이력 {examHistory.length > 0 && `(${examHistory.length})`}
            </button>
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
                        ADMIN MODE
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-1 font-sans">국순당 횡성양조장 임직원 HACCP 내부평가 응시 결과 및 통계 관리 화면입니다.</p>
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

            {/* 2. Admin Stats Grid */}
            {(() => {
              const total = examHistory.length;
              const passed = examHistory.filter(r => r.score >= 70).length;
              const reexam = examHistory.filter(r => r.score >= 50 && r.score < 70).length;
              const retrain = examHistory.filter(r => r.score < 50).length;
              const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
              const average = total > 0 
                ? Math.round((examHistory.reduce((acc, r) => acc + r.score, 0) / total) * 10) / 10 
                : 0;

              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-xs text-stone-400 block font-sans font-medium">총 응시 건수</span>
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
                        재시험: {reexam}
                      </span>
                      <span className="text-[10px] font-bold bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full">
                        재교육: {retrain}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 3. Search & Control Bar */}
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
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="px-3 py-2 bg-stone-50 border border-stone-250 rounded-xl text-xs text-stone-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-800 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="all">전체 평가 판정 결과</option>
                    <option value="passed">합격 (70점 이상)</option>
                    <option value="reexam">재시험 대상 (50점 ~ 69점)</option>
                    <option value="retrain">재교육 대상 (50점 미만)</option>
                  </select>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
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
                          alert("올바른 개수를 입력하세요.");
                          return;
                        }
                        handleAddSampleDataOfCount(count);
                      }}
                      className="px-2 py-0.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-[11px] font-bold rounded-md cursor-pointer"
                    >
                      생성
                    </button>
                  </div>

                  {examHistory.length > 0 && (
                    <button
                      onClick={handleClearHistory}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-100"
                      title="전체 데이터 삭제"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Examinee List */}
            {(() => {
              const filtered = examHistory.filter(record => {
                const matchesSearch = 
                  record.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  record.dept.toLowerCase().includes(searchQuery.toLowerCase());
                  
                const matchesStatus = 
                  statusFilter === 'all' ? true :
                  statusFilter === 'passed' ? record.score >= 70 :
                  statusFilter === 'reexam' ? record.score >= 50 && record.score < 70 :
                  statusFilter === 'retrain' ? record.score < 50 : true;
                  
                return matchesSearch && matchesStatus;
              });

              if (filtered.length === 0) {
                return (
                  <div className="bg-white rounded-2xl p-12 text-center text-stone-400 border border-stone-200">
                    <User className="mx-auto text-stone-300 mb-3" size={48} />
                    <p className="text-sm font-sans font-medium">조건에 만족하는 응시자 결과가 없습니다.</p>
                    <p className="text-xs mt-1 font-sans">검색어 또는 필터를 변경하거나 더미 데이터를 입력해보세요.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {filtered.map((record, index) => {
                    const recordKey = record.idNo || `HS-${index}`;
                    const isExpanded = expandedRecords[recordKey];
                    const recordStatus = record.score >= 70 ? "passed" : record.score >= 50 ? "reexam" : "retrain";

                    return (
                      <div 
                        key={recordKey}
                        className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-sm transition-all"
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
                              <span className="text-[10px] text-stone-400 font-mono">({record.idNo || 'ID 없음'})</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-stone-450 font-sans">
                              <span>응시일: {record.date}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-5">
                            <div className="text-right">
                              <div className="flex items-center gap-1.5">
                                <span className="text-lg font-mono font-bold text-stone-800">{record.score}점</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  recordStatus === 'passed' 
                                    ? 'bg-emerald-55 text-emerald-800 border border-emerald-100' 
                                    : recordStatus === 'reexam' 
                                      ? 'bg-amber-55 text-amber-800 border border-amber-100' 
                                      : 'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                  {recordStatus === 'passed' ? '합격' : recordStatus === 'reexam' ? '재시험' : '재교육'}
                                </span>
                              </div>
                            </div>
                            <div className={`p-1.5 rounded-lg text-stone-400 hover:text-stone-700 transition-colors ${isExpanded ? 'rotate-180' : ''}`}>
                              <ChevronDown size={18} className="transition-transform duration-200" />
                            </div>
                          </div>
                        </div>

                        {/* Detailed Dropdown Panel (각 문항별 정오답 여부) */}
                        {isExpanded && (
                          <div className="border-t border-stone-150 p-4 md:p-5 bg-stone-50/50 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                                <FileText size={14} className="text-emerald-800" />
                                <span>문항별 평가 결과 (정답 여부)</span>
                              </div>
                              <span className="text-[10px] text-stone-400 font-sans">※ 각 문항 아이콘을 클릭하면 세부 문제 내용 및 정답과 해설이 표시됩니다.</span>
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
              );
            })()}
          </div>
        ) : activeTab === 'history' ? (
          <div className="bg-white rounded-2xl shadow-xs border border-stone-200 p-6 max-w-2xl mx-auto w-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <History className="text-emerald-800" size={24} />
                <h2 className="text-lg font-serif font-bold text-stone-900">내부평가 시험 응시 이력</h2>
              </div>
            </div>

            {/* 더미 데이터 생성 도구 */}
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 mb-6 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-stone-700">
                  <Plus className="text-emerald-800 shrink-0" size={16} />
                  <span className="text-xs font-bold font-sans">테스트용 더미 데이터 입력기 (LocalDB 저장)</span>
                </div>
                <span className="text-[10px] bg-stone-200 text-stone-600 px-2 py-0.5 rounded-md font-mono self-start sm:self-center">
                  LocalDB Storage Active
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 bg-white border border-stone-250 rounded-xl px-3 py-1.5 shrink-0">
                  <span className="text-xs text-stone-500 shrink-0 font-medium">생성할 개수:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={dummyCountInput}
                    onChange={(e) => setDummyCountInput(e.target.value)}
                    className="w-16 text-xs font-mono font-bold focus:outline-hidden text-stone-800 border-b border-transparent focus:border-stone-300"
                    placeholder="5"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const count = parseInt(dummyCountInput, 10);
                    if (isNaN(count) || count <= 0) {
                      alert("1 이상의 올바른 숫자를 입력해 주세요.");
                      return;
                    }
                    handleAddSampleDataOfCount(count);
                  }}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  더미 데이터 생성
                </button>
                {examHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Trash2 size={13} />
                    전체 초기화
                  </button>
                )}
              </div>
            </div>

            {examHistory.length === 0 ? (
              <div className="text-center py-12 text-stone-400">
                <GraduationCap className="mx-auto mb-3 text-stone-300" size={48} />
                <p className="text-sm">아직 응시한 이력이 없습니다.</p>
                <p className="text-xs mt-1">HACCP 시험을 풀고 점수를 확인해 보세요.</p>
                <button
                  onClick={() => setActiveTab('exam')}
                  className="mt-4 px-4 py-2 bg-[#0F5A3E] text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors"
                >
                  시험 보러 가기
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {examHistory.map((record, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-150">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-stone-800">{record.name} ({record.dept})</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          record.score >= 70 
                            ? 'bg-emerald-55 text-emerald-800 border border-emerald-100' 
                            : record.score >= 50 
                              ? 'bg-amber-55 text-amber-800 border border-amber-100' 
                              : 'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                          {record.score >= 70 ? '합격' : record.score >= 50 ? '재평가' : '재교육+재평가'}
                        </span>
                      </div>
                      <span className="text-xs text-stone-400 block mt-1">응시일: {record.date}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-mono font-bold text-[#0F5A3E]">{record.score}점</span>
                      <span className="text-xs text-stone-400 block">100점 만점</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                    className="cursor-pointer select-none group"
                    title="관리자 인증 (국순당 클릭 후 5초 이내 1234 입력)"
                  >
                    <KooksoondangLogo className="justify-center text-white mb-4 filter brightness-0 invert group-hover:opacity-85 transition-opacity" />
                    <h1 className="font-serif font-bold text-2xl tracking-tight group-hover:text-emerald-100 transition-colors">
                      국순당 횡성양조장
                    </h1>
                  </div>
                  <h2 className="font-serif text-lg text-emerald-100/90 mt-1">HACCP 내부평가</h2>
                  <p className="text-xs text-emerald-200/70 mt-3 max-w-md mx-auto leading-relaxed">
                    본 평가는 횡성양조장의 위생 품질과 안전 관리 프로세스를 점검하고 향상시키기 위한 내부 필수 HACCP 이수 과정입니다.
                  </p>
                </div>

                {examHistory.length > 0 ? (
                  <div className="p-6 md:p-8 space-y-6">
                    <div className="bg-red-50 text-red-800 text-xs p-4 rounded-xl border border-red-100 flex items-start gap-2.5 leading-relaxed">
                      <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                      <div>
                        <p className="font-semibold text-red-900 text-sm">평가 응시 완료 (재도전 불가)</p>
                        <p className="mt-1 text-red-700">
                          귀하는 이미 본 HACCP 내부평가에 응시하셨습니다.
                        </p>
                        <p className="mt-0.5">
                          HACCP 내부 관리 규정에 따라 본 평가는 <strong className="font-bold text-red-900">단 1회만 응시 가능</strong>하며, 추가적인 재시험이나 재도전은 엄격히 금지됩니다.
                        </p>
                      </div>
                    </div>

                    <div className="border border-stone-200 rounded-xl p-5 bg-stone-50/50 space-y-3 relative overflow-hidden">
                      <div className="absolute -right-4 -bottom-4 w-28 h-28 border-4 border-double rounded-full opacity-10 flex items-center justify-center rotate-12">
                        <span className="font-bold text-lg font-sans">완료</span>
                      </div>
                      
                      <h3 className="font-semibold text-stone-800 text-sm border-b border-stone-200 pb-2 mb-3 font-sans">최종 응시 기록</h3>
                      <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs text-stone-600">
                        <div>
                          <span className="text-stone-400 block font-medium">성명</span>
                          <span className="font-semibold text-stone-800 text-sm">{examHistory[0].name}</span>
                        </div>
                        <div>
                          <span className="text-stone-400 block font-medium">소속 부서 / 팀</span>
                          <span className="font-semibold text-stone-800 text-sm">{examHistory[0].dept}</span>
                        </div>
                        <div>
                          <span className="text-stone-400 block font-medium">수험 번호</span>
                          <span className="font-mono text-stone-700">{examHistory[0].idNo || 'HS-2026-7713'}</span>
                        </div>
                        <div>
                          <span className="text-stone-400 block font-medium">평가 완료일</span>
                          <span className="text-stone-700">{examHistory[0].date}</span>
                        </div>
                        <div className="col-span-2 border-t border-stone-150 pt-2.5 mt-1 flex justify-between items-center">
                          <div>
                            <span className="text-stone-400 block font-medium">종합 평가 결과</span>
                            <span className={`text-lg font-bold ${examHistory[0].score >= 70 ? 'text-emerald-800' : examHistory[0].score >= 50 ? 'text-amber-700' : 'text-red-600'}`}>
                              {examHistory[0].score}점 ({examHistory[0].score >= 70 ? '합격' : examHistory[0].score >= 50 ? '재시험' : '재교육'})
                            </span>
                          </div>
                          
                          {/* Circle Stamp */}
                          <div className={`w-14 h-14 rounded-full border-2 ${
                            examHistory[0].score >= 70 
                              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' 
                              : examHistory[0].score >= 50 
                                ? 'border-amber-600 text-amber-700 bg-amber-50/50' 
                                : 'border-red-600 text-red-700 bg-red-50/50'
                          } flex flex-col items-center justify-center font-bold text-[11px] rotate-12 shrink-0 shadow-xs`}>
                            <span className="scale-90 font-extrabold font-sans">
                              {examHistory[0].score >= 70 ? '합격' : examHistory[0].score >= 50 ? '재시험' : '재교육'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('history')}
                      className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-stone-200"
                    >
                      <History size={16} />
                      전체 응시 이력 목록 확인하기
                    </button>
                  </div>
                ) : (
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
                          <label className="block text-xs font-semibold text-stone-600 mb-1">평가일</label>
                          <input
                            type="date"
                            value={examinee.date}
                            onChange={e => setExaminee(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full px-3 py-2.5 bg-stone-50 border border-stone-250 rounded-xl text-sm text-stone-800 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>

                    {startExamError && (
                      <div className="bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-100 font-medium animate-pulse text-center">
                        {startExamError}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3 bg-[#0F5A3E] hover:bg-emerald-800 text-white font-medium text-sm rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      <FileText size={18} />
                      HACCP 내부평가 시험 시작
                    </button>
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
                        <div className="flex items-center gap-2 text-stone-700">
                          <Clock className="text-emerald-800 animate-pulse" size={16} />
                          <span className="text-xs font-semibold text-stone-500">진행시간</span>
                          <span className="font-mono text-base font-bold text-stone-800">{formatTime(secondsElapsed)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SUBMISSION RESULT HEADER BANNER (IF SUBMITTED) */}
                  {isSubmitted && (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white rounded-2xl border-2 border-stone-200 overflow-hidden shadow-md"
                    >
                      <div className={`p-6 text-center ${isPassed ? 'bg-emerald-50/50' : 'bg-orange-50/40'} border-b border-stone-150 relative`}>
                        {/* Stamp Overlay */}
                        <div className="absolute right-6 top-6 md:right-12 md:top-8 rotate-12 select-none pointer-events-none">
                          <div className={`w-24 h-24 rounded-full border-4 ${
                            finalScore >= 70 
                              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/70' 
                              : finalScore >= 50 
                                ? 'border-amber-600 text-amber-700 bg-amber-50/70' 
                                : 'border-red-600 text-red-700 bg-red-50/70'
                          } flex flex-col items-center justify-center font-bold text-center border-dashed p-1 shadow-sm`}>
                            <span className="text-xs leading-none font-sans">국순당</span>
                            <span className="text-base font-extrabold tracking-wider my-1 font-sans">
                              {finalScore >= 70 ? '합 격' : finalScore >= 50 ? '재시험' : '재교육'}
                            </span>
                            <span className="text-[9px] leading-none font-sans">횡성양조장</span>
                          </div>
                        </div>

                        <div className="max-w-md mx-auto">
                          <Award className={`mx-auto mb-2 ${isPassed ? 'text-emerald-700' : 'text-amber-600'}`} size={44} />
                          <h2 className="text-xl font-serif font-bold text-stone-900">채점 결과 리포트</h2>
                          <p className="text-xs text-stone-500 mt-1">수고하셨습니다! 제출하신 HACCP 답안지가 정상 채점되었습니다.</p>
                          
                          <div className="grid grid-cols-3 gap-3 my-6 bg-white rounded-xl p-4 border border-stone-200">
                            <div>
                              <span className="text-[10px] font-bold text-stone-400 block uppercase">종합 점수</span>
                              <span className={`text-2xl font-mono font-black ${isPassed ? 'text-emerald-800' : 'text-red-600'}`}>{finalScore}점</span>
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
                                <p className="text-sm text-emerald-800 font-semibold flex items-center justify-center gap-1">
                                  <Check size={16} />
                                  축하합니다! 합격 기준({passingScoreThreshold}점)을 충족하여 평가를 무사히 통과하였습니다.
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
                            ) : (
                              <div className="space-y-3 w-full">
                                <p className="text-xs text-red-600 flex flex-col items-center justify-center gap-1 font-medium bg-red-50/50 p-3.5 rounded-xl border border-red-100 leading-relaxed">
                                  <span className="flex items-center gap-1 text-sm font-bold">
                                    <AlertTriangle size={16} className="text-red-500" />
                                    {finalScore < 50 ? "HACCP 재교육 대상" : "HACCP 오프라인 재평가 대상"}
                                  </span>
                                  <span className="text-center mt-1 max-w-md">
                                    {finalScore < 50 
                                      ? `합격 기준(${passingScoreThreshold}점)에 미달(50점 미만)하여 재교육 및 재평가 대상입니다. 본 온라인 평가는 단 1회만 응시 가능하므로, 추후 안내될 사내 HACCP 재교육 일정을 확인해 주시기 바랍니다.`
                                      : `합격 기준(${passingScoreThreshold}점)에 미달(70점 미만)하여 오프라인 재평가 대상입니다. 본 온라인 평가는 단 1회만 응시 가능하므로, 오답 해설을 상세히 점검한 뒤 오프라인 재시험 일정을 대기해 주세요.`}
                                  </span>
                                </p>
                                <div className="flex justify-center gap-2">
                                  <button
                                    onClick={handleExitExam}
                                    className="px-6 py-2.5 bg-stone-700 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
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
                        {haccpQuestions.map((q, idx) => {
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
                                  {q.id}.
                                </div>
                                <div className="space-y-2 w-full">
                                  <h3 className="font-serif font-bold text-stone-900 text-sm md:text-base leading-relaxed">
                                    {q.text}
                                    <span className="text-stone-400 ml-1 font-sans text-xs">
                                      {answers[q.id] ? `( ${answers[q.id]} )` : '(  )'}
                                    </span>
                                  </h3>

                                  {/* Optional context box (Q7 or Q20) */}
                                  {q.context && (
                                    <div className="bg-[#FFFDF3] border-l-3 border-amber-500 p-3 text-xs text-stone-700 rounded-r-lg my-2 font-serif leading-relaxed italic">
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
                        const q = haccpQuestions[currentCardIndex];
                        const isCorrect = answers[q.id] === q.correctAnswer;
                        const hasAnswered = answers[q.id] !== undefined;

                        return (
                          <div className="flex-1 flex flex-col">
                            <h3 className="font-serif font-bold text-stone-900 text-base md:text-lg leading-relaxed mb-3">
                              {q.id}. {q.text}
                            </h3>

                            {/* Context Situation */}
                            {q.context && (
                              <div className="bg-[#FFFDF3] border-l-4 border-amber-500 p-4 text-xs md:text-sm text-stone-700 rounded-r-xl my-3 font-serif leading-relaxed italic">
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

                              {currentCardIndex < haccpQuestions.length - 1 ? (
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
                      {haccpQuestions.map(q => {
                        const selectedNum = answers[q.id];
                        const isCorrect = answers[q.id] === q.correctAnswer;

                        return (
                          <div 
                            key={q.id} 
                            onClick={() => {
                              if (quizMode === 'card') {
                                setCurrentCardIndex(q.id - 1);
                              } else {
                                const el = document.getElementById(`q-paper-${q.id}`);
                                el?.scrollIntoView({ behavior: 'smooth' });
                              }
                            }}
                            className={`flex items-center justify-between p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                              quizMode === 'card' && currentCardIndex === q.id - 1
                                ? 'bg-amber-50/50 border border-amber-200' 
                                : 'hover:bg-stone-50 border border-transparent'
                            }`}
                          >
                            <span className="w-6 font-mono font-bold text-stone-500 text-center">
                              {q.id.toString().padStart(2, '0')}
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
                <p className="text-xs text-stone-400 mt-1">5초 이내에 비밀번호 1234를 입력해 주세요.</p>
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
      </AnimatePresence>

      {/* NOTE: Certificate issuance content has been removed by user request. */}

    </div>
  );
}
