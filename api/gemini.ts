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

// Fallback logic for date calculation in Brazilian Portuguese
function extractPortugueseNaturalDate(text: string, baseDateStr?: string): { date: string; time: string } {
  const base = baseDateStr ? new Date(baseDateStr) : new Date();
  const lower = text.toLowerCase();

  let targetDate = new Date(base.getTime());

  if (lower.includes("depois de amanhã")) {
    targetDate.setDate(targetDate.getDate() + 2);
  } else if (lower.includes("amanhã") || lower.includes("amanha")) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (lower.includes("hoje")) {
    // keep today
  } else {
    // Check day of week
    const daysMap: Record<string, number> = {
      domingo: 0,
      segunda: 1,
      terça: 2,
      terca: 2,
      quarta: 3,
      quinta: 4,
      sexta: 5,
      sábado: 6,
      sabado: 6,
    };
    for (const [name, dayNum] of Object.entries(daysMap)) {
      if (lower.includes(name)) {
        const currentDay = targetDate.getDay();
        let diff = dayNum - currentDay;
        if (diff <= 0) diff += 7;
        targetDate.setDate(targetDate.getDate() + diff);
        break;
      }
    }
  }

  // Extract time like "às 15h", "15:30", "às 14 horas", "9h da manhã", "3 da tarde"
  let timeStr = "09:00";
  const timeMatch = lower.match(/(?:às|as)?\s*(\d{1,2})(?::(\d{2})|\s*h(?:oras)?|\s*da\s*(tarde|noite|manhã|manha))?/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = timeMatch[3];

    if ((period === "tarde" || period === "noite") && hours < 12) {
      hours += 12;
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    timeStr = `${pad(hours)}:${pad(mins)}`;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;

  return { date: dateStr, time: timeStr };
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
2. Data exata no formato AAAA-MM-DD.
3. Horário de início no formato HH:MM (24h). Se não houver horário especificado, sugira 09:00.
4. Local físico ou link/plataforma virtual.
5. Categoria mais adequada entre: saude, trabalho, familia, financas, estudos, pessoal, outro.
6. Descrição ou observações úteis.
7. Frequência sugerida: 'none', 'weekly' ou 'monthly'.
8. Lembretes sugeridos em minutos: [1440, 120, 15].`;

  const imagePart = {
    inlineData: {
      mimeType,
      data: base64Data,
    },
  };

  const schema = {
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
  };

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: {
        parts: [imagePart, { text: prompt }],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
  } catch (err: any) {
    console.warn("Primary model error, attempting gemini-flash-latest fallback:", err.message);
    response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: {
        parts: [imagePart, { text: prompt }],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
  }

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
  const schema = {
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
  };

  const prompt = `Você é o assistente inteligente do LembraAI, uma agenda com foco em acessibilidade e combate a esquecimentos.
O usuário disse por voz o seguinte comando:
"${transcript}"

Data de referência de hoje: ${currentDateIso}.

Interprete a intenção do usuário:
- Entenda expressões em português como "amanhã", "depois de amanhã", "segunda-feira", "semana que vem", "às 3 da tarde" (15:00), "às 9h", "dia 12", "todo sábado", "todo dia 5".
- Extraia ou deduza o título, data (AAAA-MM-DD), horário (HH:MM), local, categoria adequada (saude, trabalho, familia, financas, estudos, pessoal, outro), descrição e recorrência ('none', 'weekly' se disse semanal/todo ..., ou 'monthly' se disse mensal).
- Sugira minutos de antecedência [1440, 120, 15].`;

  try {
    const ai = getGeminiClient();
    let response;

    try {
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });
    } catch (modelErr: any) {
      console.warn("Primary model error, attempting gemini-flash-latest fallback:", modelErr.message);
      response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });
    }

    const parsedText = (response.text ?? "{}").trim();
    const data = JSON.parse(parsedText) as ExtractedAppointment;
    if (!data.remindersMinutesBefore || data.remindersMinutesBefore.length === 0) {
      data.remindersMinutesBefore = [1440, 120, 15];
    }
    return data;
  } catch (err: any) {
    console.warn("Gemini API call failed, using Portuguese heuristic extraction:", err.message);

    // Resilient local Portuguese fallback so the user is NEVER blocked
    const { date, time } = extractPortugueseNaturalDate(transcript, currentDateIso);
    const lower = transcript.toLowerCase();

    let cat: ExtractedAppointment["category"] = "outro";
    if (lower.includes("médic") || lower.includes("medic") || lower.includes("dentista") || lower.includes("consulta") || lower.includes("remédio") || lower.includes("exame") || lower.includes("cardiologista")) {
      cat = "saude";
    } else if (lower.includes("reunião") || lower.includes("reuniao") || lower.includes("trabalho") || lower.includes("chefe") || lower.includes("projeto")) {
      cat = "trabalho";
    } else if (lower.includes("pagar") || lower.includes("conta") || lower.includes("boleto") || lower.includes("banco")) {
      cat = "financas";
    } else if (lower.includes("aula") || lower.includes("prova") || lower.includes("curso") || lower.includes("estudar")) {
      cat = "estudos";
    } else if (lower.includes("aniversário") || lower.includes("mãe") || lower.includes("pai") || lower.includes("filh")) {
      cat = "familia";
    }

    // Clean title
    let cleanTitle = transcript
      .replace(/^(lembrar de|agendar|marcar|anotar|novo compromisso|lembrete de)\s+/i, "")
      .trim();
    if (!cleanTitle) cleanTitle = "Compromisso por Voz";
    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

    return {
      title: cleanTitle,
      date,
      time,
      location: "",
      category: cat,
      description: `Comando por voz: "${transcript}"`,
      recurrence: lower.includes("toda semana") || lower.includes("toda ") ? "weekly" : lower.includes("todo mês") ? "monthly" : "none",
      remindersMinutesBefore: [1440, 120, 15],
    };
  }
}
