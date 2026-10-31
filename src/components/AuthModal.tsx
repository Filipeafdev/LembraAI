import React, { useState } from "react";
import {
  X,
  Lock,
  Mail,
  User,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Info,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.tsx";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const [isRegister, setIsRegister] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successNotice, setSuccessNotice] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessNotice("");
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) {
          throw new Error("Por favor, digite seu nome.");
        }
        const res = await registerWithEmail(email.trim(), password, name.trim());
        setLoading(false);
        if (res.isLocalFallback) {
          setSuccessNotice("Conta criada e isolada com sucesso!");
          setTimeout(() => onClose(), 800);
        } else {
          onClose();
        }
      } else {
        await loginWithEmail(email.trim(), password);
        setLoading(false);
        onClose();
      }
    } catch (err: any) {
      setLoading(false);
      let msg = err.message || "Falha na autenticação.";
      if (err.code === "auth/invalid-email" || msg.includes("invalid-email")) {
        msg = "Endereço de e-mail inválido.";
      } else if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        msg = "E-mail ou senha incorretos.";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "Este e-mail já está cadastrado. Alterne para Entrar abaixo.";
      } else if (err.code === "auth/weak-password") {
        msg = "A senha deve conter no mínimo 6 dígitos.";
      }
      setErrorMessage(msg);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage("");
    setLoading(true);
    try {
      await loginWithGoogle();
      setLoading(false);
      onClose();
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(
        err.message?.includes("popup-closed-by-user")
          ? "A janela de login foi fechada antes da confirmação."
          : err.message || "Erro ao conectar com Google."
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-tr from-slate-900 to-slate-800 text-white p-6 relative">
          <button
            onClick={onClose}
            aria-label="Fechar janela"
            className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Privacidade Total
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-white">
            {isRegister ? "Criar sua Conta no LembraAI" : "Entrar na sua Conta"}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Cada usuário possui sua própria agenda 100% privada e independente.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {/* Success banner */}
          {successNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 animate-in fade-in font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{errorMessage}</p>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Dica: Para acesso instantâneo sem configurações, você pode usar o botão <b>"Entrar com Google"</b> abaixo.
                </p>
              </div>
            </div>
          )}

          {/* Primary Option: Google Sign-in (Pre-configured) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-1">
              <span>Opção Mais Rápida:</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> 1 Clique
              </span>
            </div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/50 hover:bg-emerald-50 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 transition shadow-xs hover:border-emerald-600"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar com o Google</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-400 font-medium">ou crie com E-mail e Senha</span>
            </div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {isRegister && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Seu Nome:</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Maria Silva"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:outline-hidden text-sm font-semibold text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">E-mail:</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:outline-hidden text-sm font-semibold text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Senha:</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:outline-hidden text-sm font-semibold text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20 mt-1"
            >
              <span>{loading ? "Processando..." : isRegister ? "Confirmar Cadastro" : "Entrar na Agenda"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Toggle between Login and Register */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setErrorMessage("");
                setSuccessNotice("");
              }}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              {isRegister
                ? "Já tem uma conta? Clique aqui para Entrar"
                : "Ainda não tem conta? Clique aqui para Cadastrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
