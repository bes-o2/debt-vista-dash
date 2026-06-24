import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from './useCompany';

export interface Company {
  id: string;
  name: string;
  cnpj?: string;
  industry?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const useCompanies = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { updateSelectedCompany } = useCompany();

  const fetchCompanies = async () => {
    if (!user) {
      setCompanies([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Buscar empresas do banco de dados
      const { data: userCompanies, error: userCompaniesError } = await supabase
        .from('user_companies')
        .select(`
          company_id,
          role,
          companies:company_id (
            id,
            name,
            cnpj,
            industry,
            created_by,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id);

      if (userCompaniesError) {
        throw userCompaniesError;
      }

      if (userCompanies && userCompanies.length > 0) {
        // Transformar dados para o formato esperado
        const companiesList: Company[] = userCompanies
          .map(uc => uc.companies)
          .filter(Boolean) as Company[];
        
        setCompanies(companiesList);
        updateSelectedCompany(companiesList);
      } else {
        // Se não há empresas, buscar se existe alguma empresa criada pelo usuário
        const { data: ownedCompanies, error: ownedError } = await supabase
          .from('companies')
          .select('*')
          .eq('created_by', user.id);

        if (ownedError) {
          throw ownedError;
        }

        if (ownedCompanies && ownedCompanies.length > 0) {
          setCompanies(ownedCompanies);
          updateSelectedCompany(ownedCompanies);
        } else {
          // Criar empresa padrão
          const { data: newCompany, error: createError } = await supabase
            .from('companies')
            .insert([{
              name: 'Minha Empresa',
              created_by: user.id
            }])
            .select()
            .single();

          if (createError) {
            throw createError;
          }

          // Associar usuário à empresa
          const { error: associationError } = await supabase
            .from('user_companies')
            .insert([{
              user_id: user.id,
              company_id: newCompany.id,
              role: 'owner'
            }]);

          if (associationError) {
            throw associationError;
          }

          setCompanies([newCompany]);
          updateSelectedCompany([newCompany]);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar empresas';
      setError(errorMessage);
      console.error('Error fetching companies:', err);
    } finally {
      setLoading(false);
    }
  };

  const addCompany = async (companyData: Omit<Company, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    if (!user?.id) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para adicionar uma empresa. Tente fazer logout e login novamente.",
        variant: "destructive",
      });
      return null;
    }

    try {
      // Criar empresa no banco de dados
      const { data: newCompany, error: createError } = await supabase
        .from('companies')
        .insert([{
          ...companyData,
          created_by: user.id
        }])
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Associar usuário à empresa
      const { error: associationError } = await supabase
        .from('user_companies')
        .insert([{
          user_id: user.id,
          company_id: newCompany.id,
          role: 'owner'
        }]);

      if (associationError) {
        throw associationError;
      }

      // Atualizar estado local
      const updatedCompanies = [...companies, newCompany];
      setCompanies(updatedCompanies);
      updateSelectedCompany(updatedCompanies);
      
      toast({
        title: "Sucesso",
        description: "Empresa adicionada com sucesso",
      });

      return newCompany;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao adicionar empresa';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateCompany = async (id: string, companyData: Partial<Omit<Company, 'id' | 'created_by' | 'created_at' | 'updated_at'>>) => {
    if (!user) return;

    try {
      // Atualizar empresa no banco de dados
      const { data: updatedCompany, error: updateError } = await supabase
        .from('companies')
        .update(companyData)
        .eq('id', id)
        .eq('created_by', user.id) // Garantir que só o criador pode atualizar
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Atualizar estado local
      const updatedCompanies = companies.map(company => 
        company.id === id ? updatedCompany : company
      );
      setCompanies(updatedCompanies);
      
      toast({
        title: "Sucesso",
        description: "Empresa atualizada com sucesso",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar empresa';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const deleteCompany = async (id: string) => {
    if (!user) return false;

    try {
      // Call the archive_company function to soft delete and backup
      const { error: archiveError } = await supabase
        .rpc('archive_company', { company_id: id });

      if (archiveError) {
        throw archiveError;
      }

      // Remove from local state
      const updatedCompanies = companies.filter(company => company.id !== id);
      setCompanies(updatedCompanies);
      updateSelectedCompany(updatedCompanies);
      
      toast({
        title: "Empresa excluída",
        description: "A empresa foi arquivada e será permanentemente excluída em 30 dias",
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir empresa';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchCompanies();
    // Depende do id (estável) e não do objeto `user`: o Supabase re-emite um novo
    // objeto User ao focar a aba, o que recarregava as empresas e causava flicker
    // no seletor (estado "Carregando..." piscando).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return {
    companies,
    loading,
    error,
    addCompany,
    updateCompany,
    deleteCompany,
    refetch: fetchCompanies
  };
};
