import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type AuthResultError = AuthError | { message: string } | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthResultError }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthResultError }>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ error: AuthResultError }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getAuthErrorMessage = (message?: string) => {
  if (message === "Invalid login credentials") {
    return "Email ou senha inválidos.";
  }

  if (message === "User already registered") {
    return "Este email já tem cadastro.";
  }

  return "Não foi possível concluir a operação. Tente novamente.";
};

const getPasswordUpdateErrorMessage = (message?: string) => {
  const normalizedMessage = message?.toLowerCase();

  if (message === "Invalid login credentials") {
    return "Senha atual incorreta.";
  }

  if (normalizedMessage?.includes("same password") || normalizedMessage?.includes("different")) {
    return "A nova senha deve ser diferente da senha atual.";
  }

  if (normalizedMessage?.includes("password")) {
    return "Não foi possível alterar a senha. Confira os requisitos e tente novamente.";
  }

  return "Não foi possível alterar a senha. Tente novamente.";
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Get initial session — validate it belongs to the current project
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        // Clear any stale session from a previous project
        supabase.auth.signOut();
        setSession(null);
        setUser(null);
      } else {
        setSession(session);
        setUser(session.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    // Validação de domínio corporativo
    if (!email.endsWith('@o2inc.com.br')) {
      const error = { message: 'Apenas emails corporativos @o2inc.com.br são permitidos para cadastro.' };
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }

    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName || email
        }
      }
    });

    if (error) {
      toast({
        title: "Erro no cadastro",
        description: getAuthErrorMessage(error.message),
        variant: "destructive"
      });
    } else {
      toast({
        title: "Cadastro realizado!",
        description: "Verifique seu email para confirmar a conta."
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      toast({
        title: "Erro no login",
        description: getAuthErrorMessage(error.message),
        variant: "destructive"
      });
    }

    return { error };
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    if (!user?.email) {
      const error = { message: "Não foi possível identificar o email do usuário." };
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }

    const { error: currentPasswordError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (currentPasswordError) {
      toast({
        title: "Erro ao alterar senha",
        description: getPasswordUpdateErrorMessage(currentPasswordError.message),
        variant: "destructive"
      });
      return { error: currentPasswordError };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      toast({
        title: "Erro ao alterar senha",
        description: getPasswordUpdateErrorMessage(error.message),
        variant: "destructive"
      });
    } else {
      toast({
        title: "Senha alterada",
        description: "Use a nova senha no próximo acesso."
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso."
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      signUp,
      signIn,
      updatePassword,
      signOut,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
