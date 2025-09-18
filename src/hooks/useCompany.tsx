import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Company } from './useCompanies';

interface CompanyContextType {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Persistir empresa selecionada no localStorage
  useEffect(() => {
    const savedCompany = localStorage.getItem('selectedCompany');
    if (savedCompany) {
      try {
        setSelectedCompany(JSON.parse(savedCompany));
      } catch (error) {
        console.error('Error parsing saved company:', error);
        localStorage.removeItem('selectedCompany');
      }
    }
  }, []);

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
      setSelectedCompany: handleSetSelectedCompany
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