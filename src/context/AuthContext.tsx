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
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase.ts";
import { UserProfile } from "../types/index.ts";

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
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

  // Fetch or initialize user profile document in Firestore
  const loadUserProfile = async (currentUser: FirebaseUser) => {
    const userDocRef = doc(db, "users", currentUser.uid);
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setProfile(data);
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
        await setDoc(userDocRef, initialProfile);
        setProfile(initialProfile);
      }
    } catch (err) {
      console.error("Error loading user profile:", err);
      // Fallback in-memory profile so user is not blocked
      setProfile({
        id: currentUser.uid,
        email: currentUser.email || "",
        displayName: currentUser.displayName || "Usuário",
        telegramChatId: "",
        telegramNotificationsEnabled: true,
        highContrast: false,
        fontSize: "normal",
        createdAt: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadUserProfile(currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
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
      setProfile(newProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${cred.user.uid}`);
    }
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const updateTelegramChatId = async (chatId: string) => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    const updated = {
      telegramChatId: chatId.trim(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await updateDoc(userDocRef, updated);
      setProfile((prev) => (prev ? { ...prev, ...updated } : null));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateAccessibility = async (fontSize: "normal" | "large" | "xlarge", highContrast: boolean) => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    const updated = {
      fontSize,
      highContrast,
      updatedAt: new Date().toISOString(),
    };
    try {
      await updateDoc(userDocRef, updated);
      setProfile((prev) => (prev ? { ...prev, ...updated } : null));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
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
