import { StatusConfig } from './types';

// 三種觀察分類：顏色固定為 綠（正常）／黃（稍有不同）／紅（明顯不同），全站一致
export const STATUSES: StatusConfig[] = [
  {
    key: 'normal',
    label: '正常',
    colorClass: 'text-emerald-800',
    bgClass: 'bg-emerald-600',
    borderClass: 'border-emerald-300',
    iconName: 'CheckCircle2',
    description: '和平常一樣',
    warningAlert: '',
    quickAdvice: []
  },
  {
    key: 'attention',
    label: '稍有不同',
    colorClass: 'text-amber-800',
    bgClass: 'bg-amber-500',
    borderClass: 'border-amber-300',
    iconName: 'Eye',
    description: '和平常有點不一樣',
    warningAlert: '和平常有點不一樣，建議晚一點再拍一張比對。',
    quickAdvice: [
      '晚一點再拍一張，前後比對',
      '備註寫下食量、精神的變化'
    ]
  },
  {
    key: 'abnormal',
    label: '明顯不同',
    colorClass: 'text-rose-800',
    bgClass: 'bg-rose-600',
    borderClass: 'border-rose-300',
    iconName: 'AlertTriangle',
    description: '和平常差很多',
    warningAlert: '和平常差很多，建議多拍幾個角度，把時間和看到的情形記清楚。',
    quickAdvice: [
      '多拍幾個角度的照片',
      '備註寫下時間和看到的情形',
      '之後再看一次，補記有沒有變化'
    ]
  }
];

// 每個分類的淺色底／標籤樣式（紀錄卡、標籤用）
export const STATUS_SOFT: Record<string, string> = {
  normal: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  attention: 'bg-amber-50 text-amber-900 border-amber-300',
  abnormal: 'bg-rose-50 text-rose-900 border-rose-300'
};

export const QUICK_NOTES = [
  '今日無異狀',
  '吃得比較少',
  '精神比較差',
  '大便比較稀',
  '羽毛比較蓬'
];

export const SUGGESTED_RING_PATTERNS = [
  'TW-',
  'UN-',
  'TAIWAN-',
  '2026-'
];
