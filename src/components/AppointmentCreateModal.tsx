import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Plus,
  Camera,
  Mic,
  PenTool,
  Upload,
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Tag,
  Repeat,
  Bell,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Volume2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useAppointments } from "../context/AppointmentsContext.tsx";
import {
  AppointmentCategory,
  RecurrenceType,
  ExtractedAIAppointment,
} from "../types/index.ts";
import { CATEGORIES, RECURRENCE_LABELS } from "../utils/categories.ts";

interface AppointmentCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  initialTab?: "manual" | "image" | "voice";
  onAppointmentCreated?: (title: string, date: string, time: string) => void;
}

type TabType = "manual" | "image" | "voice";

export const AppointmentCreateModal: React.FC<AppointmentCreateModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialTab = "manual",
  onAppointmentCreated,
}) => {
  const { createAppointment } = useAppointments();

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Form Fields
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(
    initialDate || new Date().toISOString().split("T")[0]
  );
  const [time, setTime] = useState("09:00");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<AppointmentCategory>("saude");
  const [description, setDescription] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [reminders, setReminders] = useState<number[]>([1440, 120, 15]);

  // AI Extraction state
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiError, setAiError] = useState("");
  const [extractedReviewMode, setExtractedReviewMode] = useState(false);
  const [aiSourceBadge, setAiSourceBadge] = useState<"image" | "voice" | null>(
    null
  );

  // Image Upload state
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "pt-BR";

      recognition.onresult = (event: any) => {
        let currentText = "";
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        setVoiceTranscript(currentText);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }
  }, []);

  // Reset modal when opened
  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      if (initialDate) setDate(initialDate);
      setExtractedReviewMode(false);
      setAiError("");
      setPreviewImage(null);
      setVoiceTranscript("");
      setAiSourceBadge(null);
    }
  }, [isOpen, initialDate, initialTab]);

  if (!isOpen) return null;

  // Toggle reminder minutes selection
  const toggleReminder = (mins: number) => {
    if (reminders.includes(mins)) {
      setReminders(reminders.filter((m) => m !== mins));
    } else {
      setReminders([...reminders, mins]);
    }
  };

  // Populate form from AI extraction
  const applyExtractedData = (
    data: ExtractedAIAppointment,
    source: "image" | "voice"
  ) => {
    if (data.title) setTitle(data.title);
    if (data.date) setDate(data.date);
    if (data.time) setTime(data.time);
    if (data.location) setLocation(data.location);
    if (data.category) setCategory(data.category);
    if (data.description) setDescription(data.description);
    if (data.recurrence) setRecurrence(data.recurrence);
    if (data.remindersMinutesBefore && data.remindersMinutesBefore.length > 0) {
      setReminders(data.remindersMinutesBefore);
    }

    setAiSourceBadge(source);
    setExtractedReviewMode(true);
  };

  // Handle Image Selection
  const handleImageFile = (file: File) => {
    setAiError("");
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPreviewImage(base64);
    };
    reader.readAsDataURL(file);
  };

  // Submit Image to Gemini OCR API
  const handleProcessImageAI = async () => {
    if (!previewImage) {
      setAiError("Selecione ou tire uma foto primeiro.");
      return;
    }

    setIsProcessingAI(true);
    setAiError("");

    try {
      const response = await fetch("/api/gemini/parse-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: previewImage,
          referenceDate: new Date().toISOString(),
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        applyExtractedData(resData.data, "image");
      } else {
        setAiError(
          resData.error || "Não conseguimos identificar os dados na imagem."
        );
      }
    } catch (err: any) {
      setAiError(err.message || "Falha ao conectar com o serviço de IA.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Start / Stop Voice Recording
  const toggleVoiceRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      setVoiceTranscript("");
      setAiError("");
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (err) {
        setIsRecording(false);
        setAiError(
          "Não foi possível acessar o microfone. Verifique as permissões."
        );
      }
    }
  };

  // Submit Voice transcript to Gemini API
  const handleProcessVoiceAI = async () => {
    const textToProcess = voiceTranscript.trim();
    if (!textToProcess) {
      setAiError("Fale ou digite seu comando de voz antes de processar.");
      return;
    }

    setIsProcessingAI(true);
    setAiError("");

    try {
      const response = await fetch("/api/gemini/parse-voice-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: textToProcess,
          referenceDate: new Date().toISOString(),
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        applyExtractedData(resData.data, "voice");
      } else {
        setAiError(resData.error || "Não foi possível interpretar o áudio.");
      }
    } catch (err: any) {
      setAiError(err.message || "Erro ao consultar a IA para voz.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Save Final Appointment
  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setAiError("Por favor, digite o título do compromisso.");
      return;
    }

    try {
      const savedTitle = title.trim();
      const savedDate = date;
      const savedTime = time;

      await createAppointment({
        title: savedTitle,
        date: savedDate,
        time: savedTime,
        category,
        location: location.trim(),
        description: description.trim(),
        recurrence,
        remindersMinutesBefore: reminders,
        source: aiSourceBadge || "manual",
      });

      // Clear & close
      setTitle("");
      setLocation("");
      setDescription("");
      setAiError("");
      onClose();
      if (onAppointmentCreated) {
        onAppointmentCreated(savedTitle, savedDate, savedTime);
      }
    } catch (err: any) {
      setAiError("Erro ao salvar compromisso: " + (err.message || "Tente novamente"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold">Novo Compromisso</h2>
              <p className="text-xs text-emerald-100">
                {extractedReviewMode
                  ? "Revise os dados antes de confirmar"
                  : "Escolha como deseja cadastrar seu lembrete"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector (Hidden if in review mode) */}
        {!extractedReviewMode && (
          <div className="grid grid-cols-3 p-2 bg-slate-100 border-b border-slate-200 gap-1.5">
            <button
              onClick={() => {
                setActiveTab("manual");
                setAiError("");
              }}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                activeTab === "manual"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <PenTool className="w-4 h-4" />
              <span>Manual</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("image");
                setAiError("");
              }}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                activeTab === "image"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>Foto / OCR</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("voice");
                setAiError("");
              }}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                activeTab === "voice"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Mic className="w-4 h-4 text-emerald-600" />
              <span>Voz (IA)</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Error Banner */}
          {aiError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          {/* TAB B: IMAGE OCR */}
          {activeTab === "image" && !extractedReviewMode && (
            <div className="space-y-4">
              <div className="text-center p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                <p className="text-xs font-semibold text-emerald-900">
                  Tire uma foto ou envie um convite, receita médica ou cartaz. A IA extrairá os dados automaticamente!
                </p>
              </div>

              {previewImage ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-900 flex items-center justify-center max-h-64">
                    <img
                      src={previewImage}
                      alt="Compromisso para análise"
                      className="object-contain max-h-64 w-full"
                    />
                    <button
                      onClick={() => setPreviewImage(null)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={handleProcessImageAI}
                    disabled={isProcessingAI}
                    className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20"
                  >
                    {isProcessingAI ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>A IA está analisando a imagem...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-emerald-200" />
                        <span>Analisar e Preencher com IA</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {/* Camera Option */}
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl bg-emerald-50/50 hover:bg-emerald-50 cursor-pointer transition text-center group">
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageFile(file);
                      }}
                    />
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-md group-hover:scale-105 transition">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-emerald-950">Tirar Foto</span>
                    <span className="text-[11px] text-emerald-700 mt-0.5">Usar a câmera</span>
                  </label>

                  {/* Upload File Option */}
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-slate-500 rounded-2xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition text-center group">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageFile(file);
                      }}
                    />
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center mb-2 shadow-md group-hover:scale-105 transition">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">Escolher Imagem</span>
                    <span className="text-[11px] text-slate-500 mt-0.5">Galeria ou arquivos</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* TAB C: VOICE COMMAND */}
          {activeTab === "voice" && !extractedReviewMode && (
            <div className="space-y-4">
              <div className="text-center p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                <p className="text-xs font-semibold text-emerald-900">
                  Fale com naturalidade! Por exemplo: <i>"Lembrar de consulta com cardiologista amanhã às 15 horas"</i>
                </p>
              </div>

              {/* Big Record Button */}
              <div className="flex flex-col items-center justify-center py-4">
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition shadow-lg ${
                    isRecording
                      ? "bg-rose-600 text-white animate-pulse ring-8 ring-rose-200"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-100"
                  }`}
                >
                  <Mic className="w-9 h-9" />
                </button>
                <span className="mt-3 text-xs font-bold text-slate-700">
                  {isRecording ? "Ouvindo... Clique para pausar" : "Toque no microfone para falar"}
                </span>
              </div>

              {/* Transcript Display & Editable Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Texto reconhecido:
                </label>
                <textarea
                  rows={3}
                  value={voiceTranscript}
                  onChange={(e) => setVoiceTranscript(e.target.value)}
                  placeholder="Seu comando de voz aparecerá aqui, ou digite livremente..."
                  className="w-full p-3.5 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:outline-hidden text-sm font-medium text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Sample Prompts */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Exemplos rápidos para testar:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Consulta com dentista amanhã às 14h",
                    "Tomar remédio da pressão todo dia às 8h",
                    "Reunião de trabalho na próxima segunda às 10h",
                    "Pagar conta de luz sexta-feira às 11h",
                  ].map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setVoiceTranscript(sample)}
                      className="text-xs px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 font-medium transition border border-slate-200"
                    >
                      "{sample}"
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleProcessVoiceAI}
                disabled={isProcessingAI || !voiceTranscript.trim()}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20"
              >
                {isProcessingAI ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Interpretando com Inteligência Artificial...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    <span>Processar Comando com IA</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB A / REVIEW FORM: MANUAL OR AI REVIEW */}
          {(activeTab === "manual" || extractedReviewMode) && (
            <form onSubmit={handleSaveAppointment} className="space-y-4">
              {/* Review Mode Banner */}
              {extractedReviewMode && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">
                        Compromisso extraído com sucesso pela IA!
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Confira os campos abaixo e faça qualquer ajuste antes de salvar.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setExtractedReviewMode(false);
                      setAiSourceBadge(null);
                    }}
                    className="text-xs font-semibold text-emerald-800 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Outra forma
                  </button>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Título do Compromisso *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Consulta Médica, Pagar Boleto, Almoço em Família"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:outline-hidden text-base font-bold text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Data *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:outline-hidden text-sm font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" /> Horário *
                  </label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:outline-hidden text-sm font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Category Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" /> Categoria
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(CATEGORIES) as AppointmentCategory[]).map((catKey) => {
                    const meta = CATEGORIES[catKey];
                    const isSelected = category === catKey;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => setCategory(catKey)}
                        className={`p-2.5 rounded-xl text-left border-2 transition flex items-center gap-2 ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs"
                            : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${meta.badgeBg.split(" ")[0]}`}></span>
                        <span className="text-xs truncate">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Local ou Link (opcional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Hospital Santa Luzia, Sala 302, Google Meet"
                  className="w-full px-4 py-2.5 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:outline-hidden text-sm font-medium text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Recurrence (Requisito 4) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5 text-emerald-600" /> Repetição / Frequência
                </label>
                <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-2xl">
                  {(["none", "weekly", "monthly"] as RecurrenceType[]).map((recKey) => (
                    <button
                      key={recKey}
                      type="button"
                      onClick={() => setRecurrence(recKey)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl transition ${
                        recurrence === recKey
                          ? "bg-white text-emerald-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {recKey === "none" && "Único"}
                      {recKey === "weekly" && "Semanal"}
                      {recKey === "monthly" && "Mensal"}
                    </button>
                  ))}
                </div>
                {recurrence !== "none" && (
                  <p className="text-[11px] text-emerald-700 font-medium mt-1">
                    {recurrence === "weekly"
                      ? "O lembrete se repetirá toda semana neste mesmo dia e horário."
                      : "O lembrete se repetirá todo mês neste mesmo dia."}
                  </p>
                )}
              </div>

              {/* Telegram Reminders Anticipation (Requisito 5) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                  <Bell className="w-3.5 h-3.5 text-sky-600" /> Avisos no Telegram (Antecedência):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { mins: 1440, label: "1 dia antes" },
                    { mins: 120, label: "2 horas antes" },
                    { mins: 15, label: "15 min antes" },
                    { mins: 0, label: "Na hora" },
                  ].map((item) => {
                    const isChecked = reminders.includes(item.mins);
                    return (
                      <button
                        key={item.mins}
                        type="button"
                        onClick={() => toggleReminder(item.mins)}
                        className={`p-2.5 rounded-xl text-xs font-bold border-2 transition flex items-center justify-between ${
                          isChecked
                            ? "bg-sky-50 text-sky-900 border-sky-500 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span>{item.label}</span>
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                            isChecked ? "bg-sky-600 text-white" : "border border-slate-300"
                          }`}
                        >
                          {isChecked && "✓"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-500" /> Observações (opcional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Levar documento com foto, jejum de 8 horas, etc."
                  className="w-full px-4 py-2.5 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:outline-hidden text-sm font-medium text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/25"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{extractedReviewMode ? "Confirmar e Salvar na Agenda" : "Criar Compromisso"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
