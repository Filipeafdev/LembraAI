import express, { Request, Response } from "express";
import { parseAppointmentFromImage, parseAppointmentFromVoiceText } from "./gemini.ts";
import {
  fetchBotInfo,
  sendTestAlert,
  sendAppointmentAlert,
  getBotToken,
} from "./telegram.ts";

export const apiRouter = express.Router();

// Parse JSON and increase payload limit for base64 image OCR
apiRouter.use(express.json({ limit: "25mb" }));
apiRouter.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Healthcheck
apiRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    appName: "LembraAI",
    telegramBotConfigured: Boolean(getBotToken()),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    serverTime: new Date().toISOString(),
  });
});

// Gemini: Parse image (OCR + extraction)
apiRouter.post("/gemini/parse-image", async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", referenceDate } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Imagem em base64 não fornecida." });
    }

    const refDate = referenceDate || new Date().toISOString();
    // Clean base64 string if it contains data URI prefix
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

    const extracted = await parseAppointmentFromImage(cleanBase64, mimeType, refDate);
    return res.json({ success: true, data: extracted });
  } catch (error: any) {
    console.error("Error parsing appointment from image:", error);
    return res.status(500).json({
      error: error.message || "Falha ao processar a imagem com Inteligência Artificial.",
    });
  }
});

// Gemini: Parse voice transcript / natural text
apiRouter.post("/gemini/parse-voice-text", async (req: Request, res: Response) => {
  try {
    const { transcript, referenceDate } = req.body;
    if (!transcript || typeof transcript !== "string") {
      return res.status(400).json({ error: "Texto transcrito não fornecido." });
    }

    const refDate = referenceDate || new Date().toISOString();
    const extracted = await parseAppointmentFromVoiceText(transcript, refDate);
    return res.json({ success: true, data: extracted });
  } catch (error: any) {
    console.error("Error parsing voice transcript:", error);
    return res.status(500).json({
      error: error.message || "Falha ao interpretar o comando de voz com Inteligência Artificial.",
    });
  }
});

// Telegram: Get bot info (username, status)
apiRouter.get("/telegram/bot-info", async (_req: Request, res: Response) => {
  try {
    const info = await fetchBotInfo();
    return res.json(info);
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Telegram: Send test message
apiRouter.post("/telegram/test", async (req: Request, res: Response) => {
  try {
    const { chatId, userName, email } = req.body;
    if (!chatId) {
      return res.status(400).json({
        ok: false,
        error: "Chat ID do Telegram não informado. Por favor, preencha nas configurações.",
      });
    }

    const result = await sendTestAlert(String(chatId), userName, email);
    if (result.ok) {
      return res.json({ ok: true, message: "Mensagem de teste enviada com sucesso no Telegram!" });
    } else {
      return res.status(400).json({
        ok: false,
        error: result.description || "Não foi possível enviar a mensagem no Telegram. Verifique se iniciou o bot com /start.",
      });
    }
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Telegram: Send appointment notification
apiRouter.post("/telegram/send-reminder", async (req: Request, res: Response) => {
  try {
    const { chatId, appointment, timingLabel = "Lembrete de compromisso" } = req.body;
    if (!chatId || !appointment || !appointment.title) {
      return res.status(400).json({ ok: false, error: "Dados insuficientes para envio." });
    }

    const result = await sendAppointmentAlert(String(chatId), appointment, timingLabel);
    if (result.ok) {
      return res.json({ ok: true, messageId: result.messageId });
    } else {
      return res.status(400).json({ ok: false, error: result.description });
    }
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});
