import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ManageableCompany {
  id: string;
  name: string;
  cnpj: string | null;
  created_by: string;
}

export interface CompanyMember {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  is_owner: boolean;
}

export function useCompanyAccess() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<ManageableCompany[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    const { data, error } = await supabase.rpc("list_manageable_companies");
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setCompanies([]);
    } else {
      setCompanies((data ?? []) as ManageableCompany[]);
    }
    setLoadingCompanies(false);
  }, [toast]);

  const fetchMembers = useCallback(
    async (companyId: string) => {
      setLoadingMembers(true);
      const { data, error } = await supabase.rpc("list_company_members", { _company_id: companyId });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        setMembers([]);
      } else {
        setMembers((data ?? []) as CompanyMember[]);
      }
      setLoadingMembers(false);
    },
    [toast],
  );

  const grantAccess = useCallback(
    async (companyId: string, email: string) => {
      const { error } = await supabase.rpc("grant_company_access", {
        _company_id: companyId,
        _email: email,
      });
      if (error) {
        toast({ title: "Não foi possível conceder acesso", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: "Acesso concedido", description: `${email} agora tem acesso a esta empresa.` });
      await fetchMembers(companyId);
      return true;
    },
    [toast, fetchMembers],
  );

  const revokeAccess = useCallback(
    async (companyId: string, userId: string) => {
      const { error } = await supabase.rpc("revoke_company_access", {
        _company_id: companyId,
        _user_id: userId,
      });
      if (error) {
        toast({ title: "Não foi possível remover o acesso", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: "Acesso removido" });
      await fetchMembers(companyId);
      return true;
    },
    [toast, fetchMembers],
  );

  return {
    companies,
    members,
    loadingCompanies,
    loadingMembers,
    fetchCompanies,
    fetchMembers,
    grantAccess,
    revokeAccess,
  };
}
