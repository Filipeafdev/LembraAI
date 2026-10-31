/**
 * Direct & Fallback Client for Telegram Bot API
 * Directly interacts with Telegram Bot API (which supports CORS with Access-Control-Allow-Origin: *)
 * and falls back to backend proxy if necessary.
 */

export const DEFAULT_TELEGRAM_BOT_TOKEN = "9114678445:AAFEhxf3RQE2mfom6_bll8nU2-rmpdtMICY";
export const DEFAULT_BOT_USERNAME = "lembra_ai_notif_bot";

export interface TelegramRecentChat {
  chatId: string;
  name: string;
  username?: string;
  lastMessage?: string;
  date?: number;
}

/**
 * Sends a Telegram message directly from the browser (or via server fallback).
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<{ ok: boolean; messageId?: number; description?: string }> {
  const cleanId = String(chatId).trim();

  if (!cleanId) {
    return { ok: false, description: "Chat ID não informado. Preencha o seu Chat ID nas configurações." };
  }

  if (cleanId.startsWith("@")) {
    return {
      ok: false,
      description:
        "O Telegram não aceita @username para envio privado. Use o Chat ID numérico (ex: 1991960111).",
    };
  }

  // 1. Try Direct Telegram Bot API (Supports CORS out of the box)
  try {
    const directRes = await fetch(
      `https://api.telegram.org/bot${DEFAULT_TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cleanId,
          text,
          parse_mode: parseMode,
        }),
      }
    );

    const directData = await directRes.json();
    if (directData.ok) {
      return { ok: true, messageId: directData.result?.message_id };
    } else {
      let desc = directData.description || "Erro retornado pela API do Telegram";
      if (desc.includes("chat not found")) {
        desc =
          "Chat não encontrado. Abra o bot no Telegram (@lembra_ai_notif_bot) e clique em 'COMEÇAR / START' para permitir mensagens.";
      } else if (desc.includes("bot was blocked by the user")) {
        desc = "O bot está bloqueado no seu Telegram. Desbloqueie @lembra_ai_notif_bot.";
      }
      return { ok: false, description: desc };
    }
  } catch (directErr: any) {
    console.warn("Direct Telegram API call failed, trying server proxy:", directErr);
  }

  // 2. Fallback to Server Proxy
  try {
    const proxyRes = await fetch("/api/telegram/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: cleanId,
      }),
    });

    const proxyData = await proxyRes.json();
    if (proxyData.ok) {
      return { ok: true };
    } else {
      return { ok: false, description: proxyData.error || "Não foi possível enviar a mensagem." };
    }
  } catch (proxyErr: any) {
    return {
      ok: false,
      description: "Erro de conexão ao enviar mensagem ao Telegram. Verifique sua conexão.",
    };
  }
}

/**
 * Reads recent incoming messages from the bot to detect the user's Chat ID.
 */
export async function getRecentTelegramChats(): Promise<{
  ok: boolean;
  chats: TelegramRecentChat[];
  error?: string;
}> {
  // 1. Direct Telegram getUpdates call
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${DEFAULT_TELEGRAM_BOT_TOKEN}/getUpdates?limit=50&offset=-25`
    );
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      const chatsMap = new Map<string, TelegramRecentChat>();
      for (const update of data.result) {
        const msg = update.message || update.edited_message || update.channel_post;
        if (msg && msg.chat) {
          const chatId = String(msg.chat.id);
          const name =
            [msg.chat.first_name, msg.chat.last_name].filter(Boolean).join(" ") ||
            msg.chat.title ||
            "Usuário Telegram";
          chatsMap.set(chatId, {
            chatId,
            name,
            username: msg.chat.username,
            lastMessage: msg.text || "",
            date: msg.date,
          });
        }
      }
      const list = Array.from(chatsMap.values()).reverse();
      return { ok: true, chats: list };
    }
  } catch (err: any) {
    console.warn("Direct getUpdates failed, trying server proxy:", err);
  }

  // 2. Server proxy fallback
  try {
    const proxyRes = await fetch("/api/telegram/recent-chats");
    const data = await proxyRes.json();
    if (data.ok && Array.isArray(data.chats)) {
      return { ok: true, chats: data.chats };
    }
    return { ok: false, chats: [], error: data.error };
  } catch (e: any) {
    return { ok: false, chats: [], error: e.message };
  }
}

/**
 * Sends a rich test alert to the user.
 */
export async function sendTelegramTestAlert(
  chatId: string,
  userName?: string,
  email?: string
): Promise<{ ok: boolean; description?: string }> {
  const message = `🔔 <b>LembraAI • Conexão Estabelecida com Sucesso!</b>\n\nOlá${
    userName ? `, <b>${userName}</b>` : ""
  }! 👋\n\nSeu aplicativo <b>LembraAI</b> agora está sincronizado com este chat!\n${
    email ? `Conta vinculada: <code>${email}</code>\n` : ""
  }\n📌 <b>O que você receberá aqui:</b>\n• Alertas 24h, 2h e 15min antes de cada compromisso.\n• Alertas imediatos caso você adie ou confirme.\n• Informações de horário, local e dicas de preparação.\n\n<i>LembraAI • Inteligência a favor da sua tranquilidade.</i>`;

  return sendTelegramMessage(chatId, message, "HTML");
}

/**
 * Sends an appointment alert card to the user's Telegram.
 */
export async function sendTelegramAppointmentAlert(
  chatId: string,
  appointment: {
    title: string;
    date: string;
    time: string;
    location?: string;
    category?: string;
    recurrence?: string;
    description?: string;
  },
  timingLabel: string
): Promise<{ ok: boolean; description?: string }> {
  const categoryEmojis: Record<string, string> = {
    saude: "🩺 Saúde / Médico",
    trabalho: "💼 Trabalho",
    familia: "🏡 Família",
    financas: "💰 Finanças",
    estudos: "📚 Estudos",
    pessoal: "⭐ Pessoal",
    outro: "📌 Outro",
  };

  const recurrenceLabels: Record<string, string> = {
    none: "Evento Único",
    weekly: "Semanal",
    monthly: "Mensal",
  };

  const [year, month, day] = (appointment.date || "").split("-");
  const formattedDate = year && month && day ? `${day}/${month}/${year}` : appointment.date;

  const categoryName = categoryEmojis[appointment.category || "outro"] || "📌 Compromisso";
  const recurrenceText = recurrenceLabels[appointment.recurrence || "none"] || "Único";

  const message = `⏰ <b>LEMBRETE DE COMPROMISSO • LEMBRAAI</b> 🔔\n━━━━━━━━━━━━━━━━━━━━\n<b>${timingLabel.toUpperCase()}</b>\n\n📌 <b>Compromisso:</b> ${
    appointment.title
  }\n📅 <b>Data:</b> ${formattedDate}\n🕒 <b>Horário:</b> ${
    appointment.time || "Não informado"
  }\n${appointment.location ? `📍 <b>Local:</b> ${appointment.location}\n` : ""}${
    appointment.description ? `📝 <b>Notas:</b> ${appointment.description}\n` : ""
  }🏷️ <b>Categoria:</b> ${categoryName}\n🔁 <b>Repetição:</b> ${recurrenceText}\n━━━━━━━━━━━━━━━━━━━━\n<i>LembraAI • Não se preocupe em esquecer!</i>`;

  return sendTelegramMessage(chatId, message, "HTML");
}
