import React, { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Sparkles,
  Camera,
  Mic,
  Send,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  Repeat,
  HeartPulse,
  List,
  CalendarDays,
  ShieldAlert,
  ChevronRight,
  Info,
} from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext.tsx";
import { AppointmentsProvider, useAppointments } from "./context/AppointmentsContext.tsx";
import { Header } from "./components/Header.tsx";
import { AppointmentCard } from "./components/AppointmentCard.tsx";
import { AppointmentCreateModal } from "./components/AppointmentCreateModal.tsx";
import { TelegramSettingsModal } from "./components/TelegramSettingsModal.tsx";
import { AuthModal } from "./components/AuthModal.tsx";
import { CalendarView } from "./components/CalendarView.tsx";
import { AppointmentCategory } from "./types/index.ts";
import { CATEGORIES } from "./utils/categories.ts";

type FilterTab = "today" | "upcoming" | "recurring" | "completed" | "all";

function MainDashboard() {
  const { user, profile } = useAuth();
  const { appointments, loading, stats } = useAppointments();

  // Navigation & Modals
  const [activeFilter, setActiveFilter] = useState<FilterTab>("upcoming");
  const [selectedCategory, setSelectedCategory] = useState<AppointmentCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createModalInitialTab, setCreateModalInitialTab] = useState<"manual" | "image" | "voice">("manual");
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Quick Toast and Telegram test status
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  const handleQuickTelegramTest = async () => {
    setIsTestingTelegram(true);
    setToastMessage(null);
    try {
      const activeChatId = profile?.telegramChatId || "1991960111";
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeChatId,
          userName: profile?.displayName || "Filipe Augusto",
          email: profile?.email || "filipeafdev@gmail.com",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setToastMessage("🔔 Alerta de teste entregue com sucesso no seu Telegram! Verifique o app do Telegram agora mesmo.");
      } else {
        setToastMessage("⚠️ " + (data.error || "Não foi possível entregar a mensagem. Abra o bot no Telegram e envie /start."));
      }
    } catch (e: any) {
      setToastMessage("⚠️ Erro de conexão ao testar Telegram.");
    } finally {
      setIsTestingTelegram(false);
      setTimeout(() => setToastMessage(null), 8000);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = apt.title.toLowerCase().includes(query);
        const matchLoc = apt.location?.toLowerCase().includes(query);
        const matchDesc = apt.description?.toLowerCase().includes(query);
        if (!matchTitle && !matchLoc && !matchDesc) return false;
      }

      // Category filter
      if (selectedCategory !== "all" && apt.category !== selectedCategory) {
        return false;
      }

      // Tab filter
      if (activeFilter === "today") {
        return apt.date === todayStr && apt.status !== "completed";
      }
      if (activeFilter === "upcoming") {
        return apt.date >= todayStr && apt.status !== "completed";
      }
      if (activeFilter === "recurring") {
        return apt.recurrence !== "none" && apt.status !== "completed";
      }
      if (activeFilter === "completed") {
        return apt.status === "completed";
      }

      // 'all'
      return true;
    });
  }, [appointments, activeFilter, selectedCategory, searchQuery, todayStr]);

  // Appointments for selected calendar date
  const selectedDateAppointments = useMemo(() => {
    return appointments.filter((apt) => apt.date === selectedCalendarDate);
  }, [appointments, selectedCalendarDate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-28 sm:pb-16">
      {/* Header */}
      <Header
        onOpenTelegramSettings={() => {
          if (!user && !profile) setIsAuthOpen(true);
          else setIsTelegramOpen(true);
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto px-4 py-5 flex-1 space-y-5">
        {/* Toast Notification Alert */}
        {toastMessage && (
          <div className="p-4 rounded-3xl bg-slate-900 text-white shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 border border-slate-700">
            <div className="flex items-center gap-3 text-xs sm:text-sm font-bold">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 rounded-xl hover:bg-white/20 text-slate-400 hover:text-white transition text-xs font-bold"
            >
              OK
            </button>
          </div>
        )}

        {/* Telegram Active Connected Card with 1-click Test */}
        <div className="bg-gradient-to-r from-sky-50 via-sky-50/80 to-blue-50 border-2 border-sky-300 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-600/20">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="text-xs sm:text-sm font-extrabold text-sky-950">
                  Telegram Conectado: Chat ID {profile?.telegramChatId || "1991960111"}
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-sky-800">
                Lembretes automáticos ativos para <b>{profile?.displayName || "Filipe Augusto"}</b> (1 dia, 2h e 15 min antes).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleQuickTelegramTest}
              disabled={isTestingTelegram}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-extrabold text-xs transition shadow-sm flex items-center justify-center gap-1.5"
            >
              {isTestingTelegram ? (
                <span>Enviando teste...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Testar Alerta no Telegram</span>
                </>
              )}
            </button>
            <button
              onClick={() => setIsTelegramOpen(true)}
              className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition"
              title="Ajustar Configurações do Telegram"
            >
              Ajustar
            </button>
          </div>
        </div>

        {/* Hero Quick Input Cards */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {/* Quick Voice */}
          <button
            onClick={() => {
              setCreateModalInitialTab("voice");
              setIsCreateOpen(true);
            }}
            className="p-3.5 sm:p-4 rounded-3xl bg-white border-2 border-slate-200 hover:border-emerald-500 shadow-sm transition text-left group flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-2 group-hover:scale-105 transition">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-xs sm:text-sm font-extrabold text-slate-900">
                Falar Compromisso
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:block">
                IA interpreta sua voz
              </span>
            </div>
          </button>

          {/* Quick Photo / OCR */}
          <button
            onClick={() => {
              setCreateModalInitialTab("image");
              setIsCreateOpen(true);
            }}
            className="p-3.5 sm:p-4 rounded-3xl bg-white border-2 border-slate-200 hover:border-emerald-500 shadow-sm transition text-left group flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center mb-2 group-hover:scale-105 transition">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-xs sm:text-sm font-extrabold text-slate-900">
                Fotografar Convite
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:block">
                Extrai datas via OCR
              </span>
            </div>
          </button>

          {/* Quick Manual */}
          <button
            onClick={() => {
              setCreateModalInitialTab("manual");
              setIsCreateOpen(true);
            }}
            className="p-3.5 sm:p-4 rounded-3xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition text-left group flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-xs sm:text-sm font-extrabold">
                Novo Agendamento
              </span>
              <span className="text-[11px] text-emerald-100 hidden sm:block">
                Formulário manual
              </span>
            </div>
          </button>
        </div>

        {/* View Mode & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por compromisso, médico, local..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:outline-hidden text-xs sm:text-sm font-medium bg-white text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-2xl shrink-0 self-end sm:self-auto">
            <button
              onClick={() => setViewMode("list")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === "list"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-600"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === "calendar"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-600"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Calendário</span>
            </button>
          </div>
        </div>

        {/* Filter Pills (Tabs) */}
        {viewMode === "list" && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setActiveFilter("today")}
                className={`py-2 px-3.5 rounded-2xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                  activeFilter === "today"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>Hoje</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    activeFilter === "today"
                      ? "bg-white text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {stats.today}
                </span>
              </button>

              <button
                onClick={() => setActiveFilter("upcoming")}
                className={`py-2 px-3.5 rounded-2xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                  activeFilter === "upcoming"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>Próximos Dias</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    activeFilter === "upcoming"
                      ? "bg-white text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {stats.upcoming}
                </span>
              </button>

              <button
                onClick={() => setActiveFilter("recurring")}
                className={`py-2 px-3.5 rounded-2xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                  activeFilter === "recurring"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Repeat className="w-3 h-3" />
                <span>Recorrentes</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    activeFilter === "recurring"
                      ? "bg-white text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {stats.recurring}
                </span>
              </button>

              <button
                onClick={() => setActiveFilter("completed")}
                className={`py-2 px-3.5 rounded-2xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                  activeFilter === "completed"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>Concluídos</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    activeFilter === "completed"
                      ? "bg-white text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {stats.completed}
                </span>
              </button>

              <button
                onClick={() => setActiveFilter("all")}
                className={`py-2 px-3.5 rounded-2xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                  activeFilter === "all"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>Todos</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    activeFilter === "all"
                      ? "bg-white text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {stats.total}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Calendar View Content */}
        {viewMode === "calendar" && (
          <div className="space-y-4">
            <CalendarView
              appointments={appointments}
              selectedDate={selectedCalendarDate}
              onSelectDate={(date) => setSelectedCalendarDate(date)}
              onNewAppointment={(date) => {
                if (date) setSelectedCalendarDate(date);
                setIsCreateOpen(true);
              }}
            />

            {/* List for the selected date */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-emerald-600" />
                  <span>
                    Compromissos para {selectedCalendarDate.split("-").reverse().join("/")}:
                  </span>
                </h3>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar neste dia
                </button>
              </div>

              {selectedDateAppointments.length === 0 ? (
                <div className="text-center p-6 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                  <p className="text-xs font-medium text-slate-500">
                    Nenhum compromisso agendado para este dia.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateAppointments.map((apt) => (
                    <AppointmentCard key={apt.id} appointment={apt} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* List View Content */}
        {viewMode === "list" && (
          <div className="space-y-3">
            {filteredAppointments.length === 0 ? (
              <div className="text-center py-12 px-6 bg-white rounded-3xl border-2 border-dashed border-slate-200 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CalendarIcon className="w-7 h-7" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800">
                  {activeFilter === "today"
                    ? "Nenhum compromisso para hoje!"
                    : activeFilter === "recurring"
                    ? "Nenhum compromisso recorrente cadastrado."
                    : activeFilter === "completed"
                    ? "Nenhum compromisso concluído ainda."
                    : "Nenhum compromisso encontrado."}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Toque no botão abaixo para agendar usando sua voz, tirando uma foto do convite ou digitando manualmente.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      if (!user && !profile) setIsAuthOpen(true);
                      else setIsCreateOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition shadow-md shadow-emerald-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Compromisso</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAppointments.map((apt) => (
                  <AppointmentCard key={apt.id} appointment={apt} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button / Mobile Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 sm:hidden">
        <div className="flex items-center justify-around gap-2 max-w-md mx-auto">
          <button
            onClick={() => setViewMode("list")}
            className={`flex-1 py-2 rounded-2xl flex flex-col items-center gap-1 text-[11px] font-bold ${
              viewMode === "list" ? "text-emerald-700" : "text-slate-500"
            }`}
          >
            <List className="w-5 h-5" />
            <span>Lista</span>
          </button>

          {/* Central Big Add Button */}
          <button
            onClick={() => {
              if (!user && !profile) setIsAuthOpen(true);
              else setIsCreateOpen(true);
            }}
            className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 -mt-6 hover:scale-105 transition"
          >
            <Plus className="w-7 h-7" />
          </button>

          <button
            onClick={() => {
              if (!user && !profile) setIsAuthOpen(true);
              else setIsTelegramOpen(true);
            }}
            className="flex-1 py-2 rounded-2xl flex flex-col items-center gap-1 text-[11px] font-bold text-slate-500"
          >
            <Send className="w-5 h-5 text-sky-500" />
            <span>Telegram</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <AppointmentCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        initialDate={selectedCalendarDate}
        initialTab={createModalInitialTab}
        onAppointmentCreated={(title, date, time) => {
          setActiveFilter("upcoming");
          setToastMessage(`✅ Compromisso "${title}" salvo com sucesso para ${date} às ${time}!`);
          setTimeout(() => setToastMessage(null), 7000);
        }}
      />

      <TelegramSettingsModal
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
      />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppointmentsProvider>
        <MainDashboard />
      </AppointmentsProvider>
    </AuthProvider>
  );
}
