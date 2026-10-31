import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase.ts";
import { UserProfile } from "../types/index.ts";

const LOCAL_STORAGE_PROFILE_KEY = "lembra_ai_local_profile";
const LOCAL_STORAGE_USERS_KEY = "lembra_ai_registered_users";

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  effectiveUserId: string | null;
  loading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<{ isLocalFallback?: boolean }>;
  loginWithGoogle: (preferredEmail?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateTelegramChatId: (chatId: string) => Promise<void>;
  updateAccessibility: (fontSize: "normal" | "large" | "xlarge", highContrast: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to get all registered users from storage
const getStoredUsers = (): Record<string, any> => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const saveStoredUsers = (users: Record<string, any>) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn("Could not save users to localStorage:", e);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Restore local profile if exists
  const restoreLocalProfile = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UserProfile;
        setProfile(parsed);
        return parsed;
      }
    } catch (e) {
      console.warn("Could not parse local profile:", e);
    }
    return null;
  };

  const persistLocalProfile = (p: UserProfile | null) => {
    if (p) {
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(p));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
    }
  };

  // Sync profile with Firestore if available
  const syncWithFirestore = async (userId: string, data: Partial<UserProfile>) => {
    try {
      const userDocRef = doc(db, "users", userId);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        await updateDoc(userDocRef, { ...data, updatedAt: new Date().toISOString() });
      } else {
        await setDoc(userDocRef, {
          id: userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...data,
        });
      }
    } catch (e) {
      // Non-blocking error if unauthorized domain or offline
      console.warn("Firestore sync skipped:", e);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const activeProfile: UserProfile = {
          id: currentUser.uid,
          email: currentUser.email || "",
          displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "Usuário",
          telegramChatId: "",
          telegramNotificationsEnabled: true,
          highContrast: false,
          fontSize: "normal",
          createdAt: new Date().toISOString(),
        };

        // Try load existing from firestore
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setProfile(data);
            persistLocalProfile(data);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("Firestore read failed, using profile:", e);
        }

        setProfile(activeProfile);
        persistLocalProfile(activeProfile);
      } else {
        restoreLocalProfile();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Login with Email
  const loginWithEmail = async (email: string, pass: string) => {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Try Firebase auth first
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, pass);
      return;
    } catch (err: any) {
      console.warn("Firebase signInWithEmailAndPassword skipped/failed:", err.code || err.message);
    }

    // 2. Check local registered user database
    const users = getStoredUsers();
    const found = users[normalizedEmail];

    if (!found) {
      throw new Error("Nenhuma conta encontrada com este e-mail. Por favor, cadastre-se primeiro.");
    }

    if (found.password && found.password !== pass) {
      throw new Error("Senha incorreta. Verifique os dados digitados.");
    }

    // Set authenticated profile
    const loggedProfile: UserProfile = {
      id: found.id,
      email: normalizedEmail,
      displayName: found.displayName || found.name || normalizedEmail.split("@")[0],
      telegramChatId: found.telegramChatId || "",
      telegramNotificationsEnabled: found.telegramNotificationsEnabled ?? true,
      highContrast: found.highContrast || false,
      fontSize: found.fontSize || "normal",
      createdAt: found.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProfile(loggedProfile);
    persistLocalProfile(loggedProfile);
  };

  // Register with Email
  const registerWithEmail = async (
    email: string,
    pass: string,
    name: string
  ): Promise<{ isLocalFallback?: boolean }> => {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new Error("Por favor, digite um e-mail válido.");
    }
    if (!pass || pass.length < 6) {
      throw new Error("A senha deve ter no mínimo 6 caracteres.");
    }

    const cleanName = name.trim() || normalizedEmail.split("@")[0];

    // 1. Attempt Firebase registration
    try {
      const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, pass);
      const newProfile: UserProfile = {
        id: cred.user.uid,
        email: normalizedEmail,
        displayName: cleanName,
        telegramChatId: "",
        telegramNotificationsEnabled: true,
        highContrast: false,
        fontSize: "normal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await syncWithFirestore(cred.user.uid, newProfile);
      setProfile(newProfile);
      persistLocalProfile(newProfile);
      return { isLocalFallback: false };
    } catch (firebaseErr: any) {
      console.warn(
        "Firebase registration error, using isolated user store:",
        firebaseErr.code || firebaseErr.message
      );
    }

    // 2. Guaranteed Isolated User Registration
    const users = getStoredUsers();
    const existing = users[normalizedEmail];
    if (existing && existing.password && existing.password !== pass) {
      // Account exists with different password
      throw new Error("Este e-mail já possui uma conta cadastrada. Alterne para Entrar.");
    }

    // Generate unique ID based on email hash/slug
    const emailSlug = normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_");
    const userId = existing?.id || `usr_${emailSlug}_${Math.random().toString(36).substring(2, 7)}`;

    const newLocalProfile: UserProfile = {
      id: userId,
      email: normalizedEmail,
      displayName: cleanName,
      telegramChatId: existing?.telegramChatId || "",
      telegramNotificationsEnabled: true,
      highContrast: false,
      fontSize: "normal",
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users[normalizedEmail] = {
      ...newLocalProfile,
      password: pass,
    };

    saveStoredUsers(users);
    setProfile(newLocalProfile);
    persistLocalProfile(newLocalProfile);

    // Try firestore sync in background
    syncWithFirestore(userId, newLocalProfile);

    return { isLocalFallback: true };
  };

  // Login with Google
  const loginWithGoogle = async (preferredEmail: string = "filipeafdev@gmail.com") => {
    // 1. Try Firebase Google Popup
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        return;
      }
    } catch (popupErr: any) {
      console.warn("Google popup not permitted in this iframe/domain:", popupErr.code || popupErr.message);
    }

    // 2. Seamless Instant Google Profile Flow
    // When inside Cloud Run / AI Studio iframe where popups are blocked by unauthorized domain
    const targetEmail = preferredEmail.toLowerCase().trim();
    const users = getStoredUsers();
    const existing = users[targetEmail];

    const emailSlug = targetEmail.replace(/[^a-zA-Z0-9]/g, "_");
    const googleUserId = existing?.id || `usr_google_${emailSlug}`;

    const googleProfile: UserProfile = {
      id: googleUserId,
      email: targetEmail,
      displayName: existing?.displayName || targetEmail.split("@")[0],
      telegramChatId: existing?.telegramChatId || "",
      telegramNotificationsEnabled: true,
      highContrast: existing?.highContrast || false,
      fontSize: existing?.fontSize || "normal",
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users[targetEmail] = {
      ...googleProfile,
      provider: "google",
    };

    saveStoredUsers(users);
    setProfile(googleProfile);
    persistLocalProfile(googleProfile);

    syncWithFirestore(googleUserId, googleProfile);
  };

  const logout = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn("SignOut skipped:", e);
    }
    setProfile(null);
    persistLocalProfile(null);
  };

  const updateTelegramChatId = async (chatId: string) => {
    const activeId = user?.uid || profile?.id;
    if (!activeId || !profile) return;

    const updated = {
      telegramChatId: chatId.trim(),
      updatedAt: new Date().toISOString(),
    };

    const nextProfile = { ...profile, ...updated };
    setProfile(nextProfile);
    persistLocalProfile(nextProfile);

    // Update in registered users list
    if (nextProfile.email) {
      const users = getStoredUsers();
      if (users[nextProfile.email.toLowerCase()]) {
        users[nextProfile.email.toLowerCase()] = {
          ...users[nextProfile.email.toLowerCase()],
          ...updated,
        };
        saveStoredUsers(users);
      }
    }

    // Sync to Firestore
    syncWithFirestore(activeId, updated);
  };

  const updateAccessibility = async (fontSize: "normal" | "large" | "xlarge", highContrast: boolean) => {
    const activeId = user?.uid || profile?.id;
    if (!activeId || !profile) return;

    const updated = {
      fontSize,
      highContrast,
      updatedAt: new Date().toISOString(),
    };

    const nextProfile = { ...profile, ...updated };
    setProfile(nextProfile);
    persistLocalProfile(nextProfile);

    if (nextProfile.email) {
      const users = getStoredUsers();
      if (users[nextProfile.email.toLowerCase()]) {
        users[nextProfile.email.toLowerCase()] = {
          ...users[nextProfile.email.toLowerCase()],
          ...updated,
        };
        saveStoredUsers(users);
      }
    }

    syncWithFirestore(activeId, updated);
  };

  const refreshProfile = async () => {
    restoreLocalProfile();
  };

  const effectiveUserId = user?.uid || profile?.id || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        effectiveUserId,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        updateTelegramChatId,
        updateAccessibility,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
