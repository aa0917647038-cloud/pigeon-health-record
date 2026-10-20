import React, { useState } from 'react';
import { Plus, Minus, Check, Trash2, Pill, Syringe, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { CarePlan, PlanKind } from '../types';
import { PLAN_KINDS, CARE_DISCLAIMER } from '../constants';
import {
  TodoItem,
  PlanLevel,
  groupPlans,
  describeStatus,
  formatShortDate,
  validatePlanInput,
  isDuplicatePlan,
  createPlan,
  getDueDate
} from '../lib/reminders';

// 提醒卡片的顏色（刻意不用綠／黃／紅「健康狀態」那一組意義，只用來分急不急）
const LEVEL_STYLE: Record<PlanLevel, { card: string; badge: string; text: string }> = {
  overdue: { card: 'border-rose-400 bg-rose-50', badge: 'bg-rose-600 text-white', text: '已過期' },
  today: { card: 'border-amber-500 bg-amber-50', badge: 'bg-amber-600 text-white', text: '今天' },
  tomorrow: { card: 'border-sky-400 bg-sky-50', badge: 'bg-sky-600 text-white', text: '明天' },
  week: { card: 'border-sky-200 bg-white', badge: 'bg-sky-100 text-sky-900', text: '這週內' },
  later: { card: 'border-stone-200 bg-white', badge: 'bg-stone-100 text-stone-700', text: '之後' },
  done: { card: 'border-stone-200 bg-stone-50', badge: 'bg-stone-200 text-stone-700', text: '已處理' }
};

interface TodoCardProps {
  item: TodoItem;
  onToggleDone: (id: string) => void;
  onDelete?: (id: string) => void; // 首頁的小卡不放刪除
}

/** 一張提醒卡片：用藥疫苗頁和首頁「今天要做的事」共用 */
export function TodoCard({ item, onToggleDone, onDelete }: TodoCardProps) {
  const { plan, status } = item;
  const cfg = PLAN_KINDS[plan.kind];
  const style = LEVEL_STYLE[status.level];
  const isDone = status.level === 'done';
  const detail =
    plan.kind === 'medication'
      ? `第一天 ${formatShortDate(plan.startDate)}，連續 ${plan.days} 天`
      : `${formatShortDate(plan.startDate)} 接種，${plan.days} 天後補打`;

  return (
    <li className={`rounded-2xl border-2 p-4 space-y-3 ${style.card}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-3 py-1 rounded-full text-base font-black ${style.badge}`}>{style.text}</span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-stone-300 text-base font-bold text-stone-700">
          {plan.kind === 'medication' ? <Pill className="w-4 h-4" /> : <Syringe className="w-4 h-4" />}
          {cfg.label}
        </span>
        <span className="text-lg font-black break-all">{plan.batchName}</span>
      </div>
      <div className="text-xl font-black break-all">{plan.name}</div>
      <div className="space-y-0.5">
        <div className="text-lg font-bold">
          {cfg.dueLabel}：{formatShortDate(status.dueDate)}（{describeStatus(status)}）
        </div>
        <div className="text-base text-stone-600">{detail}</div>
        {isDone && plan.doneAt && (
          <div className="text-base text-stone-500">
            {new Date(plan.doneAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} 已處理
          </div>
        )}
      </div>
      <div className="flex gap-2">
        {isDone ? (
          <button
            type="button"
            onClick={() => onToggleDone(plan.id)}
            className="flex-1 py-3 rounded-xl border-2 border-stone-300 bg-white text-stone-700 font-bold text-lg flex items-center justify-center gap-2 active:bg-stone-100"
          >
            <RotateCcw className="w-5 h-5" />改回還沒做
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggleDone(plan.id)}
            className="flex-1 py-4 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white font-black text-xl flex items-center justify-center gap-2 select-none"
          >
            <Check className="w-6 h-6" strokeWidth={3} />做完了
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(plan.id)}
            className="px-4 py-3 rounded-xl text-stone-500 font-bold text-base flex items-center gap-1.5 active:text-rose-700"
            aria-label={`刪除 ${plan.batchName} ${plan.name}`}
          >
            <Trash2 className="w-5 h-5" />刪除
          </button>
        )}
      </div>
    </li>
  );
}

interface MedicationPageProps {
  plans: CarePlan[];
  today: string; // YYYY-MM-DD，手機當地日期
  onAdd: (plan: CarePlan) => boolean; // 回 false 代表手機空間不夠沒存到
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
  notify: (msg: string) => void;
}

export default function MedicationPage({ plans, today, onAdd, onToggleDone, onDelete, notify }: MedicationPageProps) {
  const [showForm, setShowForm] = useState(plans.length === 0);
  const [kind, setKind] = useState<PlanKind>('medication');
  const [batchName, setBatchName] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [daysText, setDaysText] = useState('');
  const [error, setError] = useState('');

  const cfg = PLAN_KINDS[kind];
  const daysNum = daysText.trim() === '' ? NaN : Number(daysText);
  const input = { kind, batchName, name, startDate, days: daysNum };
  const inputError = validatePlanInput(input);
  const previewDue = inputError ? null : getDueDate({ startDate, days: daysNum });
  const recentBatches = Array.from(new Set(plans.map(p => p.batchName))).slice(0, 6);
  const { needs, later, done } = groupPlans(plans, today);

  const switchKind = (k: PlanKind) => {
    setKind(k);
    setDaysText(''); // 兩種的天數範圍不同，換類型就重填
    setError('');
  };

  const bump = (delta: number) => {
    const cur = Number.isFinite(daysNum) ? daysNum : 0;
    setDaysText(String(Math.min(cfg.maxDays, Math.max(1, cur + delta))));
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validatePlanInput(input);
    if (problem) {
      setError(problem);
      notify(problem);
      return;
    }
    if (isDuplicatePlan(plans, input)) {
      const msg = '這一筆已經有了，不用再加一次';
      setError(msg);
      notify(msg);
      return;
    }
    const plan = createPlan(input);
    if (!onAdd(plan)) {
      const msg = '手機空間不夠，這筆沒有存到。請先刪掉幾筆舊的再存。';
      setError(msg);
      notify(msg);
      return;
    }
    const due = getDueDate(plan);
    notify(`已存好，${due ? formatShortDate(due) : '到期日'}會提醒您${cfg.dueLabel}`);
    setName('');
    setDaysText('');
    setStartDate(today);
    setError('');
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    const p = plans.find(x => x.id === id);
    if (!p) return;
    if (window.confirm(`確定刪除「${p.batchName}　${p.name}」這筆提醒？`)) {
      onDelete(id);
    }
  };

  const fieldClass =
    'w-full px-4 py-3 text-xl border-2 border-stone-300 rounded-xl bg-white focus:border-amber-600 outline-none placeholder:text-stone-300 placeholder:text-lg';

  return (
    <div className="space-y-6">
      {/* 新增 */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="w-full rounded-3xl bg-amber-700 active:bg-amber-800 text-white shadow-lg py-6 flex items-center justify-center gap-3 select-none"
          aria-expanded={showForm}
        >
          <Plus className="w-8 h-8" strokeWidth={3} />
          <span className="text-2xl font-black tracking-wider">新增用藥或疫苗提醒</span>
          {showForm ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border-2 border-amber-200 p-5 space-y-5">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="選擇類型">
              {(['medication', 'vaccine'] as PlanKind[]).map(k => {
                const on = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => switchKind(k)}
                    aria-pressed={on}
                    className={`py-4 rounded-2xl border-2 font-black text-xl flex items-center justify-center gap-2 select-none ${
                      on ? 'bg-amber-700 text-white border-transparent shadow-md' : 'bg-white text-stone-700 border-stone-300'
                    }`}
                  >
                    {k === 'medication' ? <Pill className="w-6 h-6" /> : <Syringe className="w-6 h-6" />}
                    {PLAN_KINDS[k].label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <label htmlFor="care-batch" className="text-xl font-black block">哪一批鴿子</label>
              <input
                id="care-batch"
                type="text"
                value={batchName}
                onChange={e => { setBatchName(e.target.value); setError(''); }}
                placeholder="例如：幼鴿一批、種鴿"
                maxLength={20}
                className={fieldClass}
              />
              {recentBatches.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {recentBatches.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => { setBatchName(b); setError(''); }}
                      className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 font-bold active:bg-amber-100"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="care-name" className="text-xl font-black block">{cfg.nameLabel}</label>
              <input
                id="care-name"
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                placeholder={cfg.namePlaceholder}
                maxLength={30}
                className={fieldClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="care-start" className="text-xl font-black block">{cfg.startLabel}</label>
              <div className="flex gap-2">
                <input
                  id="care-start"
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setError(''); }}
                  className={fieldClass}
                />
                <button
                  type="button"
                  onClick={() => { setStartDate(today); setError(''); }}
                  className="px-4 rounded-xl border-2 border-stone-300 bg-stone-50 font-black text-lg shrink-0 active:bg-stone-200"
                >
                  今天
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="care-days" className="text-xl font-black block">{cfg.daysLabel}</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => bump(-1)}
                  className="w-16 h-16 rounded-2xl border-2 border-stone-300 bg-white flex items-center justify-center active:bg-stone-100 shrink-0"
                  aria-label="少一天"
                >
                  <Minus className="w-8 h-8" strokeWidth={3} />
                </button>
                <input
                  id="care-days"
                  type="text"
                  inputMode="numeric"
                  value={daysText}
                  onChange={e => { setDaysText(e.target.value.replace(/\D/g, '').slice(0, 3)); setError(''); }}
                  placeholder="天數"
                  className="flex-1 min-w-0 text-center py-3 text-3xl font-black border-2 border-stone-300 rounded-xl bg-white focus:border-amber-600 outline-none placeholder:text-stone-300 placeholder:text-xl"
                />
                <button
                  type="button"
                  onClick={() => bump(1)}
                  className="w-16 h-16 rounded-2xl border-2 border-stone-300 bg-white flex items-center justify-center active:bg-stone-100 shrink-0"
                  aria-label="多一天"
                >
                  <Plus className="w-8 h-8" strokeWidth={3} />
                </button>
              </div>
            </div>

            {previewDue && (
              <p className="bg-sky-50 border-2 border-sky-200 text-sky-900 rounded-2xl p-4 font-bold text-lg leading-relaxed">
                {cfg.dueLabel}會是 {formatShortDate(previewDue)}，到時候打開 App 就會看到提醒。
              </p>
            )}
            {error && <p className="bg-rose-50 border-2 border-rose-300 text-rose-800 rounded-2xl p-4 font-bold text-lg">{error}</p>}

            <button
              type="submit"
              className="w-full py-5 rounded-2xl bg-emerald-600 active:bg-emerald-700 text-white font-black text-2xl tracking-widest shadow-md flex items-center justify-center gap-2 select-none"
            >
              <Check className="w-8 h-8" strokeWidth={3} />存起來
            </button>
          </form>
        )}
      </section>

      {/* 要處理的 */}
      <section className="space-y-3">
        <h2 className="text-2xl font-black">要處理的</h2>
        {needs.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-stone-300 p-8 text-center text-stone-500">
            {plans.length === 0 ? '還沒有任何提醒，按上面「新增」開始' : '這 7 天內沒有要處理的'}
          </div>
        ) : (
          <ul className="space-y-3">
            {needs.map(item => (
              <TodoCard key={item.plan.id} item={item} onToggleDone={onToggleDone} onDelete={handleDelete} />
            ))}
          </ul>
        )}
      </section>

      {/* 之後 */}
      {later.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-2xl font-black">之後才到期</h2>
          <ul className="space-y-3">
            {later.map(item => (
              <TodoCard key={item.plan.id} item={item} onToggleDone={onToggleDone} onDelete={handleDelete} />
            ))}
          </ul>
        </section>
      )}

      {/* 已完成 */}
      {done.length > 0 && (
        <details className="bg-white rounded-2xl border-2 border-stone-200 px-5 py-4">
          <summary className="font-bold text-lg cursor-pointer">已處理的（{done.length} 筆）</summary>
          <ul className="mt-4 space-y-3">
            {done.map(item => (
              <TodoCard key={item.plan.id} item={item} onToggleDone={onToggleDone} onDelete={handleDelete} />
            ))}
          </ul>
        </details>
      )}

      <p className="text-center text-base text-stone-500 leading-relaxed px-2">{CARE_DISCLAIMER}</p>
    </div>
  );
}
