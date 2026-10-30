import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react";
import { Appointment } from "../types/index.ts";
import { CATEGORIES } from "../utils/categories.ts";

interface CalendarViewProps {
  appointments: Appointment[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onNewAppointment: (date?: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  appointments,
  selectedDate,
  onSelectDate,
  onNewAppointment,
}) => {
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const d = new Date(selectedDate || new Date());
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const prevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  // Month Title in Portuguese
  const monthTitle = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(currentMonthDate);

  // Generate calendar days
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = new Date().toISOString().split("T")[0];

  // Map appointments by date
  const appointmentsByDate = React.useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((apt) => {
      const existing = map.get(apt.date) || [];
      existing.push(apt);
      map.set(apt.date, existing);
    });
    return map;
  }, [appointments]);

  const daysCells = [];

  // Blank cells before first day
  for (let i = 0; i < firstDayOfWeek; i++) {
    daysCells.push(<div key={`empty-${i}`} className="h-14 sm:h-16 bg-slate-50/50 rounded-2xl"></div>);
  }

  // Days of current month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    const dayAppointments = appointmentsByDate.get(dateStr) || [];
    const isSelected = selectedDate === dateStr;
    const isToday = todayStr === dateStr;

    daysCells.push(
      <button
        key={dateStr}
        onClick={() => onSelectDate(dateStr)}
        className={`h-14 sm:h-16 p-1.5 rounded-2xl border-2 transition flex flex-col justify-between items-start text-left relative ${
          isSelected
            ? "border-emerald-600 bg-emerald-50/80 shadow-md ring-2 ring-emerald-500/20"
            : isToday
            ? "border-emerald-300 bg-white"
            : "border-slate-100 hover:border-slate-300 bg-white"
        }`}
      >
        <span
          className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
            isToday
              ? "bg-emerald-600 text-white shadow-xs"
              : isSelected
              ? "bg-emerald-800 text-white"
              : "text-slate-800"
          }`}
        >
          {day}
        </span>

        {/* Appointment count or colored dots */}
        <div className="flex items-center gap-1 w-full overflow-hidden mt-0.5">
          {dayAppointments.slice(0, 3).map((apt, idx) => {
            const cat = CATEGORIES[apt.category] || CATEGORIES.outro;
            return (
              <span
                key={idx}
                title={apt.title}
                className={`w-2 h-2 rounded-full ${
                  apt.status === "completed" ? "bg-slate-300" : cat.badgeBg.split(" ")[0]
                }`}
              ></span>
            );
          })}
          {dayAppointments.length > 3 && (
            <span className="text-[9px] font-extrabold text-slate-500">
              +{dayAppointments.length - 3}
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="bg-white rounded-3xl border-2 border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
      {/* Month Navigator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-extrabold capitalize text-slate-900">
            {monthTitle}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={prevMonth}
            aria-label="Mês anterior"
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              const now = new Date();
              setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
              onSelectDate(now.toISOString().split("T")[0]);
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700"
          >
            Hoje
          </button>
          <button
            onClick={nextMonth}
            aria-label="Próximo mês"
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-extrabold text-slate-400 uppercase tracking-wider">
        <span>Dom</span>
        <span>Seg</span>
        <span>Ter</span>
        <span>Qua</span>
        <span>Qui</span>
        <span>Sex</span>
        <span>Sáb</span>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1.5">{daysCells}</div>
    </div>
  );
};
