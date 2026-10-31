import React, { useState, useEffect } from "react";
import {
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Copy,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.tsx";

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, profile, updateTelegramChatId } = useAuth();
  const [chatIdInput, setChatIdInput] = useState(profile?.telegramChatId || "");
  const [isSaving, setIsSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  const [botInfo, setBotInfo] = useState<{
    username?: string;
    firstName?: string;
    loading: boolean;
  }>({ loading: true });

  useEffect(() => {
    if (profile?.telegramChatId !== undefined) {
      setChatIdInput(profile.telegramChatId || "");
    }
  }, [profile?.telegramChatId]);

  // Fetch bot info from server
  useEffect(() => {
    if (!isOpen) return;
    const fetchInfo = async () => {
      try {
        const res = await fetch("/api/telegram/bot-info");
        const data = await res.json();
        if (data.ok) {
          setBotInfo({
            username: data.username,
            firstName: data.firstName,
            loading: false,
          });
        } else {
          setBotInfo({ loading: false });
        }
      } catch (e) {
        setBotInfo({ loading: false });
      }
    };
    fetchInfo();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!user && !profile) return;
    setIsSaving(true);
    try {
      await updateTelegramChatId(chatIdInput.trim());
      setIsSaving(false);
    } catch (err) {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const targetChatId = chatIdInput.trim();
    if (!targetChatId) {
      setTestStatus({
        loading: false,
        success: false,
        message: "Por favor, digite o seu Chat ID antes de testar.",
      });
      return;
    }

    // Auto save before test
    await updateTelegramChatId(targetChatId);

    setTestStatus({ loading: true });
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: targetChatId,
          userName: profile?.displayName || user?.displayName,
          email: user?.email,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setTestStatus({
          loading: false,
          success: true,
          message: "Mensagem de teste enviada com sucesso! Verifique seu Telegram agora.",
        });
      } else {
        setTestStatus({
          loading: false,
          success: false,
          message:
            data.error ||
            "Não foi possível entregar a mensagem. Lembre-se de abrir o bot no Telegram e clicar em /start.",
        });
      }
    } catch (err: any) {
      setTestStatus({
        loading: false,
        success: false,
        message: err.message || "Erro de conexão ao testar o bot.",
      });
    }
  };

  const botLink = botInfo.username
    ? `https://t.me/${botInfo.username}`
    : "https://t.me/lembra_ai_bot";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-blue-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Configurações do Telegram</h2>
              <p className="text-xs text-sky-100">
                Receba lembretes automáticos e nunca esqueça de nada
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar configurações do Telegram"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Step-by-Step Instructions */}
          <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sky-900 font-bold text-sm">
              <Info className="w-4 h-4 text-sky-600" />
              <span>Como obter seu Chat ID em 2 passos rápidos:</span>
            </div>

            <ol className="text-xs text-slate-700 space-y-2.5 list-decimal list-inside leading-relaxed">
              <li>
                Abra o Telegram e inicie nosso bot oficial:
                <div className="mt-1">
                  <a
                    href={botLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition text-xs shadow-xs"
                  >
                    <span>Abrir Bot no Telegram</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </li>
              <li>
                Clique no botão <b>INICIAR / START</b> no bot.
              </li>
              <li>
                Para saber seu Chat ID, abra o bot gratuito{" "}
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-sky-700 underline"
                >
                  @userinfobot
                </a>{" "}
                no Telegram e envie qualquer mensagem. Ele responderá com o seu <b>Id</b> numérico.
              </li>
            </ol>
          </div>

          {/* Form Input for Chat ID */}
          <div className="space-y-2">
            <label
              htmlFor="chatIdInput"
              className="text-sm font-bold text-slate-800 flex items-center justify-between"
            >
              <span>Seu Chat ID Numérico:</span>
              <span className="text-xs font-normal text-slate-500">Ex: 123456789</span>
            </label>
            <div className="relative">
              <input
                id="chatIdInput"
                type="text"
                value={chatIdInput}
                onChange={(e) => setChatIdInput(e.target.value)}
                placeholder="Cole aqui seu Chat ID do Telegram"
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-200 focus:border-sky-500 focus:outline-hidden text-base font-semibold text-slate-800 placeholder:text-slate-400 transition"
              />
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Privacidade garantida: cada usuário tem sua própria conta e ID isolados.
            </p>
          </div>

          {/* Test Status Feedback Banner */}
          {testStatus.message && (
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed animate-in fade-in ${
                testStatus.success
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : "bg-rose-50 text-rose-900 border-rose-200"
              }`}
            >
              {testStatus.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{testStatus.message}</p>
                {!testStatus.success && (
                  <p className="mt-1 text-slate-600">
                    Dica: Certifique-se de que clicou em <b>/start</b> no nosso bot antes de testar.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={handleTestConnection}
              disabled={testStatus.loading || !chatIdInput.trim()}
              className="w-full py-3.5 px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-sky-600/20"
            >
              {testStatus.loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando mensagem de teste...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Testar Conexão com Telegram Agora</span>
                </>
              )}
            </button>

            <button
              onClick={async () => {
                await handleSave();
                onClose();
              }}
              disabled={isSaving}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition"
            >
              {isSaving ? "Salvando..." : "Salvar e Fechar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
