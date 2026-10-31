import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../lib/firebase.ts";
import { useAuth } from "./AuthContext.tsx";
import { Appointment, AppointmentCategory, RecurrenceType } from "../types/index.ts";

interface CreateAppointmentInput {
  title: string;
  description?: string;
  category: AppointmentCategory;
  location?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  recurrence: RecurrenceType;
  remindersMinutesBefore?: number[];
  source?: "manual" | "image" | "voice";
}

interface AppointmentsContextType {
  appointments: Appointment[];
  loading: boolean;
  createAppointment: (input: CreateAppointmentInput) => Promise<string>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  markAsCompleted: (id: string) => Promise<void>;
  postponeAppointment: (id: string, hoursOrDays: { hours?: number; days?: number }) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  sendManualTelegramReminder: (appointment: Appointment, timingLabel?: string) => Promise<{ ok: boolean; message?: string }>;
  stats: {
    total: number;
    today: number;
    upcoming: number;
    completed: number;
    recurring: number;
  };
}

const AppointmentsContext = createContext<AppointmentsContextType | undefined>(undefined);

export const AppointmentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, effectiveUserId } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    try {
      const targetUserId = effectiveUserId || profile?.id || "usr_filipeafdev";
      const userKey = `lembra_ai_appointments_${targetUserId}`;
      const saved = localStorage.getItem(userKey) || localStorage.getItem("lembra_ai_appointments_master");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    // Seed initial accessible appointment for first-time ease
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const initialSample: Appointment = {
      id: "apt_sample_dentista",
      userId: "usr_filipeafdev",
      title: "Consulta no Dentista (Dr. Eduardo)",
      description: "Levar carteirinha do convênio e exames anteriores",
      category: "saude",
      location: "Av. Paulista, 1200 - Sala 42",
      date: tomorrowStr,
      time: "15:00",
      dateTimeIso: `${tomorrowStr}T15:00:00`,
      recurrence: "none",
      recurrenceDayOfWeek: tomorrow.getDay(),
      recurrenceDayOfMonth: tomorrow.getDate(),
      remindersMinutesBefore: [1440, 120, 15],
      status: "pending",
      source: "manual",
      telegramNotificationSent: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return [initialSample];
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [dispatchedKeys, setDispatchedKeys] = useState<Set<string>>(new Set());

  // Storage key for user-isolated appointments
  const targetUserId = user?.uid || effectiveUserId || profile?.id || "usr_filipeafdev";
  const storageKey = `lembra_ai_appointments_${targetUserId}`;

  // Load local cached appointments
  const getLocalAppointments = (key: string): Appointment[] => {
    try {
      const data = localStorage.getItem(key) || localStorage.getItem("lembra_ai_appointments_master");
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  };

  const saveLocalAppointments = (key: string, list: Appointment[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(list));
      localStorage.setItem("lembra_ai_appointments_master", JSON.stringify(list));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  };

  // Listen to user's appointments in real-time
  useEffect(() => {
    // Initial check from local storage cache
    if (storageKey) {
      const cached = getLocalAppointments(storageKey);
      if (cached.length > 0) {
        setAppointments(cached);
      }
    }

    // If Firebase user is logged in, attach Firestore listener
    if (user) {
      const colRef = collection(db, "appointments");
      const q = query(colRef, where("userId", "==", user.uid));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Appointment[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as Appointment;
              list.push({ ...data, id: docSnap.id });
            });

            // Sort by dateTimeIso ascending
            list.sort((a, b) => (a.dateTimeIso > b.dateTimeIso ? 1 : -1));
            setAppointments(list);
            saveLocalAppointments(storageKey, list);
          }
          setLoading(false);
        },
        (error) => {
          console.warn("Firestore onSnapshot error (using local cache):", error.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    }
  }, [user, storageKey]);

  // Create appointment
  const createAppointment = async (input: CreateAppointmentInput): Promise<string> => {
    const dateTimeIso = `${input.date}T${input.time || "09:00"}:00`;
    const appointmentDate = new Date(`${input.date}T12:00:00`);
    const dayOfWeek = appointmentDate.getDay();
    const dayOfMonth = appointmentDate.getDate();

    const authorUid = user ? user.uid : targetUserId;

    const newAppointment: Omit<Appointment, "id"> = {
      userId: authorUid,
      title: input.title.trim(),
      description: input.description?.trim() || "",
      category: input.category || "outro",
      location: input.location?.trim() || "",
      date: input.date,
      time: input.time || "09:00",
      dateTimeIso,
      recurrence: input.recurrence || "none",
      recurrenceDayOfWeek: dayOfWeek,
      recurrenceDayOfMonth: dayOfMonth,
      remindersMinutesBefore:
        input.remindersMinutesBefore && input.remindersMinutesBefore.length > 0
          ? input.remindersMinutesBefore
          : [1440, 120, 15],
      status: "pending",
      source: input.source || "manual",
      telegramNotificationSent: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let generatedId = "apt_" + Math.random().toString(36).substring(2, 11);

    if (user) {
      try {
        const docRef = await addDoc(collection(db, "appointments"), newAppointment);
        generatedId = docRef.id;
      } catch (error) {
        console.warn("Firestore addDoc failed, storing locally:", error);
      }
    }

    const fullAppointment: Appointment = {
      ...newAppointment,
      id: generatedId,
    };

    setAppointments((prev) => {
      const filtered = prev.filter((p) => p.id !== generatedId);
      const next = [...filtered, fullAppointment].sort((a, b) =>
        a.dateTimeIso > b.dateTimeIso ? 1 : -1
      );
      saveLocalAppointments(storageKey, next);
      return next;
    });

    return generatedId;
  };

  // Update appointment
  const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
    if (!effectiveUserId) return;

    if (user) {
      try {
        const docRef = doc(db, "appointments", id);
        const payload = {
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        if (updates.date || updates.time) {
          const current = appointments.find((a) => a.id === id);
          const newDate = updates.date || current?.date || "";
          const newTime = updates.time || current?.time || "09:00";
          payload.dateTimeIso = `${newDate}T${newTime}:00`;
        }
        await updateDoc(docRef, payload);
      } catch (error) {
        console.warn("Firestore updateDoc error, falling back locally:", error);
      }
    }

    setAppointments((prev) => {
      const next = prev.map((item) => {
        if (item.id === id) {
          const newDate = updates.date || item.date;
          const newTime = updates.time || item.time;
          return {
            ...item,
            ...updates,
            dateTimeIso: `${newDate}T${newTime}:00`,
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      });
      if (storageKey) saveLocalAppointments(storageKey, next);
      return next;
    });
  };

  // Mark as completed
  const markAsCompleted = async (id: string) => {
    await updateAppointment(id, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });
  };

  // Postpone appointment (+1 hour, +24 hours, etc.)
  const postponeAppointment = async (
    id: string,
    { hours = 0, days = 0 }: { hours?: number; days?: number }
  ) => {
    const target = appointments.find((a) => a.id === id);
    if (!target) return;

    const dateObj = new Date(`${target.date}T${target.time}:00`);
    if (hours > 0) {
      dateObj.setHours(dateObj.getHours() + hours);
    }
    if (days > 0) {
      dateObj.setDate(dateObj.getDate() + days);
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    const newDate = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
    const newTime = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;

    await updateAppointment(id, {
      date: newDate,
      time: newTime,
      status: "pending",
      completedAt: null,
    });
  };

  // Delete appointment
  const deleteAppointment = async (id: string) => {
    if (!effectiveUserId) return;

    if (user) {
      try {
        const docRef = doc(db, "appointments", id);
        await deleteDoc(docRef);
      } catch (error) {
        console.warn("Firestore deleteDoc error:", error);
      }
    }

    setAppointments((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (storageKey) saveLocalAppointments(storageKey, next);
      return next;
    });
  };

  // Send manual reminder or test trigger via Telegram
  const sendManualTelegramReminder = async (
    appointment: Appointment,
    timingLabel: string = "Lembrete solicitado"
  ) => {
    const chatId = profile?.telegramChatId || "1991960111";
    if (!chatId) {
      return {
        ok: false,
        message: "Chat ID do Telegram não configurado no seu perfil. Abra Configurações e informe seu Chat ID.",
      };
    }

    try {
      const { sendTelegramAppointmentAlert } = await import("../utils/telegramClient.ts");
      const result = await sendTelegramAppointmentAlert(chatId, appointment, timingLabel);

      if (result.ok) {
        if (user) {
          try {
            await addDoc(collection(db, "reminders_history"), {
              userId: user.uid,
              appointmentId: appointment.id,
              appointmentTitle: appointment.title,
              chatId,
              reminderType: timingLabel,
              status: "delivered",
              sentAt: new Date().toISOString(),
            });
          } catch (e) {
            console.warn("Could not save reminder log:", e);
          }
        }
        return { ok: true, message: "Lembrete enviado com sucesso para o Telegram!" };
      } else {
        return { ok: false, message: result.description || "Falha ao enviar para o Telegram." };
      }
    } catch (err: any) {
      return { ok: false, message: err.message || "Erro de conexão ao enviar lembrete." };
    }
  };

  // Background Automatic Dispatcher Check Loop
  useEffect(() => {
    if (!effectiveUserId || !profile?.telegramChatId || !profile.telegramNotificationsEnabled) {
      return;
    }

    const checkAndDispatchReminders = async () => {
      const now = new Date();
      const currentTimestamp = now.getTime();

      for (const apt of appointments) {
        if (apt.status !== "pending") continue;

        const aptDate = new Date(`${apt.date}T${apt.time}:00`);
        const aptTimestamp = aptDate.getTime();
        const diffMinutes = Math.round((aptTimestamp - currentTimestamp) / (1000 * 60));

        const reminders = apt.remindersMinutesBefore || [1440, 120, 15];

        for (const remMin of reminders) {
          const reminderKey = `${apt.id}-${remMin}-${apt.date}-${apt.time}`;
          if (dispatchedKeys.has(reminderKey)) continue;

          const isTriggerWindow =
            (remMin > 0 && diffMinutes <= remMin && diffMinutes >= remMin - 4) ||
            (remMin === 0 && diffMinutes <= 1 && diffMinutes >= -10);

          if (isTriggerWindow) {
            setDispatchedKeys((prev) => new Set(prev).add(reminderKey));

            let label = "";
            if (remMin === 1440) label = "Amanhã (em 24 horas)";
            else if (remMin === 120) label = "Em 2 horas";
            else if (remMin === 60) label = "Em 1 hora";
            else if (remMin === 30) label = "Em 30 minutos";
            else if (remMin === 15) label = "Em 15 minutos";
            else if (remMin === 0) label = "Acontecendo AGORA!";
            else label = `Em ${remMin} minutos`;

            await sendManualTelegramReminder(apt, label);
          }
        }
      }
    };

    checkAndDispatchReminders();
    const interval = setInterval(checkAndDispatchReminders, 30000);
    return () => clearInterval(interval);
  }, [effectiveUserId, profile, appointments, dispatchedKeys]);

  // Stats calculation
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    let today = 0;
    let upcoming = 0;
    let completed = 0;
    let recurring = 0;

    appointments.forEach((apt) => {
      if (apt.status === "completed") {
        completed++;
      } else {
        if (apt.date === todayStr) {
          today++;
        } else if (apt.date > todayStr) {
          upcoming++;
        }
      }
      if (apt.recurrence && apt.recurrence !== "none") {
        recurring++;
      }
    });

    return {
      total: appointments.length,
      today,
      upcoming,
      completed,
      recurring,
    };
  }, [appointments]);

  return (
    <AppointmentsContext.Provider
      value={{
        appointments,
        loading,
        createAppointment,
        updateAppointment,
        markAsCompleted,
        postponeAppointment,
        deleteAppointment,
        sendManualTelegramReminder,
        stats,
      }}
    >
      {children}
    </AppointmentsContext.Provider>
  );
};

export const useAppointments = () => {
  const context = useContext(AppointmentsContext);
  if (!context) {
    throw new Error("useAppointments must be used within an AppointmentsProvider");
  }
  return context;
};
