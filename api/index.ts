import express, { Request, Response } from "express";
import { parseAppointmentFromImage, parseAppointmentFromVoiceText } from "./gemini.ts";
import {
  fetchBotInfo,
  fetchRecentUpdates,
  sendTestAlert,
  sendAppointmentAlert,
  getBotToken,
} from "./telegram.ts";

export const apiApp = express();

export const sendJson = (res: any, status: number, data: any) => {
  try {
    if (typeof res.status === "function" && typeof res.json === "function") {
      return res.status(status).json(data);
    }
  } catch (e) {
    // fallback
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
};

// Body parsing
apiApp.use(express.json({ limit: "25mb" }));
apiApp.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Healthcheck
apiApp.get("/health", (_req: Request, res: Response) => {
  sendJson(res, 200, {
    status: "ok",
    appName: "LembraAI",
    telegramBotConfigured: Boolean(getBotToken()),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    serverTime: new Date().toISOString(),
  });
});

// Gemini: Parse image (OCR + extraction)
apiApp.post("/gemini/parse-image", async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", referenceDate } = req.body;
    if (!imageBase64) {
      return sendJson(res, 400, { error: "Imagem em base64 não fornecida." });
    }

    const refDate = referenceDate || new Date().toISOString();
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

    const extracted = await parseAppointmentFromImage(cleanBase64, mimeType, refDate);
    return sendJson(res, 200, { success: true, data: extracted });
  } catch (error: any) {
    console.error("Error parsing appointment from image:", error);
    return sendJson(res, 500, {
      error: error.message || "Falha ao processar a imagem com Inteligência Artificial.",
    });
  }
});

// Gemini: Parse voice transcript / natural text
apiApp.post("/gemini/parse-voice-text", async (req: Request, res: Response) => {
  try {
    const { transcript, referenceDate } = req.body;
    if (!transcript || typeof transcript !== "string") {
      return sendJson(res, 400, { error: "Texto transcrito não fornecido." });
    }

    const refDate = referenceDate || new Date().toISOString();
    const extracted = await parseAppointmentFromVoiceText(transcript, refDate);
    return sendJson(res, 200, { success: true, data: extracted });
  } catch (error: any) {
    console.error("Error parsing voice transcript:", error);
    return sendJson(res, 500, {
      error: error.message || "Falha ao interpretar o comando de voz com Inteligência Artificial.",
    });
  }
});

// Telegram: Get bot info (username, status)
apiApp.get("/telegram/bot-info", async (_req: Request, res: Response) => {
  try {
    const info = await fetchBotInfo();
    return sendJson(res, 200, info);
  } catch (error: any) {
    return sendJson(res, 500, { ok: false, error: error.message });
  }
});

// Telegram: Get recent incoming messages to detect chat ID automatically
apiApp.get("/telegram/recent-chats", async (_req: Request, res: Response) => {
  try {
    const result = await fetchRecentUpdates();
    return sendJson(res, 200, result);
  } catch (error: any) {
    return sendJson(res, 500, { ok: false, chats: [], error: error.message });
  }
});

// Telegram: Send test message
apiApp.post("/telegram/test", async (req: Request, res: Response) => {
  try {
    const { chatId, userName, email } = req.body;
    if (!chatId) {
      return sendJson(res, 400, {
        ok: false,
        error: "Chat ID do Telegram não informado. Por favor, preencha nas configurações.",
      });
    }

    const result = await sendTestAlert(String(chatId), userName, email);
    if (result.ok) {
      return sendJson(res, 200, { ok: true, message: "Mensagem de teste enviada com sucesso no Telegram!" });
    } else {
      return sendJson(res, 400, {
        ok: false,
        error: result.description || "Não foi possível enviar a mensagem no Telegram. Verifique se iniciou o bot com /start.",
      });
    }
  } catch (error: any) {
    return sendJson(res, 500, { ok: false, error: error.message });
  }
});

// Telegram: Send appointment notification
apiApp.post("/telegram/send-reminder", async (req: Request, res: Response) => {
  try {
    const { chatId, appointment, timingLabel = "Lembrete de compromisso" } = req.body;
    if (!chatId || !appointment || !appointment.title) {
      return sendJson(res, 400, { ok: false, error: "Dados insuficientes para envio." });
    }

    const result = await sendAppointmentAlert(String(chatId), appointment, timingLabel);
    if (result.ok) {
      return sendJson(res, 200, { ok: true, messageId: result.messageId });
    } else {
      return sendJson(res, 400, { ok: false, error: result.description });
    }
  } catch (error: any) {
    return sendJson(res, 500, { ok: false, error: error.message });
  }
});

export const apiRouter = apiApp;
