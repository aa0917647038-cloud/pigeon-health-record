/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Ban, 
  Droplet, 
  Frown, 
  Activity, 
  Camera, 
  Upload, 
  X, 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  Sparkles, 
  History,
  TrendingUp,
  Info,
  Mic,
  MicOff,
  Sparkle,
  Loader2,
  Check,
  RotateCcw,
  Volume2,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HealthStatus, PigeonRecord } from './types';
import { STATUSES, QUICK_NOTES } from './constants';

export default function App() {
  // --- Core States ---
  const [ringNumber, setRingNumber] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<HealthStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [records, setRecords] = useState<PigeonRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | HealthStatus>('all');
  
  // --- UI Modes & Helper States ---
  const [isSuccessToast, setIsSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [observationResult, setObservationResult] = useState<{
    ringNumber?: string;
    status?: HealthStatus;
    statusLabel?: string;
    observationSummary?: string;
    observationSteps?: string[];
  } | null>(null);

  // --- Voice / Speech Recognition States ---
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const recognitionRef = useRef<any>(null);

  // File input reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Voice Readout States & Effects for Elderly Helpers ---
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Stop any ongoing speech when the observation card changes or on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [observationResult]);

  const toggleTTS = () => {
    if (!('speechSynthesis' in window)) {
      alert('抱歉，您的手機/瀏覽器暫時不支援語音朗讀功能！');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      showToast('🔇 已停止語音朗讀。');
    } else {
      if (!observationResult) {
        showToast('⚠️ 目前沒有觀察內容可以朗讀。');
        return;
      }
      window.speechSynthesis.cancel();

      const ringPart = observationResult.ringNumber && observationResult.ringNumber !== '無'
        ? `記錄到的環號是：${observationResult.ringNumber}。`
        : '這張照片沒有清楚環號。';
      const statusPart = `這筆觀察分類是：${observationResult.statusLabel}。`;
      const summaryPart = observationResult.observationSummary || '';
      const stepsPart = observationResult.observationSteps && observationResult.observationSteps.length > 0
        ? `建議補記的步驟是：一，${observationResult.observationSteps[0] || ''}。二，${observationResult.observationSteps[1] || ''}。三，${observationResult.observationSteps[2] || ''}。`
        : '';

      const textToSpeak = `每日健康觀察記錄朗讀。${ringPart}${statusPart}${summaryPart}。${stepsPart}`;

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'zh-TW';
      utterance.rate = 0.85; // slightly slower for easy reading

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = (e) => {
        console.error('SpeechSynthesis utterance error:', e);
        setIsSpeaking(false);
      };

      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
      showToast('🔊 正在朗讀這筆觀察記錄。');
    }
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'zh-TW'; // Taiwan Mandarin

      rec.onstart = () => {
        setIsListening(true);
        setSpeechError('');
      };

      rec.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        if (resultText) {
          setNotes(prev => {
            if (!prev) return resultText;
            if (prev.endsWith('。') || prev.endsWith('！')) return prev + ' ' + resultText;
            return prev + '，' + resultText;
          });
          showToast(`🎤 錄音成功！已幫您寫上：「${resultText}」`);
        }
      };

      rec.onerror = (e: any) => {
        console.error('Speech error:', e);
        if (e.error === 'no-speech') {
          setSpeechError('老哥，大聲點，沒聽到聲音喔！');
        } else {
          setSpeechError('語音暫時聽不清，可以直接用點的喔！');
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Load records from LocalStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pigeon_health_records');
      if (stored) {
        setRecords(JSON.parse(stored));
      } else {
        const demoRecords: PigeonRecord[] = [
          {
            id: 'demo-1',
            ringNumber: 'TW-2026-8812',
            status: 'normal',
            notes: '吃飼料搶食第一，精神極佳，大便很乾亮。',
            timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
            isActionRequired: false
          },
          {
            id: 'demo-2',
            ringNumber: 'UN-2026-5301',
            status: 'abnormal',
            notes: '排泄物性狀變稀，精神稍微不好，已對其加強保暖並獨立看顧中。',
            timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
            isActionRequired: true
          }
        ];
        setRecords(demoRecords);
        localStorage.setItem('pigeon_health_records', JSON.stringify(demoRecords));
      }
    } catch (e) {
      console.error('Failed to load local storage:', e);
    }
  }, []);

  const saveRecords = (newRecords: PigeonRecord[]) => {
    setRecords(newRecords);
    try {
      localStorage.setItem('pigeon_health_records', JSON.stringify(newRecords));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  };

  // --- Voice Actions ---
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('抱歉，您的手機/瀏覽器暫時不支援錄音功能。請直接使用打字或右側常用詞按鈕！');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        setSpeechError('');
        recognitionRef.current.start();
      } catch (e) {
        console.error('Start listening error:', e);
      }
    }
  };

  // --- Photo Handling & Observation Helper ---
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Result = reader.result as string;
      compressAndSetPhoto(base64Result);
    };
    reader.readAsDataURL(file);
  };

  const compressAndSetPhoto = (base64Str: string) => {
    // If image is small enough, set it directly
    if (base64Str.length < 300 * 1024) {
      setPhoto(base64Str);
      triggerObservationAssist(base64Str);
      return;
    }

    // Downscale inside HTML Canvas for faster upload
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_SIZE = 600;

      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
        setPhoto(compressedBase64);
        triggerObservationAssist(compressedBase64);
      } else {
        setPhoto(base64Str);
        triggerObservationAssist(base64Str);
      }
    };
  };

  // Call the server helper to organize observation text
  const triggerObservationAssist = async (base64Data: string) => {
    setIsAnalyzingPhoto(true);
    setObservationResult(null);
    try {
      const response = await fetch('/api/analyze-pigeon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: base64Data })
      });
      const data = await response.json();

      if (data.status === 'success') {
        setObservationResult({
          ringNumber: data.ringNumber || undefined,
          status: data.status,
          statusLabel: data.statusLabel,
          observationSummary: data.observationSummary,
          observationSteps: data.observationSteps
        });

        // Fill what we can from the observation helper response
        if (data.ringNumber && data.ringNumber !== '無') {
          setRingNumber(data.ringNumber);
        }
        if (data.status) {
          setSelectedStatus(data.status);
        }
        showToast('已整理照片內容，並帶入環號與觀察分類。');
      } else {
        showToast('⚠️ 這張照片沒有整理成功，您可以直接手動完成記錄。');
      }
    } catch (e) {
      console.error(e);
      showToast('⚠️ 目前無法自動整理，請直接手動完成記錄。');
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        compressAndSetPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // --- Form Submissions ---
  const handleSubmitRecord = (e: React.FormEvent) => {
    e.preventDefault();

    if (!ringNumber.trim()) {
      showToast('⚠️ 請先輸入或是拍張「環號」(如：8812)！');
      const element = document.getElementById('section-ring-number');
      element?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (!selectedStatus) {
      showToast('⚠️ 請點選中間的「今日觀察分類」大按鈕！');
      const element = document.getElementById('section-health-status');
      element?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const newRecord: PigeonRecord = {
      id: 'rec-' + Date.now(),
      ringNumber: ringNumber.trim().toUpperCase(),
      status: selectedStatus,
      notes: notes.trim(),
      photoUrl: photo || undefined,
      timestamp: new Date().toISOString(),
      isActionRequired: selectedStatus !== 'normal'
    };

    const updated = [newRecord, ...records];
    saveRecords(updated);

    showToast(`✅ 已記錄！環號 [${newRecord.ringNumber}] 儲存成功於本日紀錄本中。`);

    // Reset except the list of course
    setRingNumber('');
    setSelectedStatus(null);
    setNotes('');
    setPhoto(null);
    setObservationResult(null);
  };

  const handleDeleteRecord = (id: string, ring: string) => {
    if (window.confirm(`確定要刪除環號 ${ring} 的此筆紀錄嗎？`)) {
      const filtered = records.filter(r => r.id !== id);
      saveRecords(filtered);
      showToast(`🗑️ 已扣除環號 ${ring} 的紀錄。`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setIsSuccessToast(true);
    setTimeout(() => {
      setIsSuccessToast(false);
    }, 4500);
  };

  // --- Custom Big-Screen Keypad for Fast Typing ---
  const handleKeypadPress = (val: string) => {
    if (val === '⌫') {
      setRingNumber(prev => prev.slice(0, -1));
    } else if (val === 'TW-') {
      setRingNumber(prev => {
        if (prev.startsWith('TW-')) return prev;
        return 'TW-' + prev;
      });
    } else if (val === '重填') {
      setRingNumber('');
    } else {
      setRingNumber(prev => {
        if (prev.length >= 15) return prev; // realistic constraint
        return prev + val;
      });
    }
  };

  // Quick preset actions
  const appendQuickNote = (tag: string) => {
    setNotes(prev => {
      if (!prev) return tag;
      if (prev.endsWith('。') || prev.endsWith('！') || prev.endsWith('，')) return prev + tag;
      return prev + '，' + tag;
    });
  };

  // Group status helper
  const activeStatusDetails = STATUSES.find(s => s.key === selectedStatus);

  const filteredRecords = statusFilter === 'all'
    ? records
    : records.filter(rec => rec.status === statusFilter);

  return (
    <div id="pigeon-main-container" className="min-h-screen pb-24 bg-[#FAF8F5] text-amber-950 font-sans">
      
      {/* Dynamic Toast Alerts */}
      <AnimatePresence>
        {isSuccessToast && (
          <motion.div 
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.9 }}
            className="fixed top-6 left-4 right-4 z-50 text-center max-w-xl mx-auto"
          >
            <div className="bg-amber-900 text-white rounded-2xl p-4 shadow-2xl border-2 border-amber-300 flex items-start text-left gap-3">
              <span className="text-2xl shrink-0">📢</span>
              <p className="text-base sm:text-lg font-bold leading-normal flex-1">
                {toastMessage}
              </p>
              <button 
                onClick={() => setIsSuccessToast(false)} 
                className="shrink-0 p-1 bg-amber-800 text-amber-200 rounded-lg hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Friendly Banner Header */}
      <header className="bg-gradient-to-r from-amber-800 to-amber-950 text-white shadow-md relative overflow-hidden border-b-4 border-amber-600">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="max-w-4xl mx-auto py-8 px-4 relative z-10 text-center sm:text-left sm:flex sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-600/40 border border-amber-500/50 text-xs font-bold text-amber-200 uppercase tracking-widest animate-pulse">
              簡單記錄・快速查看
            </span>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2 text-white">
              每日健康觀察記錄
            </h1>
            <p className="text-amber-100/90 text-sm mt-2 font-semibold">
              「健康觀察記錄表」— 拍照、點選、寫幾句，馬上留下今天的觀察紀錄。
            </p>
          </div>

          <div className="mt-4 sm:mt-0 flex gap-2 justify-center">
            <div className="bg-white/10 border border-white/20 backdrop-blur-xs py-2 px-5 rounded-2xl text-center">
              <span className="block text-xs font-bold text-amber-200">本日登記數</span>
              <span className="text-2xl font-black text-white">{records.length} 羽</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content viewport */}
      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-8">

        {/* Action Panel */}
        <div className="bg-white rounded-3xl border-2 border-amber-200 p-5 md:p-8 shadow-sm space-y-8">
          
          {/* ACTION 1: PHOTO / UPLOAD AREA */}
          <div id="uploader-container" className="space-y-3">
            <h2 className="text-2xl font-extrabold text-amber-950 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-700 text-white text-base font-bold">1</span>
              第一件事（可先做）：拍照留存
            </h2>
            <p className="text-amber-800 text-base font-medium">
              先拍照留存，之後回看今天的變化會更清楚。
            </p>

            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className="border-3 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/20 hover:bg-amber-50/50 transition-all rounded-2xl p-6 text-center cursor-pointer relative"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload} 
                accept="image/*" 
                capture="environment" // direct phone camera access
                className="hidden" 
              />

              {photo ? (
                <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                  <img 
                    src={photo} 
                    alt="相片" 
                    className="w-56 h-56 object-cover rounded-2xl border-4 border-amber-200 shadow-md" 
                  />
                  <button
                    type="button"
                    onClick={() => { setPhoto(null); setObservationResult(null); }}
                    className="absolute -top-3 -right-3 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 shadow-lg hover:scale-110 active:scale-90 transition-transform cursor-pointer"
                    title="刪除這張並重拍"
                  >
                    <X className="w-5 h-5 stroke-[3px]" />
                  </button>
                  <div className="mt-2.5 text-xs text-amber-900 font-bold bg-amber-100 py-1 px-3 rounded-full inline-block">
                    👍 照片已加入今天的記錄
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                  <div className="p-4 bg-amber-100/80 text-amber-800 rounded-full">
                    <Camera className="w-10 h-10 animate-bounce" />
                  </div>
                  <h3 className="text-xl font-extrabold text-amber-900">
                    📸 點我「拍張照」或者「選張相片」
                  </h3>
                  <p className="text-sm text-amber-700 font-bold max-w-md">
                    可以拍外觀、排泄物樣子或環號，方便今天留存。
                  </p>
                </div>
              )}

              {/* Loader overlay */}
              {isAnalyzingPhoto && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center space-y-3 p-4">
                  <Loader2 className="w-12 h-12 text-amber-600 animate-spin" />
                  <p className="text-lg font-black text-amber-900 animate-pulse">
                    正在整理照片內容與環號... 請稍等一下！
                  </p>
                  <p className="text-xs text-amber-600">
                    系統會先幫您補上觀察摘要，之後仍可手動修改
                  </p>
                </div>
              )}
            </div>

            {/* Auto-filled observation card */}
            <AnimatePresence>
              {observationResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-gradient-to-br from-amber-50 to-amber-100/90 border-2 border-amber-400 rounded-2xl p-5 shadow-sm space-y-3.5"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-2xl mt-0.5">📝</span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/60 pb-3 mb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-black text-amber-950">照片觀察整理：</span>
                          {observationResult.ringNumber && observationResult.ringNumber !== '無' && (
                            <span className="bg-amber-600 text-white font-mono font-extrabold text-sm px-2.5 py-1 rounded-md">
                              讀到環號：{observationResult.ringNumber}
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full ${
                            observationResult.status === 'normal' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            觀察分類：{observationResult.statusLabel}
                          </span>
                        </div>

                        {/* Speech Synthesis Play/Stop Button */}
                        <button
                          type="button"
                          onClick={toggleTTS}
                          className={`w-full sm:w-auto px-4 py-2.5 rounded-2xl text-base font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all select-none border-2 ${
                            isSpeaking 
                            ? 'bg-red-600 text-white border-red-800 hover:bg-red-700 animate-pulse' 
                            : 'bg-amber-200 text-amber-950 border-amber-300 hover:bg-amber-300'
                          }`}
                        >
                          {isSpeaking ? (
                            <>
                              <VolumeX className="w-5 h-5 shrink-0" />
                              <span>🔇 停止語音朗讀</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-5 h-5 shrink-0" />
                              <span>📢 朗讀記錄</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-amber-900 text-lg font-bold mt-2.5 leading-relaxed bg-white/70 p-3 rounded-xl border border-amber-200/50">
                        「{observationResult.observationSummary}」
                      </p>

                      {observationResult.observationSteps && observationResult.observationSteps.length > 0 && (
                        <div className="mt-3.5 space-y-1">
                          <span className="text-xs text-amber-800 font-extrabold block">⏳ 建議補記步驟：</span>
                          <ul className="space-y-1">
                            {observationResult.observationSteps.map((adv, aIdx) => (
                              <li key={aIdx} className="text-sm font-bold text-amber-900 flex items-start gap-1">
                                <span className="text-amber-600">•</span>
                                <span>{adv}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <hr className="border-amber-100" />

          {/* ACTION 2: ENTER RING NUMBER */}
          <div id="section-ring-number" className="space-y-3">
            <h2 className="text-2xl font-extrabold text-amber-950 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-700 text-white text-base font-bold">2</span>
              第二件事：確認「環號」
            </h2>
            <p className="text-amber-800 text-base font-medium">
              請先輸入環號，方便之後回頭查看。可以直接用下面「超大按鍵」點擊，就不用打字了！
            </p>

            <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 sm:p-6 space-y-4">
              
              {/* Dynamic Read Only Large Output Display */}
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  value={ringNumber}
                  onChange={(e) => setRingNumber(e.target.value)}
                  placeholder="環號顯示在此"
                  className="w-full text-center py-3.5 text-3xl font-black tracking-widest bg-white border-2 border-amber-300 rounded-xl uppercase text-amber-950 shadow-inner"
                  style={{ fontSize: '2.25rem' }}
                />
                
                {ringNumber && (
                  <button
                    type="button"
                    onClick={() => setRingNumber('')}
                    className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 shrink-0 cursor-pointer active:scale-95 transition-all"
                    title="清空"
                  >
                    <RotateCcw className="w-8 h-8" />
                  </button>
                )}
              </div>

              {/* Dedicated Custom Big Numeric Keypad designed for bulky fingers */}
              <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
                {['1', '2', '3', 'TW-'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleKeypadPress(val)}
                    className="py-4 bg-white active:bg-amber-200 border-2 border-amber-200 rounded-xl font-mono text-2xl font-black text-amber-950 shadow-xs cursor-pointer select-none transition-transform active:scale-95"
                  >
                    {val}
                  </button>
                ))}
                {['4', '5', '6', 'UN-'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleKeypadPress(val)}
                    className="py-4 bg-white active:bg-amber-200 border-2 border-amber-200 rounded-xl font-mono text-2xl font-black text-amber-950 shadow-xs cursor-pointer select-none transition-transform active:scale-95"
                  >
                    {val}
                  </button>
                ))}
                {['7', '8', '9', '2026-'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleKeypadPress(val)}
                    className="py-4 bg-white active:bg-amber-200 border-2 border-amber-200 rounded-xl font-mono text-2xl font-black text-amber-950 shadow-xs cursor-pointer select-none transition-transform active:scale-95"
                  >
                    {val}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleKeypadPress('重填')}
                  className="py-4 col-span-2 bg-[#FCE8E6] text-[#A62719] hover:bg-rose-100 font-extrabold text-xl border-2 border-rose-200 rounded-xl shadow-xs cursor-pointer select-none"
                >
                  重填
                </button>
                {['0', '⌫'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleKeypadPress(val)}
                    className={`py-4 rounded-xl text-2xl font-black shadow-xs cursor-pointer select-none transition-transform active:scale-95 ${
                      val === '⌫' 
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-2 border-amber-300' 
                      : 'bg-white hover:bg-amber-50 text-amber-950 border-2 border-amber-200'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>

              {/* Fast presets click options */}
              {records.length > 0 && (
                <div className="pt-2 text-center">
                  <span className="text-sm font-bold text-amber-800">直接選取今天已記過的環號：</span>
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {Array.from(new Set(records.map(r => r.ringNumber))).slice(0, 6).map((ringVal, rIdx) => (
                      <button
                        key={rIdx}
                        type="button"
                        onClick={() => setRingNumber(ringVal)}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl text-base font-black transition-all active:scale-95"
                      >
                        🐦 {ringVal}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <hr className="border-amber-100" />

          {/* ACTION 3: CHOOSE TODAY'S HEALTH STATUS */}
          <div id="section-health-status" className="space-y-3">
            <h2 className="text-2xl font-extrabold text-amber-950 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-700 text-white text-base font-bold">3</span>
              第三件事：選今天的觀察分類
            </h2>
            <p className="text-amber-800 text-base font-medium">
              今天這一羽看起來如何？<span className="text-amber-950 underline font-black">按鍵很大，按錯可以隨時切換</span>：
            </p>

            {/* Custom high-contrast massive status button block */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {STATUSES.map((status) => {
                const isSelected = selectedStatus === status.key;
                
                // Color mapping for extreme visual contrast
                let themeClass = '';
                if (isSelected) {
                  if (status.key === 'normal') themeClass = 'bg-emerald-600 border-emerald-800 text-white shadow-xl scale-[1.03] duration-150';
                  else if (status.key === 'attention') themeClass = 'bg-amber-500 border-amber-700 text-white shadow-xl scale-[1.03] duration-150';
                  else if (status.key === 'abnormal') themeClass = 'bg-rose-600 border-rose-800 text-white shadow-xl scale-[1.03] duration-150';
                } else {
                  if (status.key === 'normal') themeClass = 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100';
                  else if (status.key === 'attention') themeClass = 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100';
                  else if (status.key === 'abnormal') themeClass = 'bg-rose-50 text-rose-950 border-rose-300 hover:bg-rose-100';
                }

                const getIcon = () => {
                  switch (status.iconName) {
                    case 'CheckCircle2': return <CheckCircle2 className="w-10 h-10 shrink-0" />;
                    case 'Frown': return <Frown className="w-10 h-10 shrink-0" />;
                    case 'Activity': return <Activity className="w-10 h-10 shrink-0" />;
                    default: return <CheckCircle2 className="w-10 h-10" />;
                  }
                };

                return (
                  <button
                    key={status.key}
                    type="button"
                    onClick={() => {
                      setSelectedStatus(status.key);
                    }}
                    className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-3xl border-3 text-center cursor-pointer transition-all active:scale-95 text-xl font-black h-34 sm:h-38 w-full select-none ${themeClass}`}
                  >
                    <div className="mb-2.5">{getIcon()}</div>
                    <span className="text-xl sm:text-2xl tracking-wide">{status.label}</span>
                    <span className={`text-xs font-semibold mt-1 leading-tight block ${isSelected ? 'text-white/80' : 'text-amber-800/60'}`}>
                      {status.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Observation context matched to manual selection */}
            <AnimatePresence>
              {selectedStatus && activeStatusDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-4"
                >
                  <div className={`rounded-2xl p-4 border-2 ${
                    selectedStatus === 'normal' 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}>
                    {selectedStatus === 'normal' ? (
                      <div className="flex items-start gap-2.5">
                        <span className="text-2xl mt-0.5">🟢</span>
                        <div>
                          <h4 className="text-lg font-black">太棒了！今天沒異狀。</h4>
                          <p className="text-sm text-emerald-800 font-bold mt-1">照常把今天的照片和備註留存下來就可以。</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2.5">
                        <span className="text-2xl mt-0.5">⚠️</span>
                        <div>
                          <h4 className="text-lg font-black">【已選擇：{activeStatusDetails.label}】</h4>
                          <p className="text-base text-rose-900 font-bold mt-1 leading-relaxed">
                            {activeStatusDetails.warningAlert}
                          </p>
                          <div className="mt-3 bg-white/70 p-3 rounded-xl border border-rose-200">
                            <span className="text-xs font-extrabold text-rose-800 block mb-1">💡 建議補記的內容：</span>
                            <ul className="space-y-0.5">
                              {activeStatusDetails.quickAdvice.map((adv, key) => (
                                <li key={key} className="text-sm font-bold text-rose-950 flex items-start gap-1">
                                  <span>•</span>
                                  <span>{adv}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <hr className="border-amber-100" />

          {/* ACTION 4: VOICE RECORD NOTE / SPEAK NOTES */}
          <div id="section-speech-notes" className="space-y-3">
            <h2 className="text-2xl font-extrabold text-amber-950 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-700 text-white text-base font-bold">4</span>
              第四件事：今天看到什麼？
            </h2>
            <p className="text-amber-800 text-base font-medium">
              如果你不想打字，<span className="text-amber-950 underline font-black">點擊下方麥克風，直接說說看到的特徵（例如：進食較少、精神稍微不振等）</span>即可：
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Voice button card */}
              <div className="md:col-span-1 flex flex-col justify-center">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`w-full py-6 px-4 rounded-3xl border-3 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-150 select-none ${
                    isListening 
                    ? 'bg-rose-600 hover:bg-rose-700 border-rose-800 text-white animate-pulse' 
                    : 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-950'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-10 h-10 shrink-0" />
                      <span className="text-xl font-black">🎙️ 正在聽...點我結束</span>
                      <span className="text-xs text-rose-100">講完後會自動寫入輸入框喔！</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-10 h-10 shrink-0 text-amber-800" />
                      <span className="text-xl font-black">🎙️ 點我「開始講話」</span>
                      <span className="text-xs text-amber-800/60">免麻煩打字 • 說完會自動寫成字</span>
                    </>
                  )}
                </button>
                
                {speechError && (
                  <p className="text-center text-sm font-black text-rose-600 mt-2 bg-rose-50 py-1.5 px-3 rounded-lg border border-rose-200">
                    {speechError}
                  </p>
                )}
              </div>

              {/* Text Area Memo display */}
              <div className="md:col-span-2 space-y-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="例如：吃比較少、精神差、糞便變稀、有拍照留存"
                  className="w-full h-28 px-4 py-3 text-lg font-bold placeholder-amber-200 border-2 border-amber-300 rounded-2xl focus:border-amber-600 outline-none text-amber-950 bg-white"
                />

                {/* Quick note presets tag lists */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="text-xs text-amber-800 font-extrabold flex items-center gap-1 shrink-0 w-full mb-1">
                    💡 手指直接「點一下」帶入常用備註：
                  </span>
                  {QUICK_NOTES.map((noteTag, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => appendQuickNote(noteTag)}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 rounded-lg text-sm font-black text-amber-900 border border-amber-300 shadow-xs cursor-pointer select-none transition-colors"
                    >
                      +{noteTag}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          <hr className="border-amber-100" />

          {/* SUBMIT RECORD BUTTON SECTION */}
          <div className="pt-2 text-center" id="submit-section">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmitRecord}
              className="w-full sm:max-w-md py-5 px-8 rounded-3xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-2xl tracking-widest border-2 border-emerald-800 shadow-lg shadow-emerald-100 cursor-pointer active:scale-95 transition-all select-none"
            >
              💾 好了！儲存這一筆觀察記錄
            </motion.button>
            <p className="text-xs text-amber-600/70 font-semibold mt-2.5">
              儲存後，紀錄會放於下方資料表格中，可以隨時查看。
            </p>
          </div>

        </div>

        {/* LOGO STATS BOARD */}
        <section id="historical-log" className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-2xl font-black text-amber-950 flex items-center gap-2">
              <History className="w-6 h-6 text-amber-900" />
              📋 今日觀察記錄 ({records.length} 筆)
            </h3>
            {records.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('確定要把今天所有紀錄清空重來嗎？')) {
                    saveRecords([]);
                    setObservationResult(null);
                    showToast('🗑️ 今日紀錄本已清空完畢。');
                  }
                }}
                className="text-sm font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
              >
                重整清空整本
              </button>
            )}
          </div>

          {records.length > 0 && (
            <div className="bg-amber-50/50 p-2.5 rounded-2xl border border-amber-200/40 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <span className="text-sm font-extrabold text-amber-900 shrink-0">依狀態篩選：</span>
              <div className="flex flex-wrap gap-2 w-full justify-start">
                {[
                  { key: 'all', label: '全部' },
                  { key: 'normal', label: '正常' },
                  { key: 'attention', label: '需要留意' },
                  { key: 'abnormal', label: '再觀察' }
                ].map((btn) => {
                  const isSelected = statusFilter === btn.key;
                  let bgClass = 'bg-white text-amber-950 border-amber-200 hover:bg-amber-50';
                  if (isSelected) {
                    if (btn.key === 'all') bgClass = 'bg-amber-800 text-white border-amber-950';
                    else if (btn.key === 'normal') bgClass = 'bg-emerald-600 text-white border-emerald-800';
                    else if (btn.key === 'attention') bgClass = 'bg-amber-500 text-white border-amber-700';
                    else if (btn.key === 'abnormal') bgClass = 'bg-rose-600 text-white border-rose-800';
                  }
                  
                  // items count matching this status
                  const count = btn.key === 'all' 
                    ? records.length 
                    : records.filter(r => r.status === btn.key).length;

                  return (
                    <button
                      key={btn.key}
                      type="button"
                      onClick={() => setStatusFilter(btn.key as any)}
                      className={`px-3 py-1.5 rounded-xl border text-sm font-extrabold flex items-center gap-1.5 transition-all select-none cursor-pointer active:scale-95 ${bgClass}`}
                    >
                      {btn.key === 'normal' && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
                      {btn.key === 'attention' && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                      {btn.key === 'abnormal' && <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />}
                      <span>{btn.label}</span>
                      <span className="text-xs font-mono opacity-85 px-1.5 py-0.2 rounded-md bg-amber-100/30">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {records.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border-2 border-amber-200 text-amber-800 font-bold shadow-inner">
              <Sparkles className="w-12 h-12 text-amber-300 mx-auto mb-3" />
              <p className="text-lg">今天還沒有添加任何日常觀察紀錄。</p>
              <p className="text-sm text-amber-500 font-medium mt-1">請依照上面步驟拍照、選分類、補備註，完成今天的第一筆觀察記錄。</p>
            </div>
          ) : (
            <>
              {filteredRecords.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-amber-300 text-amber-700 font-semibold shadow-inner">
                  <Info className="w-8 h-8 text-amber-400 mx-auto mb-2 animate-bounce" />
                  <p>目前沒有「{statusFilter === 'all' ? '全部' : STATUSES.find(s => s.key === statusFilter)?.label}」分類下的觀察紀錄喔！</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRecords.map((rec) => {
                    const statusConfig = STATUSES.find(s => s.key === rec.status);
                    const isNormal = rec.status === 'normal';
                    
                    // Formatted clock
                    const timeString = new Date(rec.timestamp).toLocaleTimeString('zh-TW', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div
                        key={rec.id}
                        className={`bg-white rounded-2xl border-2 p-5 flex flex-col justify-between relative shadow-sm hover:shadow-md transition-all ${
                          isNormal ? 'border-emerald-300' : 'border-rose-400 abnormal-pigeon-card-pulse'
                        }`}
                      >
                        {/* Visual warning border line */}
                        <div className={`absolute top-0 left-0 right-0 h-1.5 ${isNormal ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                        
                        <div>
                          {/* Ring Number block */}
                          <div className="flex justify-between items-center mb-2.5 mt-1">
                            <span className="text-2xl font-black font-mono tracking-wider text-amber-950 flex items-center gap-1.5">
                              {!isNormal && <AlertTriangle className="w-6 h-6 text-rose-600 animate-pulse shrink-0" />}
                              🏷️ 登記環號：{rec.ringNumber}
                            </span>
                            <span className="text-xs text-gray-400 font-mono font-bold bg-amber-50 py-0.5 px-2 rounded border border-amber-100">
                              {timeString} 登記
                            </span>
                          </div>

                          {/* Health Status Title Badge */}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-base font-black border ${
                              isNormal 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}>
                              狀態：{statusConfig?.label || '未知'}
                            </span>

                            {!isNormal && (
                              <span className="animate-pulse bg-red-100 border border-red-300 text-red-900 text-xs font-black px-2.5 py-1 rounded-md flex items-center gap-1">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                                </span>
                                <span>⚠️ 今天差異較多，建議多補幾筆觀察內容</span>
                              </span>
                            )}
                          </div>

                          {/* Photo preview inside record index */}
                          {rec.photoUrl && (
                            <div className="mb-3">
                              <img 
                                src={rec.photoUrl} 
                                alt="紀錄照片" 
                                className="w-full max-h-44 object-cover rounded-xl border border-amber-200 mt-1" 
                              />
                            </div>
                          )}

                          {/* Memo Remarks */}
                          {rec.notes ? (
                            <div className="mb-3.5 bg-amber-50/50 p-3 rounded-xl border border-amber-200/40 text-sm font-semibold text-amber-950 leading-relaxed">
                              <span className="text-xs text-amber-700 block font-bold mb-0.5">觀察備註：</span>
                              {rec.notes}
                            </div>
                          ) : (
                            <p className="text-xs italic text-gray-400 mb-3.5">無任何加註</p>
                          )}

                          {/* Observation reminder matched inside historical list */}
                          {!isNormal && statusConfig && (
                            <div className="mt-2 text-xs bg-rose-50/60 text-rose-950 p-3 rounded-xl border border-rose-200/50 space-y-1">
                              <span className="font-extrabold text-rose-800 block">💡 回看時可比對的重點：</span>
                              <ul className="list-disc list-inside text-rose-900 font-medium pl-1">
                                {statusConfig.quickAdvice.map((advItem, advIdx) => (
                                  <li key={advIdx}>{advItem}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Delete action footer */}
                        <div className="pt-3 border-t border-gray-100 mt-3 flex justify-between items-center text-xs">
                          <span className="text-[10px] text-amber-800/60 font-medium font-mono">ID: {rec.id}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(rec.id, rec.ringNumber)}
                            className="text-xs font-black text-rose-600 hover:text-rose-800 flex items-center gap-1 hover:bg-rose-50 py-1.5 px-3 rounded-lg border border-transparent hover:border-rose-200 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" /> 點此刪除此筆
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* Observation notes section */}
        <section className="bg-amber-100/40 border-2 border-amber-200 rounded-3xl p-6 md:p-8 space-y-4">
          <h3 className="text-xl font-bold text-amber-950 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-800" />
            💡 每日觀察記錄小提醒
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4.5 rounded-2xl border border-amber-200/60 shadow-xs">
              <span className="font-extrabold text-amber-900 text-base block mb-1">👀 外觀怎麼記</span>
              <p className="text-xs text-amber-800 leading-relaxed font-semibold">
                可以記下羽毛是否貼身、站姿是否和平常一樣、眼神是否清楚，方便之後前後比對。
              </p>
            </div>
            <div className="bg-white p-4.5 rounded-2xl border border-amber-200/60 shadow-xs">
              <span className="font-extrabold text-amber-900 text-base block mb-1">📷 照片怎麼拍</span>
              <p className="text-xs text-amber-800 leading-relaxed font-semibold">
                建議在光線足夠時拍，盡量拍清楚外觀、排泄物樣子或環號，後續回看會更容易。
              </p>
            </div>
            <div className="bg-white p-4.5 rounded-2xl border border-amber-200/60 shadow-xs">
              <span className="font-extrabold text-amber-900 text-base block mb-1">🗒️ 備註怎麼寫</span>
              <p className="text-xs text-amber-800 leading-relaxed font-semibold">
                備註只要寫下今天看到的重點，例如食量、活動、外觀或照片時間，不需要寫成專業報告。
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER METADATA */}
      <footer className="text-center text-amber-800/60 text-xs mt-16 max-w-xl mx-auto px-4 font-bold leading-relaxed space-y-2">
        <p>每日健康觀察記錄 © 2026 • 簡單記錄・快速查看</p>
        <p className="text-amber-800/80 bg-amber-100/50 p-2.5 rounded-xl border border-amber-200">
          ⚠️ 本工具只用於每日健康觀察記錄，不提供診斷、治療、疾病判斷、獸醫判斷、比賽分析或下注用途。
        </p>
      </footer>

    </div>
  );
}
