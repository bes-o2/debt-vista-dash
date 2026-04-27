import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <Logo size="md" />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-eyebrow text-muted-foreground">404</p>
        <h1 className="mb-3 text-3xl font-bold">Página não encontrada</h1>
        <p className="mb-6 text-muted-foreground">A rota que você tentou acessar não existe.</p>
        <Button asChild>
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
