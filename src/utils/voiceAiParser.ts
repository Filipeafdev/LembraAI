import { ExtractedAIAppointment, AppointmentCategory, RecurrenceType } from "../types/index.ts";

/**
 * Intelligent client-side Natural Language Parser for Brazilian Portuguese voice and text commands.
 * Runs instantly in the browser without network latency or proxy redirects, ensuring 100% reliability.
 */
export function parseVoiceCommandInClient(
  transcript: string,
  referenceDateIso?: string
): ExtractedAIAppointment {
  const base = referenceDateIso ? new Date(referenceDateIso) : new Date();
  const raw = transcript.trim();
  const lower = raw.toLowerCase();

  let targetDate = new Date(base.getTime());
  let extractedDateStr = "";

  // 1. DATE PARSING
  if (lower.includes("depois de amanhã") || lower.includes("depois de amanha")) {
    targetDate.setDate(targetDate.getDate() + 2);
  } else if (lower.includes("amanhã") || lower.includes("amanha")) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (lower.includes("hoje")) {
    // Keep today
  } else {
    // Check for days of the week
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

    let matchedDay = false;
    for (const [dayName, dayNum] of Object.entries(daysMap)) {
      if (lower.includes(dayName)) {
        const currentDay = base.getDay();
        let diff = dayNum - currentDay;
        if (diff <= 0) diff += 7; // Next occurrence
        targetDate.setDate(targetDate.getDate() + diff);
        matchedDay = true;
        break;
      }
    }

    // Check for explicit day of month (e.g. "dia 15", "dia 5 de novembro")
    if (!matchedDay) {
      const dayMatch = lower.match(/\bdia\s+(\d{1,2})(?:\s+de\s+([a-zç]+))?/i);
      if (dayMatch) {
        const dayOfMonth = parseInt(dayMatch[1], 10);
        if (dayOfMonth >= 1 && dayOfMonth <= 31) {
          const monthMap: Record<string, number> = {
            janeiro: 0,
            fevereiro: 1,
            março: 2,
            marco: 2,
            abril: 3,
            maio: 4,
            junho: 5,
            julho: 6,
            agosto: 7,
            setembro: 8,
            outubro: 9,
            novembro: 10,
            dezembro: 11,
          };
          if (dayMatch[2] && monthMap[dayMatch[2]] !== undefined) {
            targetDate.setMonth(monthMap[dayMatch[2]]);
          }
          targetDate.setDate(dayOfMonth);
          if (targetDate < base && !dayMatch[2]) {
            // If day is past in current month, assume next month
            targetDate.setMonth(targetDate.getMonth() + 1);
          }
        }
      }
    }
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  extractedDateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;

  // 2. TIME PARSING
  let extractedTimeStr = "09:00";
  // Matches: "às 14h", "às 14:30", "às 14 horas", "às 15 e meia", "9 da manhã", "3 da tarde", "8 da noite"
  const timeRegex = /(?:às|as)?\s*(\d{1,2})(?::(\d{2})|\s*h(?:oras)?|\s*e\s*meia|\s*e\s*(\d{2}))?(?:\s*(?:da|de)?\s*(tarde|noite|manhã|manha))?/i;
  const timeMatch = lower.match(timeRegex);

  if (timeMatch && timeMatch[1]) {
    let hours = parseInt(timeMatch[1], 10);
    let mins = 0;

    if (timeMatch[2]) {
      mins = parseInt(timeMatch[2], 10);
    } else if (lower.includes("e meia")) {
      mins = 30;
    } else if (timeMatch[3]) {
      mins = parseInt(timeMatch[3], 10);
    }

    const period = timeMatch[4]?.toLowerCase();
    if ((period === "tarde" || period === "noite") && hours < 12) {
      hours += 12;
    }

    if (hours >= 0 && hours <= 23 && mins >= 0 && mins <= 59) {
      extractedTimeStr = `${pad(hours)}:${pad(mins)}`;
    }
  } else if (lower.includes("meio-dia") || lower.includes("meio dia")) {
    extractedTimeStr = "12:00";
  } else if (lower.includes("meia-noite") || lower.includes("meia noite")) {
    extractedTimeStr = "00:00";
  }

  // 3. CATEGORY INFERENCE
  let category: AppointmentCategory = "outro";
  if (
    lower.includes("médic") ||
    lower.includes("medic") ||
    lower.includes("dentista") ||
    lower.includes("consulta") ||
    lower.includes("remédio") ||
    lower.includes("remedio") ||
    lower.includes("exame") ||
    lower.includes("cardiologista") ||
    lower.includes("psicólog") ||
    lower.includes("psicolog") ||
    lower.includes("fisioterapia") ||
    lower.includes("hospital") ||
    lower.includes("clínica") ||
    lower.includes("clinica") ||
    lower.includes("vacina") ||
    lower.includes("doutor") ||
    lower.includes("posto de saúde")
  ) {
    category = "saude";
  } else if (
    lower.includes("reunião") ||
    lower.includes("reuniao") ||
    lower.includes("trabalho") ||
    lower.includes("cliente") ||
    lower.includes("chefe") ||
    lower.includes("relatório") ||
    lower.includes("relatorio") ||
    lower.includes("call") ||
    lower.includes("projeto") ||
    lower.includes("entrevista") ||
    lower.includes("apresentação") ||
    lower.includes("apresentacao")
  ) {
    category = "trabalho";
  } else if (
    lower.includes("pagar") ||
    lower.includes("boleto") ||
    lower.includes("conta") ||
    lower.includes("banco") ||
    lower.includes("fatura") ||
    lower.includes("aluguel") ||
    lower.includes("pix") ||
    lower.includes("dinheiro") ||
    lower.includes("finança") ||
    lower.includes("financa")
  ) {
    category = "financas";
  } else if (
    lower.includes("aula") ||
    lower.includes("curso") ||
    lower.includes("prova") ||
    lower.includes("faculdade") ||
    lower.includes("escola") ||
    lower.includes("estudar") ||
    lower.includes("seminário") ||
    lower.includes("seminario") ||
    lower.includes("tcc")
  ) {
    category = "estudos";
  } else if (
    lower.includes("aniversário") ||
    lower.includes("aniversario") ||
    lower.includes("mãe") ||
    lower.includes("mae") ||
    lower.includes("pai") ||
    lower.includes("filho") ||
    lower.includes("filha") ||
    lower.includes("esposa") ||
    lower.includes("marido") ||
    lower.includes("almoço de família") ||
    lower.includes("veterinário") ||
    lower.includes("pet") ||
    lower.includes("cachorro")
  ) {
    category = "familia";
  } else if (
    lower.includes("academia") ||
    lower.includes("treino") ||
    lower.includes("cabelo") ||
    lower.includes("barba") ||
    lower.includes("compras") ||
    lower.includes("mercado") ||
    lower.includes("viagem")
  ) {
    category = "pessoal";
  }

  // 4. RECURRENCE INFERENCE
  let recurrence: RecurrenceType = "none";
  if (
    lower.includes("toda semana") ||
    lower.includes("todas as") ||
    lower.includes("todo sábado") ||
    lower.includes("toda segunda") ||
    lower.includes("toda terça") ||
    lower.includes("toda quarta") ||
    lower.includes("toda quinta") ||
    lower.includes("toda sexta") ||
    lower.includes("todo domingo") ||
    lower.includes("semanal")
  ) {
    recurrence = "weekly";
  } else if (
    lower.includes("todo mês") ||
    lower.includes("todo mes") ||
    lower.includes("mensal") ||
    lower.includes("todo dia 5") ||
    lower.includes("todo dia 10")
  ) {
    recurrence = "monthly";
  }

  // 5. CLEAN TITLE GENERATION
  // Remove trigger words like "lembrar de", "agendar", "marcar", "anotar", "novo compromisso", "por favor"
  let cleanTitle = raw
    .replace(/^(por favor|gentileza|lembraai|alexa|siri|ok google)[,\s]+/i, "")
    .replace(
      /^(lembrar de|lembrete de|lembrete para|agendar|marcar|anotar|novo compromisso|cadastrar|não esquecer de|preciso|tenho que|avise-me sobre|me avise sobre)\s+/i,
      ""
    )
    .trim();

  // If title was stripped too much or starts with lowercase, capitalize nicely
  if (!cleanTitle) {
    cleanTitle = "Compromisso por Voz";
  } else {
    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  }

  return {
    title: cleanTitle,
    date: extractedDateStr,
    time: extractedTimeStr,
    location: "",
    category,
    description: `Comando por voz: "${raw}"`,
    recurrence,
    remindersMinutesBefore: [1440, 120, 15],
  };
}
