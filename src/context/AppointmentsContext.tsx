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
  setDoc,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase.ts";
import { useAuth } from "./AuthContext.tsx";
import { Appointment, AppointmentCategory, RecurrenceType, ReminderLog } from "../types/index.ts";

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
  const { user, profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dispatchedKeys, setDispatchedKeys] = useState<Set<string>>(new Set());

  // Listen to user's appointments in real-time
  useEffect(() => {
    if (!user) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const colRef = collection(db, "appointments");
    const q = query(colRef, where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Appointment[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Appointment;
          list.push({ ...data, id: docSnap.id });
        });

        // Sort by dateTimeIso ascending
        list.sort((a, b) => (a.dateTimeIso > b.dateTimeIso ? 1 : -1));
        setAppointments(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching appointments:", error);
        handleFirestoreError(error, OperationType.LIST, "appointments");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Create appointment
  const createAppointment = async (input: CreateAppointmentInput): Promise<string> => {
    if (!user) throw new Error("Usuário não autenticado");

    const dateTimeIso = `${input.date}T${input.time || "09:00"}:00`;
    const appointmentDate = new Date(`${input.date}T12:00:00`);
    const dayOfWeek = appointmentDate.getDay();
    const dayOfMonth = appointmentDate.getDate();

    const newAppointment: Omit<Appointment, "id"> = {
      userId: user.uid,
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

    try {
      const docRef = await addDoc(collection(db, "appointments"), newAppointment);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "appointments");
    }
  };

  // Update appointment
  const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
    if (!user) return;
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
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  // Mark as completed
  const markAsCompleted = async (id: string) => {
    if (!user) return;
    try {
      const docRef = doc(db, "appointments", id);
      await updateDoc(docRef, {
        status: "completed",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  // Postpone appointment (+1 hour, +24 hours, etc.)
  const postponeAppointment = async (
    id: string,
    { hours = 0, days = 0 }: { hours?: number; days?: number }
  ) => {
    if (!user) return;
    const target = appointments.find((a) => a.id === id);
    if (!target) return;

    try {
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
      const newDateTimeIso = `${newDate}T${newTime}:00`;

      const docRef = doc(db, "appointments", id);
      await updateDoc(docRef, {
        date: newDate,
        time: newTime,
        dateTimeIso: newDateTimeIso,
        status: "pending",
        completedAt: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  // Delete appointment
  const deleteAppointment = async (id: string) => {
    if (!user) return;
    try {
      const docRef = doc(db, "appointments", id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `appointments/${id}`);
    }
  };

  // Send manual reminder or test trigger via Telegram
  const sendManualTelegramReminder = async (
    appointment: Appointment,
    timingLabel: string = "Lembrete solicitado"
  ) => {
    const chatId = profile?.telegramChatId;
    if (!chatId) {
      return {
        ok: false,
        message: "Chat ID do Telegram não configurado no seu perfil. Abra Configurações e informe seu Chat ID.",
      };
    }

    try {
      const res = await fetch("/api/telegram/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          appointment,
          timingLabel,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        // Record in reminders_history
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
        return { ok: false, message: data.error || "Falha ao enviar para o Telegram." };
      }
    } catch (err: any) {
      return { ok: false, message: err.message || "Erro de conexão ao enviar lembrete." };
    }
  };

  // Background Automatic Dispatcher Check Loop
  useEffect(() => {
    if (!user || !profile?.telegramChatId || !profile.telegramNotificationsEnabled) {
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

        // For each reminder time (e.g. 1440m, 120m, 15m, 0m)
        const reminders = apt.remindersMinutesBefore || [1440, 120, 15];

        for (const remMin of reminders) {
          const reminderKey = `${apt.id}-${remMin}-${apt.date}-${apt.time}`;
          if (dispatchedKeys.has(reminderKey)) continue;

          // If current time is within [remMin - 3, remMin + 3] minutes before event
          // OR if event is due right now (remMin == 0 and diffMinutes <= 2 and diffMinutes >= -15)
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

            console.log(`[LembraAI Dispatcher] Disparando lembrete: ${apt.title} (${label})`);
            await sendManualTelegramReminder(apt, label);
          }
        }
      }
    };

    // Run check immediately and then every 30 seconds
    checkAndDispatchReminders();
    const interval = setInterval(checkAndDispatchReminders, 30000);
    return () => clearInterval(interval);
  }, [user, profile, appointments, dispatchedKeys]);

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
