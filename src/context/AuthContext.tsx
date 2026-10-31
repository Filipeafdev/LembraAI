import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
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
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateTelegramChatId: (chatId: string) => Promise<void>;
  updateAccessibility: (fontSize: "normal" | "large" | "xlarge", highContrast: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Restore local profile if exists and no Firebase user is logged in
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

  // Save profile to local storage as fallback
  const persistLocalProfile = (p: UserProfile | null) => {
    if (p) {
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(p));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
    }
  };

  // Fetch or initialize user profile document in Firestore
  const loadUserProfile = async (currentUser: FirebaseUser) => {
    const userDocRef = doc(db, "users", currentUser.uid);
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setProfile(data);
        persistLocalProfile(data);
      } else {
        const initialProfile: UserProfile = {
          id: currentUser.uid,
          email: currentUser.email || "",
          displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "Usuário",
          telegramChatId: "",
          telegramNotificationsEnabled: true,
          highContrast: false,
          fontSize: "normal",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        try {
          await setDoc(userDocRef, initialProfile);
        } catch (e) {
          console.warn("Could not save initial profile to Firestore:", e);
        }
        setProfile(initialProfile);
        persistLocalProfile(initialProfile);
      }
    } catch (err) {
      console.error("Error loading user profile:", err);
      const fallback: UserProfile = {
        id: currentUser.uid,
        email: currentUser.email || "",
        displayName: currentUser.displayName || "Usuário",
        telegramChatId: "",
        telegramNotificationsEnabled: true,
        highContrast: false,
        fontSize: "normal",
        createdAt: new Date().toISOString(),
      };
      setProfile(fallback);
      persistLocalProfile(fallback);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadUserProfile(currentUser);
      } else {
        // Check if there is an active local user session
        const local = restoreLocalProfile();
        if (!local) {
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      // If Firebase email/password is not enabled in console or failed, check local users
      if (
        err.code === "auth/operation-not-allowed" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/invalid-credential"
      ) {
        const usersStr = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
        const users = usersStr ? JSON.parse(usersStr) : {};
        const normalizedEmail = email.toLowerCase().trim();
        const found = users[normalizedEmail];

        if (found && found.password === pass) {
          const userProf: UserProfile = {
            id: found.id,
            email: normalizedEmail,
            displayName: found.displayName || found.name,
            telegramChatId: found.telegramChatId || "",
            telegramNotificationsEnabled: true,
            highContrast: found.highContrast || false,
            fontSize: found.fontSize || "normal",
            createdAt: found.createdAt || new Date().toISOString(),
          };
          setProfile(userProf);
          persistLocalProfile(userProf);
          return;
        }
      }
      throw err;
    }
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    name: string
  ): Promise<{ isLocalFallback?: boolean }> => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (name.trim()) {
        try {
          await updateProfile(cred.user, { displayName: name.trim() });
        } catch (e) {
          console.warn("Could not update displayName:", e);
        }
      }
      const userDocRef = doc(db, "users", cred.user.uid);
      const newProfile: UserProfile = {
        id: cred.user.uid,
        email: cred.user.email || email,
        displayName: name.trim() || email.split("@")[0],
        telegramChatId: "",
        telegramNotificationsEnabled: true,
        highContrast: false,
        fontSize: "normal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        await setDoc(userDocRef, newProfile);
      } catch (err) {
        console.warn("Could not save profile to firestore, keeping local:", err);
      }
      setProfile(newProfile);
      persistLocalProfile(newProfile);
      return { isLocalFallback: false };
    } catch (error: any) {
      console.warn("Firebase email registration returned:", error.code || error.message);

      // If Firebase Email/Password is disabled in Firebase console (auth/operation-not-allowed)
      // or if offline/network restricted, create the local isolated user account so user is never blocked!
      if (
        error.code === "auth/operation-not-allowed" ||
        error.message?.includes("operation-not-allowed") ||
        error.message?.includes("CONFIGURATION_NOT_FOUND") ||
        error.message?.includes("network-request-failed")
      ) {
        const normalizedEmail = email.toLowerCase().trim();
        const usersStr = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
        const users = usersStr ? JSON.parse(usersStr) : {};

        // Unique user ID per account
        const localUid = "user_" + Math.random().toString(36).substring(2, 12);
        const newLocalProfile: UserProfile = {
          id: localUid,
          email: normalizedEmail,
          displayName: name.trim() || normalizedEmail.split("@")[0],
          telegramChatId: "",
          telegramNotificationsEnabled: true,
          highContrast: false,
          fontSize: "normal",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        users[normalizedEmail] = {
          ...newLocalProfile,
          password: pass,
        };

        localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
        setProfile(newLocalProfile);
        persistLocalProfile(newLocalProfile);

        return { isLocalFallback: true };
      }

      throw error;
    }
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn("SignOut error:", e);
    }
    setProfile(null);
    persistLocalProfile(null);
  };

  const updateTelegramChatId = async (chatId: string) => {
    const activeId = user?.uid || profile?.id;
    if (!activeId) return;

    const updated = {
      telegramChatId: chatId.trim(),
      updatedAt: new Date().toISOString(),
    };

    if (user) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, updated);
      } catch (err) {
        console.warn("Could not update firestore telegramChatId:", err);
      }
    }

    setProfile((prev) => {
      const next = prev ? { ...prev, ...updated } : null;
      persistLocalProfile(next);
      return next;
    });
  };

  const updateAccessibility = async (fontSize: "normal" | "large" | "xlarge", highContrast: boolean) => {
    const activeId = user?.uid || profile?.id;
    if (!activeId) return;

    const updated = {
      fontSize,
      highContrast,
      updatedAt: new Date().toISOString(),
    };

    if (user) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, updated);
      } catch (err) {
        console.warn("Could not update firestore accessibility:", err);
      }
    }

    setProfile((prev) => {
      const next = prev ? { ...prev, ...updated } : null;
      persistLocalProfile(next);
      return next;
    });
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user);
    } else {
      restoreLocalProfile();
    }
  };

  // Effective user ID is either the Firebase user.uid or the profile.id
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
