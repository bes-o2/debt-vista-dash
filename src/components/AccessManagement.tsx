import { useEffect, useState, type FormEvent } from "react";
import { Users, UserPlus, Trash2, ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useCompanyAccess } from "@/hooks/useCompanyAccess";
import { useAuth } from "@/hooks/useAuth";

const SUPER_ADMIN_EMAIL = "matheus.besnos@o2inc.com.br";

export function AccessManagement() {
  const { user } = useAuth();
  const {
    companies,
    members,
    loadingCompanies,
    loadingMembers,
    fetchCompanies,
    fetchMembers,
    grantAccess,
    revokeAccess,
  } = useCompanyAccess();
  const [selectedId, setSelectedId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [granting, setGranting] = useState(false);

  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL;

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Seleciona a primeira empresa automaticamente
  useEffect(() => {
    if (!selectedId && companies.length > 0) {
      setSelectedId(companies[0].id);
    }
  }, [companies, selectedId]);

  useEffect(() => {
    if (selectedId) {
      fetchMembers(selectedId);
    }
  }, [selectedId, fetchMembers]);

  const handleGrant = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !email.trim()) return;
    setGranting(true);
    const ok = await grantAccess(selectedId, email.trim());
    setGranting(false);
    if (ok) setEmail("");
  };

  const handleRevoke = (userId: string, label: string) => {
    if (window.confirm(`Remover o acesso de ${label} a esta empresa?`)) {
      revokeAccess(selectedId, userId);
    }
  };

  if (loadingCompanies) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Você não é dono de nenhuma empresa. Apenas o dono pode gerenciar os acessos.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Você é super-admin — pode gerenciar acessos de qualquer empresa.
        </div>
      )}

      <div className="space-y-2">
        <Label>Empresa</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a empresa" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" /> Pessoas com acesso
          </CardTitle>
          <CardDescription>Quem pode ver e editar os dados desta empresa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleGrant} className="flex gap-2">
            <Input
              type="email"
              placeholder="email@o2inc.com.br"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button
              type="submit"
              disabled={granting || !email.trim()}
              className="shrink-0 bg-emerald-500 text-white hover:bg-emerald-600"
            >
              {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Dar acesso</span>
            </Button>
          </form>

          {loadingMembers ? (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando membros...
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {members.map((member) => {
                const label = member.email ?? member.display_name ?? member.user_id;
                return (
                  <li key={member.user_id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{label}</p>
                      {member.display_name && member.email && (
                        <p className="truncate text-xs text-muted-foreground">{member.display_name}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {member.is_owner ? (
                        <Badge variant="secondary">Dono</Badge>
                      ) : (
                        <>
                          <Badge variant="outline">Membro</Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                            onClick={() => handleRevoke(member.user_id, label)}
                            aria-label="Remover acesso"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
