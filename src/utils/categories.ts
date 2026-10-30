import { AppointmentCategory, RecurrenceType } from "../types/index.ts";

export interface CategoryMeta {
  id: AppointmentCategory;
  label: string;
  iconName: string;
  badgeBg: string;
  badgeText: string;
  borderCol: string;
  description: string;
}

export const CATEGORIES: Record<AppointmentCategory, CategoryMeta> = {
  saude: {
    id: "saude",
    label: "Saúde & Médico",
    iconName: "HeartPulse",
    badgeBg: "bg-emerald-100 text-emerald-800",
    badgeText: "text-emerald-700",
    borderCol: "border-emerald-500",
    description: "Consultas, exames, vacinas e remédios",
  },
  trabalho: {
    id: "trabalho",
    label: "Trabalho",
    iconName: "Briefcase",
    badgeBg: "bg-blue-100 text-blue-800",
    badgeText: "text-blue-700",
    borderCol: "border-blue-500",
    description: "Reuniões, prazos e compromissos profissionais",
  },
  familia: {
    id: "familia",
    label: "Família & Casa",
    iconName: "Home",
    badgeBg: "bg-amber-100 text-amber-800",
    badgeText: "text-amber-700",
    borderCol: "border-amber-500",
    description: "Tarefas domésticas, compras e escola",
  },
  financas: {
    id: "financas",
    label: "Finanças",
    iconName: "CircleDollarSign",
    badgeBg: "bg-purple-100 text-purple-800",
    badgeText: "text-purple-700",
    borderCol: "border-purple-500",
    description: "Pagamentos de contas, bancos e vencimentos",
  },
  estudos: {
    id: "estudos",
    label: "Estudos",
    iconName: "GraduationCap",
    badgeBg: "bg-indigo-100 text-indigo-800",
    badgeText: "text-indigo-700",
    borderCol: "border-indigo-500",
    description: "Aulas, cursos, provas e entregas",
  },
  pessoal: {
    id: "pessoal",
    label: "Pessoal & Lazer",
    iconName: "Smile",
    badgeBg: "bg-teal-100 text-teal-800",
    badgeText: "text-teal-700",
    borderCol: "border-teal-500",
    description: "Academia, aniversários, passeios e hobbies",
  },
  outro: {
    id: "outro",
    label: "Outros",
    iconName: "Calendar",
    badgeBg: "bg-slate-100 text-slate-800",
    badgeText: "text-slate-700",
    borderCol: "border-slate-400",
    description: "Lembretes diversos e tarefas rápidas",
  },
};

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: "Único (Sem repetição)",
  weekly: "Semanal (Toda semana)",
  monthly: "Mensal (Todo mês)",
};

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

export function formatRelativeTime(dateStr: string, timeStr: string): { label: string; isToday: boolean; isOverdue: boolean } {
  const now = new Date();
  const eventDate = new Date(`${dateStr}T${timeStr || "00:00"}:00`);

  const todayStr = now.toISOString().split("T")[0];
  const isToday = dateStr === todayStr;

  const diffMs = eventDate.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffMinutes < 0 && Math.abs(diffMinutes) > 10) {
    return { label: `Atrasado há ${Math.abs(diffHours) > 1 ? `${Math.abs(diffHours)}h` : `${Math.abs(diffMinutes)}min`}`, isToday, isOverdue: true };
  }

  if (Math.abs(diffMinutes) <= 10) {
    return { label: "Acontecendo AGORA", isToday: true, isOverdue: false };
  }

  if (isToday) {
    if (diffMinutes < 60) {
      return { label: `Em ${diffMinutes} minutos`, isToday: true, isOverdue: false };
    }
    return { label: `Hoje às ${timeStr}`, isToday: true, isOverdue: false };
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  if (dateStr === tomorrowStr) {
    return { label: `Amanhã às ${timeStr}`, isToday: false, isOverdue: false };
  }

  return { label: `${formatDateBR(dateStr)} às ${timeStr}`, isToday: false, isOverdue: false };
}
