import React, { useState } from "react";
import {
  Check,
  Clock,
  MapPin,
  Repeat,
  Send,
  MoreVertical,
  Trash2,
  CalendarPlus,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Camera,
  Mic,
  Loader2,
} from "lucide-react";
import { Appointment } from "../types/index.ts";
import { useAppointments } from "../context/AppointmentsContext.tsx";
import { CATEGORIES, formatDateBR, formatRelativeTime } from "../utils/categories.ts";

interface AppointmentCardProps {
  appointment: Appointment;
  onEdit?: (appointment: Appointment) => void;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onEdit,
}) => {
  const { markAsCompleted, postponeAppointment, deleteAppointment, sendManualTelegramReminder } =
    useAppointments();

  const [showPostponeMenu, setShowPostponeMenu] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categoryMeta = CATEGORIES[appointment.category] || CATEGORIES.outro;
  const timing = formatRelativeTime(appointment.date, appointment.time);

  const isCompleted = appointment.status === "completed";
  const isToday = timing.isToday && !isCompleted;
  const isOverdue = timing.isOverdue && !isCompleted;

  const handlePostpone = async (hours: number, days: number) => {
    setShowPostponeMenu(false);
    await postponeAppointment(appointment.id, { hours, days });
  };

  const handleSendTelegram = async () => {
    setSendingTelegram(true);
    setTelegramStatus(null);
    const result = await sendManualTelegramReminder(appointment, "Lembrete Imediato LembraAI");
    setSendingTelegram(false);
    setTelegramStatus(result.message || (result.ok ? "Enviado!" : "Erro ao enviar"));
    setTimeout(() => setTelegramStatus(null), 4000);
  };

  return (
    <div
      className={`rounded-3xl p-4 sm:p-5 transition-all border-2 relative overflow-hidden ${
        isCompleted
          ? "bg-slate-50/80 border-slate-200 opacity-60"
          : isOverdue
          ? "bg-rose-50/90 border-rose-400 shadow-md shadow-rose-500/10"
          : isToday
          ? "bg-white border-emerald-500 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/20"
          : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
      }`}
    >
      {/* Top Banner for Urgent / Today */}
      {isToday && !isCompleted && (
        <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-xs flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>É HOJE!</span>
        </div>
      )}

      {isOverdue && !isCompleted && (
        <div className="absolute top-0 right-0 bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-xs flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          <span>ATRASADO</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex-1 pr-14">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {/* Category badge */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${categoryMeta.badgeBg}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {categoryMeta.label}
            </span>

            {/* Recurrence badge */}
            {appointment.recurrence !== "none" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Repeat className="w-3 h-3" />
                {appointment.recurrence === "weekly" ? "Semanal" : "Mensal"}
              </span>
            )}

            {/* Source badge */}
            {appointment.source === "image" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <Camera className="w-3 h-3" /> OCR IA
              </span>
            )}
            {appointment.source === "voice" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                <Mic className="w-3 h-3" /> Voz IA
              </span>
            )}
          </div>

          {/* Title */}
          <h3
            className={`text-lg sm:text-xl font-extrabold text-slate-900 leading-snug ${
              isCompleted ? "line-through text-slate-400" : ""
            }`}
          >
            {appointment.title}
          </h3>
        </div>
      </div>

      {/* Date, Time & Proximity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3 text-sm text-slate-700">
        <div className="flex items-center gap-2 font-bold">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isToday
                ? "bg-emerald-100 text-emerald-800"
                : isOverdue
                ? "bg-rose-100 text-rose-800"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="block text-slate-900">
              {formatDateBR(appointment.date)} às {appointment.time}
            </span>
            <span
              className={`text-xs ${
                isToday
                  ? "text-emerald-700 font-extrabold"
                  : isOverdue
                  ? "text-rose-700 font-bold"
                  : "text-slate-500 font-medium"
              }`}
            >
              {timing.label}
            </span>
          </div>
        </div>

        {appointment.location && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 p-2 rounded-xl">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">{appointment.location}</span>
          </div>
        )}
      </div>

      {/* Notes / Description */}
      {appointment.description && (
        <p className="text-xs text-slate-600 bg-slate-50/90 p-2.5 rounded-xl border border-slate-100 mb-3">
          {appointment.description}
        </p>
      )}

      {/* Telegram status notice if triggered */}
      {telegramStatus && (
        <div className="mb-3 p-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
          <Send className="w-3.5 h-3.5 text-sky-600" />
          <span>{telegramStatus}</span>
        </div>
      )}

      {/* Quick Action Buttons (Big touch targets) */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
        {/* Concluir */}
        {!isCompleted ? (
          <button
            onClick={() => markAsCompleted(appointment.id)}
            className="flex-1 min-w-[120px] py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Concluir</span>
          </button>
        ) : (
          <span className="flex-1 py-2 px-3 text-xs font-bold text-slate-400 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Compromisso Concluído</span>
          </span>
        )}

        {/* Adiar Menu */}
        {!isCompleted && (
          <div className="relative">
            <button
              onClick={() => setShowPostponeMenu(!showPostponeMenu)}
              className="py-2.5 px-3 rounded-2xl border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition bg-white"
            >
              <CalendarPlus className="w-4 h-4 text-amber-600" />
              <span>Adiar</span>
            </button>

            {showPostponeMenu && (
              <div className="absolute left-0 bottom-full mb-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-20 animate-in fade-in">
                <p className="text-[10px] font-bold text-slate-400 px-2.5 py-1 uppercase tracking-wider">
                  Adiar para:
                </p>
                <button
                  onClick={() => handlePostpone(1, 0)}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  +1 hora
                </button>
                <button
                  onClick={() => handlePostpone(2, 0)}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  +2 horas
                </button>
                <button
                  onClick={() => handlePostpone(0, 1)}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Amanhã mesmo horário
                </button>
                <button
                  onClick={() => handlePostpone(0, 7)}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Próxima semana (+7 dias)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Telegram Direct Trigger */}
        <button
          onClick={handleSendTelegram}
          disabled={sendingTelegram}
          title="Disparar lembrete imediato no seu Telegram"
          className="p-2.5 rounded-2xl border border-sky-200 hover:bg-sky-50 text-sky-700 font-bold text-xs flex items-center justify-center transition"
        >
          {sendingTelegram ? (
            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>

        {/* Excluir */}
        {confirmDelete ? (
          <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-2xl border border-rose-200">
            <button
              onClick={() => deleteAppointment(appointment.id)}
              className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs"
            >
              Excluir?
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1.5 rounded-xl text-slate-500 hover:bg-slate-200 text-xs font-semibold"
            >
              Não
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Excluir este compromisso"
            className="p-2.5 rounded-2xl border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-400 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
