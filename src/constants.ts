import { StatusConfig, HealthStatus } from './types';

export const STATUSES: StatusConfig[] = [
  {
    key: 'normal',
    label: '正常',
    colorClass: 'text-emerald-700 dark:text-emerald-400',
    bgClass: 'bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border-emerald-300 selected:bg-emerald-600 selected:text-white',
    borderClass: 'border-emerald-200',
    iconName: 'CheckCircle2',
    description: '吃喝、精神、糞便都正常',
    warningAlert: '',
    quickAdvice: []
  },
  {
    key: 'attention',
    label: '需要留意',
    colorClass: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border-amber-300 selected:bg-amber-600 selected:text-white',
    borderClass: 'border-amber-200',
    iconName: 'Frown',
    description: '和平常有些不同，先記下來',
    warningAlert: '⚠️ 提醒：今天看起來和平常有些不同，先把照片與備註留下來，後續比較方便回看。',
    quickAdvice: [
      '先補上一張清楚照片，方便之後前後比對',
      '把今天看到的活動、食慾或外觀變化寫進備註',
      '晚一點再回來看一次，補記有沒有新的變化'
    ]
  },
  {
    key: 'abnormal',
    label: '再觀察',
    colorClass: 'text-rose-700 dark:text-rose-400',
    bgClass: 'bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border-rose-300 selected:bg-rose-600 selected:text-white',
    borderClass: 'border-rose-200',
    iconName: 'Activity',
    description: '和今天平常差很多，先完整記錄',
    warningAlert: '⚠️ 提醒：這筆觀察和今天平常差異較大，建議把照片、時間與看到的重點都完整記下來。',
    quickAdvice: [
      '補拍不同角度的照片，讓記錄更完整',
      '把當下時間、外觀和活動情形寫清楚',
      '之後再次查看時，補記是否有持續相同情形'
    ]
  }
];

export const QUICK_NOTES = [
  '今日無異狀',
  '吃料速度變慢了',
  '排泄物有些微不成型',
  '今天有些沒精神',
  '已另外拍照留存',
  '已拍好記錄照片裝檔',
  '外觀神情看起來稍差'
];

export const SUGGESTED_RING_PATTERNS = [
  'TW-',
  'UN-',
  'TAIWAN-',
  '2026-'
];
