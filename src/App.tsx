/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Loader2,
  Check,
  X,
  Trash2,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  CheckCircle2,
  Eye,
  AlertTriangle,
  Pencil
} from 'lucide-react';
import { HealthStatus, PigeonRecord } from './types';
import { STATUSES, STATUS_SOFT, QUICK_NOTES } from './constants';

const STORAGE_KEY = 'pigeon_health_records';
const DEMO_IDS = ['demo-1', 'demo-2']; // 舊版自動塞入的範例資料，不顯示給使用者
const VALID_STATUSES: HealthStatus[] = ['normal', 'attention', 'abnormal'];

type Stage = 'idle' | 'analyzing' | 'review';

interface Observation {
  ringNumber?: string;
  status?: HealthStatus;
  summary?: string;
}

const statusOf = (key?: HealthStatus | null) => STATUSES.find(s => s.key === key);

const StatusIcon = ({ status, className }: { status: HealthStatus; className?: string }) => {
  if (status === 'normal') return <CheckCircle2 className={className} />;
  if (status === 'attention') return <Eye className={className} />;
  return <AlertTriangle className={className} />;
};

const isToday = (iso: string) => {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

export default function App() {
  // --- 記錄內容 ---
  const [ringNumber, setRingNumber] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<HealthStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [records, setRecords] = useState<PigeonRecord[]>([]);

  // --- 畫面狀態 ---
  const [stage, setStage] = useState<Stage>('idle');
  const [observation, setObservation] = useState<Observation | null>(null);
  const [aiFailed, setAiFailed] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [listScope, setListScope] = useState<'today' | 'all'>('today');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);

  // --- 語音 ---
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const recognitionRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 4000);
  };

  // 讀取手機裡的紀錄（排除舊版範例資料，不再自動塞假資料）
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: PigeonRecord[] = JSON.parse(stored);
        setRecords(parsed.filter(r => !DEMO_IDS.includes(r.id)));
      }
    } catch (e) {
      console.error('Failed to load local storage:', e);
    }
  }, []);

  const saveRecords = (next: PigeonRecord[]): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setRecords(next);
      return true;
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
      return false;
    }
  };

  // 語音輸入（備註用）
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'zh-TW';
    rec.onstart = () => { setIsListening(true); setSpeechError(''); };
    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      if (text) appendNote(text);
    };
    rec.onerror = (e: any) => {
      setSpeechError(e.error === 'no-speech' ? '沒有聽到聲音，請靠近手機再說一次' : '語音沒聽清楚，可以直接點下面的常用詞');
      setIsListening(false);
    };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
  }, []);

  // 換畫面或離開時停止朗讀
  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, [observation]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast('這支手機不支援語音輸入，請點常用詞或打字');
      return;
    }
    if (isListening) recognitionRef.current.stop();
    else {
      try { setSpeechError(''); recognitionRef.current.start(); } catch (e) { console.error(e); }
    }
  };

  const toggleTTS = () => {
    if (!('speechSynthesis' in window)) {
      showToast('這支手機不支援語音朗讀');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const s = statusOf(selectedStatus);
    const ringPart = ringNumber ? `環號 ${ringNumber.split('').join(' ')}。` : '沒有讀到環號。';
    const statusPart = s ? `今天看起來：${s.label}。` : '';
    const summaryPart = observation?.summary || '';
    const u = new SpeechSynthesisUtterance(`${ringPart}${statusPart}${summaryPart}`);
    u.lang = 'zh-TW';
    u.rate = 0.85;
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  // --- 拍照 → 壓縮 → AI 整理 ---
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允許同一張重選
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => compressPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const compressPhoto = (src: string) => {
    setStage('analyzing');
    const img = new Image();
    img.onload = () => {
      const MAX = 600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const r = MAX / Math.max(width, height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const out = ctx ? (ctx.drawImage(img, 0, 0, width, height), canvas.toDataURL('image/jpeg', 0.65)) : src;
      setPhoto(out);
      analyzePhoto(out);
    };
    img.onerror = () => {
      setStage('idle');
      showToast('這張照片打不開，請再拍一次');
    };
    img.src = src;
  };

  const analyzePhoto = async (base64Image: string) => {
    setObservation(null);
    setAiFailed(false);
    try {
      const res = await fetch('/api/analyze-pigeon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image })
      });
      const data = await res.json();
      // 後端成功時 status 會是 normal / attention / abnormal（不是 'success'）
      if (res.ok && VALID_STATUSES.includes(data.status)) {
        const ring = typeof data.ringNumber === 'string' && data.ringNumber !== '無' ? data.ringNumber.trim().toUpperCase() : '';
        setObservation({ ringNumber: ring, status: data.status, summary: data.observationSummary });
        if (ring) setRingNumber(ring);
        setSelectedStatus(data.status);
        setShowEditor(!ring); // 沒讀到環號 → 直接打開修改區讓人補
      } else {
        setAiFailed(true);
        setShowEditor(true);
      }
    } catch (e) {
      console.error(e);
      setAiFailed(true);
      setShowEditor(true);
    } finally {
      setStage('review');
    }
  };

  const startManual = () => {
    setPhoto(null);
    setObservation(null);
    setAiFailed(false);
    setShowEditor(true);
    setStage('review');
  };

  const resetForm = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setRingNumber('');
    setSelectedStatus(null);
    setNotes('');
    setPhoto(null);
    setObservation(null);
    setAiFailed(false);
    setShowEditor(false);
    setStage('idle');
  };

  const handleSave = () => {
    if (!ringNumber.trim()) {
      setShowEditor(true);
      showToast('還沒有環號，請在下面輸入');
      document.getElementById('ring-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!selectedStatus) {
      setShowEditor(true);
      showToast('請選今天看起來怎麼樣');
      document.getElementById('status-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const rec: PigeonRecord = {
      id: 'rec-' + Date.now(),
      ringNumber: ringNumber.trim().toUpperCase(),
      status: selectedStatus,
      notes: notes.trim(),
      photoUrl: photo || undefined,
      timestamp: new Date().toISOString(),
      isActionRequired: selectedStatus !== 'normal'
    };
    if (saveRecords([rec, ...records])) {
      showToast(`已儲存 ${rec.ringNumber}`);
      resetForm();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showToast('手機空間不夠，這筆沒有存到。請先刪掉幾筆舊紀錄再存。');
    }
  };

  const handleDelete = (id: string, ring: string) => {
    if (window.confirm(`確定刪除 ${ring} 這筆紀錄？`)) {
      saveRecords(records.filter(r => r.id !== id));
      showToast(`已刪除 ${ring}`);
    }
  };

  const appendNote = (tag: string) => {
    setNotes(prev => (!prev ? tag : /[。！，,]$/.test(prev) ? prev + tag : prev + '，' + tag));
  };

  const pressKey = (val: string) => {
    if (val === '⌫') setRingNumber(p => p.slice(0, -1));
    else if (val === '清除') setRingNumber('');
    else if (val === 'TW-') setRingNumber(p => (p.startsWith('TW-') ? p : 'TW-' + p));
    else setRingNumber(p => (p.length >= 15 ? p : p + val));
  };

  const todayRecords = records.filter(r => isToday(r.timestamp));
  const shownRecords = listScope === 'today' ? todayRecords : records;
  const recentRings = Array.from(new Set(records.map(r => r.ringNumber))).slice(0, 6);
  const current = statusOf(selectedStatus);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 text-lg pb-16">
      {/* 提示訊息 */}
      {toast && (
        <div className="fixed top-3 inset-x-4 z-50 max-w-xl mx-auto" role="status">
          <div className="bg-stone-900 text-white rounded-2xl px-5 py-4 shadow-xl flex items-center gap-3">
            <p className="flex-1 text-lg font-bold leading-snug">{toast}</p>
            <button type="button" onClick={() => setToast('')} className="p-2 -m-2 text-stone-300" aria-label="關閉">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* 標題列 */}
      <header className="bg-amber-900 text-white">
        <div className="max-w-xl mx-auto px-4 py-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-wide">每日健康觀察記錄</h1>
            <p className="text-amber-100 text-base mt-0.5">拍一張照，就記好了</p>
          </div>
          <div className="text-center bg-white/10 rounded-2xl px-4 py-2 shrink-0">
            <div className="text-sm text-amber-100">今天已記</div>
            <div className="text-2xl font-black">{todayRecords.length} 羽</div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 mt-5 space-y-6">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handlePhotoUpload}
          accept="image/*"
          capture="environment"
          className="hidden"
        />

        {/* 第一畫面：只有一顆大拍照鈕 */}
        {stage === 'idle' && (
          <section className="space-y-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-3xl bg-amber-700 active:bg-amber-800 text-white shadow-lg py-12 flex flex-col items-center gap-4 select-none active:scale-[0.98] transition-transform"
            >
              <span className="bg-white/15 rounded-full p-6">
                <Camera className="w-16 h-16" strokeWidth={2.2} />
              </span>
              <span className="text-3xl font-black tracking-wider">拍照記錄</span>
              <span className="text-lg text-amber-100">拍鴿子或環號，系統幫你填</span>
            </button>
            <button
              type="button"
              onClick={startManual}
              className="w-full py-4 rounded-2xl border-2 border-stone-300 bg-white text-stone-700 font-bold text-lg active:bg-stone-100"
            >
              沒有照片，直接手動記錄
            </button>
          </section>
        )}

        {/* 分析中 */}
        {stage === 'analyzing' && (
          <section className="bg-white rounded-3xl border-2 border-amber-200 p-6 flex flex-col items-center gap-4 text-center">
            {photo && <img src={photo} alt="剛拍的照片" className="w-48 h-48 object-cover rounded-2xl" />}
            <Loader2 className="w-12 h-12 text-amber-700 animate-spin" />
            <p className="text-2xl font-black text-amber-900">正在看照片…</p>
            <p className="text-base text-stone-500">大約 5～10 秒</p>
          </section>
        )}

        {/* 確認畫面 */}
        {stage === 'review' && (
          <section className="bg-white rounded-3xl border-2 border-amber-200 shadow-sm overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex gap-4 items-start">
                {photo ? (
                  <img src={photo} alt="記錄照片" className="w-28 h-28 object-cover rounded-2xl border border-stone-200 shrink-0" />
                ) : (
                  <div className="w-28 h-28 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 text-base shrink-0">無照片</div>
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <div className="text-base text-stone-500">環號</div>
                    <div className={`text-2xl font-black font-mono break-all leading-tight ${ringNumber ? 'text-stone-900' : 'text-stone-300'}`}>
                      {ringNumber || '未填'}
                    </div>
                  </div>
                  {current ? (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-lg font-black ${current.bgClass}`}>
                      <StatusIcon status={current.key} className="w-5 h-5" />
                      {current.label}
                    </span>
                  ) : (
                    <span className="inline-block px-3 py-1.5 rounded-full bg-stone-100 text-stone-500 text-lg font-bold">狀態未選</span>
                  )}
                </div>
              </div>

              {aiFailed && (
                <p className="bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl p-4 font-bold">
                  照片沒有看清楚，請在下面手動填環號、選狀態。
                </p>
              )}

              {observation?.summary && (
                <div className="bg-stone-50 rounded-2xl p-4 space-y-3">
                  <p className="text-lg leading-relaxed">{observation.summary}</p>
                  <button
                    type="button"
                    onClick={toggleTTS}
                    className={`w-full py-3 rounded-xl font-black text-lg flex items-center justify-center gap-2 border-2 ${
                      isSpeaking ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-800 border-stone-300'
                    }`}
                  >
                    {isSpeaking ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    {isSpeaking ? '停止朗讀' : '唸給我聽'}
                  </button>
                </div>
              )}

              {current && current.warningAlert && (
                <div className={`rounded-2xl border-2 p-4 ${STATUS_SOFT[current.key]}`}>
                  <p className="font-bold leading-relaxed">{current.warningAlert}</p>
                </div>
              )}
            </div>

            {/* 修改／補充（預設收起） */}
            <button
              type="button"
              onClick={() => setShowEditor(v => !v)}
              className="w-full border-t-2 border-stone-100 px-5 py-4 flex items-center justify-between text-lg font-bold text-stone-700 active:bg-stone-50"
              aria-expanded={showEditor}
            >
              <span className="flex items-center gap-2"><Pencil className="w-5 h-5" />修改環號、狀態或寫備註</span>
              {showEditor ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>

            {showEditor && (
              <div className="px-5 pb-5 space-y-6 border-t-2 border-stone-100 pt-5">
                {/* 環號 */}
                <div id="ring-input" className="space-y-3">
                  <h2 className="text-xl font-black">環號</h2>
                  <input
                    type="text"
                    inputMode="text"
                    value={ringNumber}
                    onChange={e => setRingNumber(e.target.value.toUpperCase())}
                    placeholder="例如 TW-2026-8812"
                    className="w-full text-center py-3 text-3xl font-black font-mono tracking-wider bg-stone-50 border-2 border-stone-300 rounded-xl placeholder:text-stone-300 placeholder:text-xl focus:border-amber-600 outline-none"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'TW-', '0', '⌫'].map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => pressKey(k)}
                        className="h-14 rounded-xl bg-white border-2 border-stone-200 active:bg-amber-100 text-2xl font-black font-mono select-none"
                        aria-label={k === '⌫' ? '刪除一個字' : k}
                      >
                        {k}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => pressKey('清除')}
                      className="col-span-3 h-12 rounded-xl bg-stone-100 text-stone-600 font-bold flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-5 h-5" />全部清除
                    </button>
                  </div>
                  {recentRings.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-base text-stone-500">之前記過的：</div>
                      <div className="flex flex-wrap gap-2">
                        {recentRings.map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setRingNumber(r)}
                            className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 font-mono font-bold active:bg-amber-100"
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 狀態 */}
                <div id="status-picker" className="space-y-3">
                  <h2 className="text-xl font-black">今天看起來</h2>
                  <div className="grid grid-cols-3 gap-2">
                    {STATUSES.map(s => {
                      const on = selectedStatus === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setSelectedStatus(s.key)}
                          className={`rounded-2xl border-2 py-4 px-1 flex flex-col items-center gap-1.5 font-black text-lg select-none ${
                            on ? `${s.bgClass} text-white border-transparent shadow-md` : `${STATUS_SOFT[s.key]}`
                          }`}
                          aria-pressed={on}
                        >
                          <StatusIcon status={s.key} className="w-8 h-8" />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 備註 */}
                <div className="space-y-3">
                  <h2 className="text-xl font-black">備註（可不填）</h2>
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`w-full py-4 rounded-2xl font-black text-xl flex items-center justify-center gap-2 border-2 ${
                      isListening ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-stone-800 border-stone-300'
                    }`}
                  >
                    {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                    {isListening ? '正在聽，說完再點一下' : '用講的'}
                  </button>
                  {speechError && <p className="text-rose-700 font-bold text-base">{speechError}</p>}
                  <div className="flex flex-wrap gap-2">
                    {QUICK_NOTES.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => appendNote(t)}
                        className="px-3 py-2 rounded-xl bg-stone-100 active:bg-stone-200 font-bold text-base"
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="也可以直接打字"
                    className="w-full h-24 px-4 py-3 text-lg border-2 border-stone-300 rounded-2xl focus:border-amber-600 outline-none placeholder:text-stone-300"
                  />
                </div>
              </div>
            )}

            {/* 儲存／重來 */}
            <div className="p-5 pt-3 space-y-3 bg-stone-50 border-t-2 border-stone-100">
              <button
                type="button"
                onClick={handleSave}
                className="w-full py-5 rounded-2xl bg-emerald-600 active:bg-emerald-700 text-white font-black text-2xl tracking-widest shadow-md flex items-center justify-center gap-2 select-none"
              >
                <Check className="w-8 h-8" strokeWidth={3} />儲存
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="w-full py-3 rounded-2xl text-stone-600 font-bold text-lg active:bg-stone-200"
              >
                取消，重新拍
              </button>
            </div>
          </section>
        )}

        {/* 紀錄列表 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-2xl font-black">紀錄</h2>
            <div className="flex bg-stone-200 rounded-xl p-1" role="tablist">
              {([['today', `今天 ${todayRecords.length}`], ['all', `全部 ${records.length}`]] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={listScope === k}
                  onClick={() => setListScope(k)}
                  className={`px-4 py-2 rounded-lg font-bold text-base ${listScope === k ? 'bg-white shadow-sm text-stone-900' : 'text-stone-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {shownRecords.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-stone-300 p-8 text-center text-stone-500">
              {listScope === 'today' ? '今天還沒有紀錄，按上面「拍照記錄」開始' : '還沒有任何紀錄'}
            </div>
          ) : (
            <ul className="space-y-3">
              {shownRecords.map(rec => {
                const s = statusOf(rec.status);
                const d = new Date(rec.timestamp);
                const when = isToday(rec.timestamp)
                  ? d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
                  : d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) + ' ' + d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
                return (
                  <li key={rec.id} className={`bg-white rounded-2xl border-2 overflow-hidden ${s?.borderClass || 'border-stone-200'}`}>
                    <div className="p-4 flex gap-4">
                      {rec.photoUrl && (
                        <img src={rec.photoUrl} alt={`${rec.ringNumber} 照片`} className="w-24 h-24 object-cover rounded-xl shrink-0" />
                      )}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="text-2xl font-black font-mono tracking-wide break-all">{rec.ringNumber}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          {s && (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-base font-black ${STATUS_SOFT[s.key]}`}>
                              <StatusIcon status={s.key} className="w-4 h-4" />
                              {s.label}
                            </span>
                          )}
                          <span className="text-base text-stone-500">{when}</span>
                        </div>
                        {rec.notes && <p className="text-base leading-relaxed text-stone-700">{rec.notes}</p>}
                      </div>
                    </div>
                    <div className="border-t border-stone-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDelete(rec.id, rec.ringNumber)}
                        className="px-4 py-3 text-base font-bold text-stone-500 active:text-rose-700 flex items-center gap-1.5"
                      >
                        <Trash2 className="w-5 h-5" />刪除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 小提醒（收起） */}
        <details className="bg-white rounded-2xl border-2 border-stone-200 px-5 py-4">
          <summary className="font-bold text-lg cursor-pointer">怎麼拍比較清楚？</summary>
          <ul className="mt-3 space-y-2 text-base text-stone-700 leading-relaxed list-disc pl-5">
            <li>在光線夠的地方拍，不要逆光</li>
            <li>想讓系統讀環號，就把腳環拍近一點、拍正面</li>
            <li>外觀、站姿、大便樣子都可以拍，方便之後比對</li>
          </ul>
        </details>
      </main>

      <footer className="max-w-xl mx-auto px-4 mt-10 text-center text-sm text-stone-500 leading-relaxed">
        本工具只用於每日觀察記錄，不提供診斷、治療、獸醫判斷、比賽分析或下注用途。
      </footer>
    </div>
  );
}
