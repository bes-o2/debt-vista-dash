import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/components/ui/use-toast';

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

  const fetchCompanies = async () => {
    if (!user) {
      setCompanies([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Temporário: usar localStorage até migração ser aplicada
      const storedCompanies = localStorage.getItem(`companies_${user.id}`);
      if (storedCompanies) {
        setCompanies(JSON.parse(storedCompanies));
      } else {
        // Criar empresa padrão se não existir nenhuma
        const defaultCompany: Company = {
          id: crypto.randomUUID(),
          name: 'Minha Empresa',
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setCompanies([defaultCompany]);
        localStorage.setItem(`companies_${user.id}`, JSON.stringify([defaultCompany]));
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
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para adicionar uma empresa",
        variant: "destructive",
      });
      return null;
    }

    try {
      // Temporário: usar localStorage até migração ser aplicada
      const newCompany: Company = {
        id: crypto.randomUUID(),
        ...companyData,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const updatedCompanies = [...companies, newCompany];
      setCompanies(updatedCompanies);
      localStorage.setItem(`companies_${user.id}`, JSON.stringify(updatedCompanies));
      
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
      // Temporário: usar localStorage até migração ser aplicada
      const updatedCompanies = companies.map(company => 
        company.id === id 
          ? { ...company, ...companyData, updated_at: new Date().toISOString() }
          : company
      );
      
      setCompanies(updatedCompanies);
      localStorage.setItem(`companies_${user.id}`, JSON.stringify(updatedCompanies));
      
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

  useEffect(() => {
    fetchCompanies();
  }, [user]);

  return {
    companies,
    loading,
    error,
    addCompany,
    updateCompany,
    refetch: fetchCompanies
  };
};