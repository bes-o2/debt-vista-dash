import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Company } from './useCompanies';

interface CompanyContextType {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  updateSelectedCompany: (companies: Company[]) => void;
  isSessionModalOpen: boolean;
  renewCompanySession: () => void;
  openCompanySessionModal: () => void;
}

const SESSION_STORAGE_KEY = 'companySessionTimestamp';
const SESSION_DURATION_MS = 60 * 60 * 1000; // 60 minutos

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  // Hidratação inicial do localStorage
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

  // Verificação de sessão: abre modal se não houver timestamp ou se expirou
  useEffect(() => {
    const timestampStr = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!timestampStr) {
      setIsSessionModalOpen(true);
      return;
    }
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > SESSION_DURATION_MS) {
      setIsSessionModalOpen(true);
    }
  }, []);

  const renewCompanySession = useCallback(() => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, Date.now().toString());
    setIsSessionModalOpen(false);
  }, []);

  const openCompanySessionModal = useCallback(() => {
    setIsSessionModalOpen(true);
  }, []);

  // Atualizar empresa selecionada quando a lista de empresas mudar
  const updateSelectedCompany = useCallback((companies: Company[]) => {
    setSelectedCompany((prev) => {
      if (prev && companies.length > 0) {
        const updatedCompany = companies.find(c => c.id === prev.id);
        if (updatedCompany) {
          localStorage.setItem('selectedCompany', JSON.stringify(updatedCompany));
          return updatedCompany;
        } else {
          localStorage.removeItem('selectedCompany');
          return null;
        }
      }
      return prev;
    });
  }, []);

  const handleSetSelectedCompany = useCallback((company: Company | null) => {
    setSelectedCompany(company);
    if (company) {
      localStorage.setItem('selectedCompany', JSON.stringify(company));
    } else {
      localStorage.removeItem('selectedCompany');
    }
  }, []);

  return (
    <CompanyContext.Provider value={{
      selectedCompany,
      setSelectedCompany: handleSetSelectedCompany,
      updateSelectedCompany,
      isSessionModalOpen,
      renewCompanySession,
      openCompanySessionModal,
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
