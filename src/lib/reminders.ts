/**
 * 用藥／疫苗提醒的日期計算。
 * 全部只做「日期加減」，不判斷病、不推薦藥，藥名由使用者自己填。
 * 日期一律用 YYYY-MM-DD 字串（手機當地日期），避免時區造成差一天。
 */

import { CarePlan, PlanKind } from '../types';
import { PLAN_KINDS } from '../constants';

export type PlanLevel = 'done' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';

export interface PlanStatus {
  dueDate: string; // 停藥日／補打日
  daysLeft: number; // 負數＝已經過期幾天
  level: PlanLevel;
}

export interface PlanInput {
  kind: PlanKind;
  batchName: string;
  name: string;
  startDate: string;
  days: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, '0');

/** 把 YYYY-MM-DD 拆開；日期不存在（例如 2026-02-31）就回 null */
export function parseDateStr(s: string): { y: number; m: number; d: number } | null {
  const mt = DATE_RE.exec(s);
  if (!mt) return null;
  const y = Number(mt[1]);
  const m = Number(mt[2]);
  const d = Number(mt[3]);
  if (m < 1 || m > 12 || d < 1) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** 手機當地的今天（或指定的 Date）轉成 YYYY-MM-DD */
export function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const dayNumber = (s: string): number | null => {
  const p = parseDateStr(s);
  return p ? Math.round(Date.UTC(p.y, p.m - 1, p.d) / MS_PER_DAY) : null;
};

/** 日期加 n 天（n 可為負） */
export function addDays(s: string, n: number): string | null {
  const p = parseDateStr(s);
  if (!p || !Number.isInteger(n)) return null;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** to 比 from 晚幾天（to 較早就是負數） */
export function diffDays(from: string, to: string): number | null {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a === null || b === null ? null : b - a;
}

/** 顯示用：2026-10-25 → 10月25日 */
export function formatShortDate(s: string): string {
  const p = parseDateStr(s);
  return p ? `${p.m}月${p.d}日` : s;
}

/** 停藥日／補打日 ＝ 開始日 ＋ 天數 */
export function getDueDate(plan: Pick<CarePlan, 'startDate' | 'days'>): string | null {
  return addDays(plan.startDate, plan.days);
}

export function getPlanStatus(plan: CarePlan, today: string): PlanStatus | null {
  const dueDate = getDueDate(plan);
  if (!dueDate) return null;
  const daysLeft = diffDays(today, dueDate);
  if (daysLeft === null) return null;
  let level: PlanLevel;
  if (plan.doneAt) level = 'done';
  else if (daysLeft < 0) level = 'overdue';
  else if (daysLeft === 0) level = 'today';
  else if (daysLeft === 1) level = 'tomorrow';
  else if (daysLeft <= 7) level = 'week';
  else level = 'later';
  return { dueDate, daysLeft, level };
}

/** 一句白話：離到期還有幾天 */
export function describeStatus(status: PlanStatus): string {
  switch (status.level) {
    case 'done':
      return '已處理';
    case 'overdue':
      return `已經過了 ${-status.daysLeft} 天，還沒按「做完了」`;
    case 'today':
      return '就是今天';
    case 'tomorrow':
      return '明天';
    default:
      return `還有 ${status.daysLeft} 天`;
  }
}

export interface TodoItem {
  plan: CarePlan;
  status: PlanStatus;
}

const byDue = (a: TodoItem, b: TodoItem) =>
  a.status.daysLeft - b.status.daysLeft || a.plan.createdAt.localeCompare(b.plan.createdAt);

/** 首頁「今天要做的事」：已過期、今天、明天、7 天內，還沒處理的 */
export function buildTodoList(plans: CarePlan[], today: string): TodoItem[] {
  const out: TodoItem[] = [];
  for (const plan of plans) {
    const status = getPlanStatus(plan, today);
    if (status && ['overdue', 'today', 'tomorrow', 'week'].includes(status.level)) {
      out.push({ plan, status });
    }
  }
  return out.sort(byDue);
}

/** 用藥疫苗頁的分組：要處理／之後／已完成 */
export function groupPlans(plans: CarePlan[], today: string) {
  const needs = buildTodoList(plans, today);
  const later: TodoItem[] = [];
  const done: TodoItem[] = [];
  for (const plan of plans) {
    const status = getPlanStatus(plan, today);
    if (!status) continue;
    if (status.level === 'later') later.push({ plan, status });
    else if (status.level === 'done') done.push({ plan, status });
  }
  later.sort(byDue);
  done.sort((a, b) => (b.plan.doneAt || '').localeCompare(a.plan.doneAt || ''));
  return { needs, later, done };
}

/** 把空白整理乾淨（前後空白、連續空白） */
export const cleanText = (s: string) => s.replace(/\s+/g, ' ').trim();
const compareKey = (s: string) => cleanText(s).toLowerCase();

/** 檢查輸入，沒問題回 null，有問題回一句白話說明 */
export function validatePlanInput(input: PlanInput): string | null {
  const cfg = PLAN_KINDS[input.kind];
  if (!cfg) return '請先選「用藥」或「疫苗」';
  const batch = cleanText(input.batchName);
  const name = cleanText(input.name);
  if (!batch) return '請填這是哪一批鴿子（例如：幼鴿一批）';
  if (batch.length > 20) return '批次名稱太長，請在 20 個字以內';
  if (!name) return `請填${cfg.nameLabel}`;
  if (name.length > 30) return `${cfg.nameLabel}太長，請在 30 個字以內`;
  const p = parseDateStr(input.startDate);
  if (!p || p.y < 2020 || p.y > 2100) return '日期不對，請重新選一次';
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > cfg.maxDays) {
    return `${cfg.daysLabel}請填 1 到 ${cfg.maxDays} 的整數`;
  }
  return null;
}

/** 同一批、同一個名稱、同一天開始、同樣天數，視為重複 */
export function isDuplicatePlan(plans: CarePlan[], input: PlanInput): boolean {
  return plans.some(
    p =>
      p.kind === input.kind &&
      compareKey(p.batchName) === compareKey(input.batchName) &&
      compareKey(p.name) === compareKey(input.name) &&
      p.startDate === input.startDate &&
      p.days === input.days
  );
}

export function createPlan(input: PlanInput, now: Date = new Date()): CarePlan {
  return {
    id: `plan-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: input.kind,
    batchName: cleanText(input.batchName),
    name: cleanText(input.name),
    startDate: input.startDate,
    days: input.days,
    createdAt: now.toISOString()
  };
}

/** 從手機讀出來的資料可能被改壞，逐筆檢查，壞的就略過，不讓畫面當掉 */
export function isValidPlan(x: unknown): x is CarePlan {
  if (!x || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id) return false;
  if (p.kind !== 'medication' && p.kind !== 'vaccine') return false;
  if (typeof p.batchName !== 'string' || typeof p.name !== 'string') return false;
  if (typeof p.startDate !== 'string' || !parseDateStr(p.startDate)) return false;
  if (typeof p.days !== 'number' || !Number.isInteger(p.days) || p.days < 1 || p.days > PLAN_KINDS[p.kind].maxDays) {
    return false;
  }
  if (typeof p.createdAt !== 'string') return false;
  if (p.doneAt !== undefined && typeof p.doneAt !== 'string') return false;
  return true;
}
