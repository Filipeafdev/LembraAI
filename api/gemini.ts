import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client with server API key and required User-Agent
export const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

export interface ExtractedAppointment {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  category: "saude" | "trabalho" | "familia" | "financas" | "estudos" | "pessoal" | "outro";
  description: string;
  recurrence: "none" | "weekly" | "monthly";
  remindersMinutesBefore: number[];
  confidenceScore?: number;
}

/**
 * Extracts appointment details from an image (invitations, medical prescriptions, signs, chat screenshots)
 */
export async function parseAppointmentFromImage(
  base64Data: string,
  mimeType: string,
  currentDateIso: string
): Promise<ExtractedAppointment> {
  const ai = getGeminiClient();

  const prompt = `Você é o assistente inteligente do LembraAI, especialista em acessibilidade e em identificar compromissos em fotos, convites, cartazes, comprovantes médicos ou prints.
Data de referência de hoje: ${currentDateIso}.

Analise a imagem com atenção e extraia os dados do compromisso:
1. Título claro e objetivo do evento ou tarefa.
2. Data exata no formato AAAA-MM-DD (se mencionar dias relativos como 'próxima quinta' ou 'dia 15', calcule com base na data de hoje).
3. Horário de início no formato HH:MM (24h). Se não houver horário especificado, sugira 09:00.
4. Local físico ou link/plataforma virtual (ex: Hospital São Paulo, Zoom, etc.).
5. Categoria mais adequada entre: saude, trabalho, familia, financas, estudos, pessoal, outro.
6. Descrição ou observações úteis (médico, documentos a levar, traje, etc.).
7. Frequência sugerida: 'none' (único), 'weekly' (semanal) ou 'monthly' (mensal).
8. Lembretes sugeridos em minutos antes do evento: padrão [1440, 120, 15] (1 dia antes, 2 horas antes, 15 min antes).`;

  const imagePart = {
    inlineData: {
      mimeType,
      data: base64Data,
    },
  };

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: {
      parts: [imagePart, { text: prompt }],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Título do compromisso" },
          date: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" },
          time: { type: Type.STRING, description: "Horário no formato HH:MM (24 horas)" },
          location: { type: Type.STRING, description: "Local ou endereço" },
          category: {
            type: Type.STRING,
            enum: ["saude", "trabalho", "familia", "financas", "estudos", "pessoal", "outro"],
            description: "Categoria do compromisso",
          },
          description: { type: Type.STRING, description: "Notas adicionais importantes" },
          recurrence: {
            type: Type.STRING,
            enum: ["none", "weekly", "monthly"],
            description: "Recorrência",
          },
          remindersMinutesBefore: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: "Minutos de antecedência para alertas",
          },
        },
        required: ["title", "date", "time", "category", "recurrence"],
      },
    },
  });

  const parsedText = (response.text ?? "{}").trim();
  const data = JSON.parse(parsedText) as ExtractedAppointment;
  if (!data.remindersMinutesBefore || data.remindersMinutesBefore.length === 0) {
    data.remindersMinutesBefore = [1440, 120, 15];
  }
  return data;
}

/**
 * Extracts appointment details from speech/text command (e.g. "Lembrar de dentista amanhã às 14h")
 */
export async function parseAppointmentFromVoiceText(
  transcript: string,
  currentDateIso: string
): Promise<ExtractedAppointment> {
  const ai = getGeminiClient();

  const prompt = `Você é o assistente inteligente do LembraAI, uma agenda com foco em acessibilidade e combate a esquecimentos.
O usuário disse por voz o seguinte comando:
"${transcript}"

Data de referência de hoje: ${currentDateIso}.

Interprete a intenção do usuário:
- Entenda expressões em português como "amanhã", "depois de amanhã", "segunda-feira", "semana que vem", "às 3 da tarde" (15:00), "às 9h", "dia 12", "todo sábado", "todo dia 5".
- Extraia ou deduza o título, data (AAAA-MM-DD), horário (HH:MM), local, categoria adequada (saude, trabalho, familia, financas, estudos, pessoal, outro), descrição e recorrência ('none', 'weekly' se disse semanal/todo ..., ou 'monthly' se disse mensal).
- Sugira minutos de antecedência [1440, 120, 15].`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Título do compromisso" },
          date: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" },
          time: { type: Type.STRING, description: "Horário no formato HH:MM" },
          location: { type: Type.STRING, description: "Local do compromisso" },
          category: {
            type: Type.STRING,
            enum: ["saude", "trabalho", "familia", "financas", "estudos", "pessoal", "outro"],
            description: "Categoria do compromisso",
          },
          description: { type: Type.STRING, description: "Observações ou contexto extraído" },
          recurrence: {
            type: Type.STRING,
            enum: ["none", "weekly", "monthly"],
            description: "Recorrência",
          },
          remindersMinutesBefore: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: "Minutos de antecedência para notificações",
          },
        },
        required: ["title", "date", "time", "category", "recurrence"],
      },
    },
  });

  const parsedText = (response.text ?? "{}").trim();
  const data = JSON.parse(parsedText) as ExtractedAppointment;
  if (!data.remindersMinutesBefore || data.remindersMinutesBefore.length === 0) {
    data.remindersMinutesBefore = [1440, 120, 15];
  }
  return data;
}
