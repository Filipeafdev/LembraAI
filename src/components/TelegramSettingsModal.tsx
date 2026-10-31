import React, { useState, useEffect } from "react";
import {
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Info,
  Loader2,
  Sparkles,
  Bot,
  RefreshCw,
  Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.tsx";

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RecentChat {
  chatId: string;
  name: string;
  username?: string;
  lastMessage?: string;
  date?: number;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, profile, updateTelegramChatId } = useAuth();
  const [chatIdInput, setChatIdInput] = useState(
    profile?.telegramChatId || "1991960111"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectNotice, setDetectNotice] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);

  const [testStatus, setTestStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  const [botInfo, setBotInfo] = useState<{
    username: string;
    firstName: string;
    loading: boolean;
  }>({
    username: "lembra_ai_notif_bot",
    firstName: "LembraAI Bot",
    loading: false,
  });

  useEffect(() => {
    if (profile?.telegramChatId) {
      setChatIdInput(profile.telegramChatId);
    } else {
      setChatIdInput("1991960111");
    }
  }, [profile?.telegramChatId]);

  // Fetch bot info and recent chats from server
  useEffect(() => {
    if (!isOpen) return;

    const fetchInfoAndChats = async () => {
      try {
        const res = await fetch("/api/telegram/bot-info");
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data.ok && data.username) {
            setBotInfo({
              username: data.username,
              firstName: data.firstName || "LembraAI Bot",
              loading: false,
            });
          } else {
            setBotInfo((prev) => ({ ...prev, loading: false }));
          }
        } catch {
          setBotInfo((prev) => ({ ...prev, loading: false }));
        }
      } catch (e) {
        setBotInfo((prev) => ({ ...prev, loading: false }));
      }

      // Check if user already interacted with the bot to auto-fill
      try {
        const resChats = await fetch("/api/telegram/recent-chats");
        const chatsText = await resChats.text();
        const dataChats = JSON.parse(chatsText);
        if (dataChats.ok && Array.isArray(dataChats.chats) && dataChats.chats.length > 0) {
          const latest = dataChats.chats[0];
          if (!profile?.telegramChatId) {
            setChatIdInput(latest.chatId);
            setDetectNotice({
              type: "success",
              text: `Encontramos sua mensagem recente no Telegram! Chat ID: ${latest.chatId} (${latest.name}). Clique em "Testar Conexão" para confirmar.`,
            });
          }
        }
      } catch {
        // silent check
      }
    };

    fetchInfoAndChats();
  }, [isOpen, profile?.telegramChatId]);

  if (!isOpen) return null;

  const botUsername = botInfo.username || "lembra_ai_notif_bot";
  const botLink = `https://t.me/${botUsername}`;

  // Check if input has letters or starts with @
  const isInputNonNumeric = Boolean(
    chatIdInput && (chatIdInput.startsWith("@") || /[a-zA-Z]/.test(chatIdInput))
  );

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

  // Automatically detect user's Chat ID from recent bot messages
  const handleDetectChatId = async () => {
    setIsDetecting(true);
    setDetectNotice(null);
    setTestStatus({ loading: false });

    try {
      const res = await fetch("/api/telegram/recent-chats");
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Resposta inesperada do servidor ao buscar mensagens.");
      }

      if (data.ok && Array.isArray(data.chats) && data.chats.length > 0) {
        const latest: RecentChat = data.chats[0];
        setChatIdInput(latest.chatId);
        await updateTelegramChatId(latest.chatId);

        setDetectNotice({
          type: "success",
          text: `Chat ID detectado com sucesso: ${latest.chatId} (${latest.name}${
            latest.username ? ` • @${latest.username}` : ""
          })! Enviando teste...`,
        });

        // Trigger test immediately with detected ID
        await runTestWithId(latest.chatId);
      } else {
        setDetectNotice({
          type: "warning",
          text: `Ainda não recebemos mensagem sua no bot. Passo a passo: 1. Abra o link do bot (${botLink}); 2. Envie /start ou qualquer mensagem; 3. Clique em "Detectar Meu Chat ID" novamente!`,
        });
      }
    } catch (err: any) {
      setDetectNotice({
        type: "error",
        text: err.message || "Erro ao consultar mensagens recentes do bot.",
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const runTestWithId = async (targetChatId: string) => {
    const cleanId = targetChatId.trim();
    if (!cleanId) {
      setTestStatus({
        loading: false,
        success: false,
        message: "Por favor, informe o seu Chat ID numérico antes de testar.",
      });
      return;
    }

    // Auto save
    await updateTelegramChatId(cleanId);

    setTestStatus({ loading: true });
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: cleanId,
          userName: profile?.displayName || user?.displayName,
          email: profile?.email || user?.email,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setTestStatus({
          loading: false,
          success: true,
          message: "Mensagem de teste enviada com sucesso! Verifique seu Telegram agora mesmo.",
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-blue-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Conectar com Telegram</h2>
              <p className="text-xs text-sky-100">
                Receba lembretes automáticos e nunca perca seus compromissos
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
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Step 1: Open Bot */}
          <div className="bg-gradient-to-br from-sky-50 to-blue-50/50 border-2 border-sky-200 rounded-3xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 text-sky-950 font-extrabold text-sm">
              <Bot className="w-5 h-5 text-sky-600" />
              <span>Passo 1: Iniciar o Bot Oficial</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              No Telegram, por privacidade, <b>um bot só pode enviar mensagens se você iniciá-lo primeiro</b>. Abra o bot do LembraAI e toque em <b>COMEÇAR / START</b>:
            </p>
            <div>
              <a
                href={botLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs transition shadow-md shadow-sky-600/20"
              >
                <span>Abrir @{botUsername} no Telegram</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Step 2: Auto Detect Button (Magical 1-Click) */}
          <div className="bg-emerald-50/70 border-2 border-emerald-200 rounded-3xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-950 font-extrabold text-sm">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <span>Passo 2: Detectar Chat ID com 1 Clique</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                Automático
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Após clicar em <b>COMEÇAR / START</b> no bot, clique no botão abaixo. O sistema lerá sua mensagem e preencherá seu Chat ID automaticamente!
            </p>
            <button
              type="button"
              onClick={handleDetectChatId}
              disabled={isDetecting}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20"
            >
              {isDetecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procurando mensagem no bot...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Detectar Meu Chat ID Automaticamente</span>
                </>
              )}
            </button>

            {/* Detection feedback */}
            {detectNotice && (
              <div
                className={`p-3 rounded-2xl text-xs font-semibold flex items-start gap-2 animate-in fade-in ${
                  detectNotice.type === "success"
                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                    : detectNotice.type === "warning"
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-rose-100 text-rose-900 border border-rose-300"
                }`}
              >
                {detectNotice.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                )}
                <span>{detectNotice.text}</span>
              </div>
            )}
          </div>

          {/* Form Input for Chat ID (Manual or detected) */}
          <div className="space-y-2 pt-1">
            <label
              htmlFor="chatIdInput"
              className="text-xs font-bold text-slate-800 flex items-center justify-between"
            >
              <span>Ou digite seu Chat ID manualmente:</span>
              <span className="text-[11px] font-normal text-slate-500">Apenas números (Ex: 819283746)</span>
            </label>
            <div className="relative">
              <input
                id="chatIdInput"
                type="text"
                value={chatIdInput}
                onChange={(e) => setChatIdInput(e.target.value.trim())}
                placeholder="Ex: 819283746"
                className={`w-full px-4 py-3.5 rounded-2xl border-2 focus:outline-hidden text-base font-bold text-slate-800 placeholder:text-slate-400 transition ${
                  isInputNonNumeric
                    ? "border-amber-400 bg-amber-50/30 focus:border-amber-500"
                    : "border-slate-200 focus:border-sky-500 bg-white"
                }`}
              />
            </div>

            {/* Non-numeric warning */}
            {isInputNonNumeric && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Atenção: O Telegram não aceita @nome_de_usuario. Você deve inserir o ID numérico (ex: 123456789) ou usar o botão "Detectar" acima.
                </span>
              </div>
            )}

            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Seu ID é 100% privado e isolado apenas para os seus alertas.
            </p>
          </div>

          {/* Test Status Feedback Banner */}
          {testStatus.message && (
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed animate-in fade-in ${
                testStatus.success
                  ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                  : "bg-rose-50 text-rose-900 border-rose-300"
              }`}
            >
              {testStatus.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-bold text-sm">
                  {testStatus.success ? "Conexão Realizada!" : "Não foi possível entregar o lembrete"}
                </p>
                <p className="mt-1">{testStatus.message}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => runTestWithId(chatIdInput)}
              disabled={testStatus.loading || !chatIdInput.trim() || isInputNonNumeric}
              className="w-full py-3.5 px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-sky-600/20"
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
              className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm transition"
            >
              {isSaving ? "Salvando..." : "Salvar e Fechar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
