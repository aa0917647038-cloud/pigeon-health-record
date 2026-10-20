export type HealthStatus = 'normal' | 'attention' | 'abnormal';

// 這筆記錄是什麼時間點拍的：平常／出賽前／出賽後（可不選，舊紀錄沒有這個欄位）
export type RecordPhase = 'usual' | 'before' | 'after';

export interface PigeonRecord {
  id: string;
  ringNumber: string;
  status: HealthStatus;
  photoUrl?: string;
  notes: string;
  timestamp: string; // ISO date string
  isActionRequired: boolean;
  phase?: RecordPhase; // 沒填＝平常
}

// 用藥／疫苗計畫：藥名、疫苗名都由使用者自己填，系統只負責算日期
export type PlanKind = 'medication' | 'vaccine';

export interface CarePlan {
  id: string;
  kind: PlanKind;
  batchName: string; // 哪一批鴿子（使用者自己取名）
  name: string; // 藥名或疫苗名（使用者自己填）
  startDate: string; // YYYY-MM-DD，用藥＝第一天，疫苗＝接種日
  days: number; // 用藥＝連續幾天，疫苗＝幾天後補打
  createdAt: string; // ISO date string
  doneAt?: string; // 按「做完了」的時間；沒有＝還沒處理
}

export interface StatusConfig {
  key: HealthStatus;
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  iconName: string;
  description: string;
  warningAlert: string;
  quickAdvice: string[];
}
