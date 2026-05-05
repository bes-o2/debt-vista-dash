import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Company } from './useCompanies';

interface CompanyContextType {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  updateSelectedCompany: (companies: Company[]) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Persistir empresa selecionada no localStorage
  useEffect(() => {
    const savedCompany = localStorage.getItem('selectedCompany');
    if (savedCompany) {
      try {
        const parsedCompany = JSON.parse(savedCompany);
        setSelectedCompany(parsedCompany);
      } catch (error) {
        console.error('Error parsing saved company:', error);
        localStorage.removeItem('selectedCompany');
      }
    }
  }, []);

  // Função para atualizar a empresa selecionada com base numa nova lista de empresas
  const updateSelectedCompany = (companies: Company[]) => {
    if (selectedCompany && companies.length > 0) {
      // Procurar pela empresa selecionada atual na nova lista
      const updatedCompany = companies.find(c => c.id === selectedCompany.id);
      if (updatedCompany) {
        setSelectedCompany(updatedCompany);
        localStorage.setItem('selectedCompany', JSON.stringify(updatedCompany));
      } else {
        // Empresa salva não existe mais na lista do usuário
        setSelectedCompany(null);
        localStorage.removeItem('selectedCompany');
      }
    }
  };

  const handleSetSelectedCompany = (company: Company | null) => {
    setSelectedCompany(company);
    if (company) {
      localStorage.setItem('selectedCompany', JSON.stringify(company));
    } else {
      localStorage.removeItem('selectedCompany');
    }
  };

  return (
    <CompanyContext.Provider value={{
      selectedCompany,
      setSelectedCompany: handleSetSelectedCompany,
      updateSelectedCompany
    }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
