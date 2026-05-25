export type HealthStatus = 'normal' | 'attention' | 'abnormal';

export interface PigeonRecord {
  id: string;
  ringNumber: string;
  status: HealthStatus;
  photoUrl?: string;
  notes: string;
  timestamp: string; // ISO date string
  isActionRequired: boolean;
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
