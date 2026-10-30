const DEFAULT_BOT_TOKEN = "9114678445:AAFEhxf3RQE2mfom6_bll8nU2-rmpdtMICY";

export function getBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
}

export interface TelegramBotInfo {
  ok: boolean;
  username?: string;
  firstName?: string;
  error?: string;
}

export async function fetchBotInfo(): Promise<TelegramBotInfo> {
  const token = getBotToken();
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok && data.result) {
      return {
        ok: true,
        username: data.result.username,
        firstName: data.result.first_name,
      };
    }
    return { ok: false, error: data.description || "Erro ao consultar bot do Telegram" };
  } catch (err: any) {
    return { ok: false, error: err.message || "Falha de rede ao conectar à API do Telegram" };
  }
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  parseMode: "Markdown" | "HTML" = "HTML"
): Promise<{ ok: boolean; messageId?: number; description?: string }> {
  const token = getBotToken();
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: String(chatId).trim(),
        text,
        parse_mode: parseMode,
      }),
    });

    const data = await response.json();
    if (data.ok) {
      return { ok: true, messageId: data.result.message_id };
    } else {
      console.error("Telegram API Error:", data);
      return { ok: false, description: data.description || "Erro desconhecido do Telegram" };
    }
  } catch (err: any) {
    console.error("Failed to send telegram message:", err);
    return { ok: false, description: err.message || "Erro de conexão com o Telegram" };
  }
}

export async function sendTestAlert(chatId: string, userName?: string, email?: string) {
  const message = `🔔 <b>LembraAI • Teste de Conexão com Sucesso!</b>

Olá${userName ? `, <b>${userName}</b>` : ""}! 👋

Seu aplicativo <b>LembraAI</b> foi conectado com sucesso a este chat do Telegram!
${email ? `Conta vinculada: <code>${email}</code>\n` : ""}
📌 <b>O que acontece a partir de agora:</b>
• Você receberá avisos automáticos dos seus compromissos (1 dia antes, 2 horas antes, 15 min antes).
• Não perca mais consultas, remédios, reuniões ou prazos importantes!
• Seus dados são 100% isolados e protegidos na sua conta.

<i>LembraAI • Inteligência a favor da sua tranquilidade.</i>`;

  return sendTelegramMessage(chatId, message, "HTML");
}

export async function sendAppointmentAlert(
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
) {
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

  // Format date to Brazilian format
  const [year, month, day] = (appointment.date || "").split("-");
  const formattedDate = year && month && day ? `${day}/${month}/${year}` : appointment.date;

  const categoryName = categoryEmojis[appointment.category || "outro"] || "📌 Compromisso";
  const recurrenceText = recurrenceLabels[appointment.recurrence || "none"] || "Único";

  const message = `⏰ <b>ALERTA DE COMPROMISSO • LEMBRAAI</b> 🔔
━━━━━━━━━━━━━━━━━━━━
<b>${timingLabel.toUpperCase()}</b>

📌 <b>Compromisso:</b> ${appointment.title}
📅 <b>Data:</b> ${formattedDate}
🕒 <b>Horário:</b> ${appointment.time || "Não informado"}
${appointment.location ? `📍 <b>Local:</b> ${appointment.location}\n` : ""}${
    appointment.description ? `📝 <b>Notas:</b> ${appointment.description}\n` : ""
}🏷️ <b>Categoria:</b> ${categoryName}
🔁 <b>Repetição:</b> ${recurrenceText}
━━━━━━━━━━━━━━━━━━━━
<i>Dica de acessibilidade: Deixe documentos e transporte preparados com antecedência!</i>`;

  return sendTelegramMessage(chatId, message, "HTML");
}
