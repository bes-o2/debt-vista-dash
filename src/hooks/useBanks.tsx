import { useState, useEffect } from 'react';

export interface Bank {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// Dados padrão até que a migração seja executada
const defaultBanks: Bank[] = [
  { id: '1', name: 'Banco do Brasil', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', name: 'Caixa Econômica Federal', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', name: 'Itaú', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '4', name: 'Bradesco', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const useBanks = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBanks = async () => {
    try {
      setLoading(true);
      // Simula carregamento dos dados padrão
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Tenta carregar do localStorage primeiro
      const savedBanks = localStorage.getItem('custom_banks');
      if (savedBanks) {
        setBanks(JSON.parse(savedBanks));
      } else {
        setBanks(defaultBanks);
        localStorage.setItem('custom_banks', JSON.stringify(defaultBanks));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar bancos');
      setBanks(defaultBanks);
    } finally {
      setLoading(false);
    }
  };

  const addBank = async (name: string) => {
    try {
      // Verifica se já existe
      const existingBank = banks.find(bank => bank.name.toLowerCase() === name.toLowerCase());
      if (existingBank) {
        throw new Error('Este banco já existe');
      }

      const newBank: Bank = {
        id: Date.now().toString(),
        name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const updatedBanks = [...banks, newBank].sort((a, b) => a.name.localeCompare(b.name));
      setBanks(updatedBanks);
      localStorage.setItem('custom_banks', JSON.stringify(updatedBanks));
      
      return newBank;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  return {
    banks,
    loading,
    error,
    addBank,
    refetch: fetchBanks
  };
};