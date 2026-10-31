import React, { useState } from "react";
import {
  Bell,
  Send,
  Eye,
  Type,
  LogOut,
  User as UserIcon,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.tsx";

interface HeaderProps {
  onOpenTelegramSettings: () => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenTelegramSettings,
  onOpenAuth,
}) => {
  const { user, profile, logout, updateAccessibility } = useAuth();
  const [showAccessMenu, setShowAccessMenu] = useState(false);

  const isTelegramConfigured = Boolean(profile?.telegramChatId?.trim());
  const highContrast = profile?.highContrast ?? false;
  const fontSize = profile?.fontSize ?? "normal";

  // Today's formatted date in Portuguese
  const todayFormatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const handleFontChange = (size: "normal" | "large" | "xlarge") => {
    updateAccessibility(size, highContrast);
    document.body.classList.remove("font-large", "font-xlarge");
    if (size === "large") document.body.classList.add("font-large");
    if (size === "xlarge") document.body.classList.add("font-xlarge");
  };

  const handleContrastToggle = () => {
    const nextVal = !highContrast;
    updateAccessibility(fontSize, nextVal);
    if (nextVal) {
      document.body.classList.add("high-contrast");
    } else {
      document.body.classList.remove("high-contrast");
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 transition-colors shadow-xs">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & Date */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Bell className="w-6 h-6 animate-pulse-subtle" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 flex items-center gap-1">
                Lembra<span className="text-emerald-600">AI</span>
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <Sparkles className="w-3 h-3 text-emerald-600" /> Acessível
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 capitalize line-clamp-1">
              {todayFormatted}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Telegram Status Badge Button */}
          {user && (
            <button
              onClick={onOpenTelegramSettings}
              title={
                isTelegramConfigured
                  ? "Telegram Conectado. Clique para ver configurações"
                  : "Conecte seu Telegram para receber alertas automáticos"
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                isTelegramConfigured
                  ? "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100"
                  : "bg-amber-50 text-amber-800 border-amber-300 animate-pulse hover:bg-amber-100"
              }`}
            >
              <Send className="w-3.5 h-3.5 text-sky-500" />
              <span className="hidden sm:inline">
                {isTelegramConfigured ? "Telegram Ativo" : "Conectar Telegram"}
              </span>
              {isTelegramConfigured ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              )}
            </button>
          )}

          {/* Accessibility Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowAccessMenu(!showAccessMenu)}
              aria-label="Opções de Acessibilidade"
              title="Ajustar tamanho da letra e alto contraste"
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition"
            >
              <Eye className="w-5 h-5 text-emerald-600" />
            </button>

            {showAccessMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5" /> Acessibilidade
                  </span>
                  <button
                    onClick={() => setShowAccessMenu(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Fechar
                  </button>
                </div>

                {/* Font Size Toggle */}
                <div className="mb-3">
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                    Tamanho do Texto:
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => handleFontChange("normal")}
                      className={`py-1 text-xs font-semibold rounded-lg transition ${
                        fontSize === "normal"
                          ? "bg-white text-emerald-700 shadow-xs"
                          : "text-slate-600"
                      }`}
                    >
                      Padrão
                    </button>
                    <button
                      onClick={() => handleFontChange("large")}
                      className={`py-1 text-sm font-bold rounded-lg transition ${
                        fontSize === "large"
                          ? "bg-white text-emerald-700 shadow-xs"
                          : "text-slate-600"
                      }`}
                    >
                      Médio
                    </button>
                    <button
                      onClick={() => handleFontChange("xlarge")}
                      className={`py-1 text-base font-extrabold rounded-lg transition ${
                        fontSize === "xlarge"
                          ? "bg-white text-emerald-700 shadow-xs"
                          : "text-slate-600"
                      }`}
                    >
                      Grande
                    </button>
                  </div>
                </div>

                {/* High Contrast Toggle */}
                <div>
                  <button
                    onClick={handleContrastToggle}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between transition border ${
                      highContrast
                        ? "bg-amber-400 text-black border-black"
                        : "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    <span>Alto Contraste</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/80 text-black font-extrabold">
                      {highContrast ? "LIGADO" : "DESLIGADO"}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile / Auth Button */}
          {user || profile ? (
            <button
              onClick={() => logout()}
              title={`Conectado como: ${profile?.displayName || user?.email || profile?.email}. Clique para sair.`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-semibold transition"
            >
              <UserIcon className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline max-w-[110px] truncate">
                {profile?.displayName || user?.email?.split("@")[0] || profile?.email?.split("@")[0]}
              </span>
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
            >
              Entrar / Cadastrar
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
