export type AppointmentCategory =
  | "saude"
  | "trabalho"
  | "familia"
  | "financas"
  | "estudos"
  | "pessoal"
  | "outro";

export type RecurrenceType = "none" | "weekly" | "monthly";

export type AppointmentStatus = "pending" | "completed" | "cancelled";

export type InputSource = "manual" | "image" | "voice";

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  telegramChatId?: string;
  telegramNotificationsEnabled?: boolean;
  highContrast?: boolean;
  fontSize?: "normal" | "large" | "xlarge";
  createdAt: string;
  updatedAt?: string;
}

export interface Appointment {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: AppointmentCategory;
  location?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  dateTimeIso: string;
  recurrence: RecurrenceType;
  recurrenceDayOfWeek?: number;
  recurrenceDayOfMonth?: number;
  remindersMinutesBefore: number[];
  status: AppointmentStatus;
  source: InputSource;
  telegramNotificationSent?: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderLog {
  id: string;
  userId: string;
  appointmentId: string;
  appointmentTitle: string;
  chatId: string;
  reminderType: string;
  status: "delivered" | "failed";
  sentAt: string;
}

export interface ExtractedAIAppointment {
  title: string;
  date: string;
  time: string;
  location?: string;
  category: AppointmentCategory;
  description?: string;
  recurrence: RecurrenceType;
  remindersMinutesBefore?: number[];
}
