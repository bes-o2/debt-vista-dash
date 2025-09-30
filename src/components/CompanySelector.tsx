import React, { useState } from 'react';
import { ChevronDown, Plus, Building2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCompanies, type Company } from '@/hooks/useCompanies';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/hooks/use-toast';

export const CompanySelector: React.FC = () => {
  const { companies, loading, addCompany, deleteCompany } = useCompanies();
  const { selectedCompany, setSelectedCompany } = useCompany();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCnpj, setNewCompanyCnpj] = useState('');
  const [newCompanyIndustry, setNewCompanyIndustry] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCompanyName.trim()) {
      toast({
        title: "Erro",
        description: "Nome da empresa é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    const result = await addCompany({
      name: newCompanyName.trim(),
      cnpj: newCompanyCnpj.trim() || undefined,
      industry: newCompanyIndustry.trim() || undefined,
    });

    if (result) {
      setSelectedCompany(result);
      setNewCompanyName('');
      setNewCompanyCnpj('');
      setNewCompanyIndustry('');
      setIsDialogOpen(false);
    }
    setIsAdding(false);
  };

  const handleDeleteClick = (company: Company) => {
    setCompanyToDelete(company);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!companyToDelete) return;
    
    const success = await deleteCompany(companyToDelete.id);
    if (success) {
      setDeleteDialogOpen(false);
      setCompanyToDelete(null);
    }
  };

  // Auto-selecionar primeira empresa se não há nenhuma selecionada
  React.useEffect(() => {
    if (!selectedCompany && companies.length > 0) {
      setSelectedCompany(companies[0]);
    }
  }, [companies, selectedCompany, setSelectedCompany]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-md">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="justify-between min-w-[200px]">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="truncate">
                {selectedCompany ? selectedCompany.name : 'Selecionar empresa'}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[300px] bg-background border shadow-md z-50">
          {companies.length > 0 ? (
            <>
              {companies.map((company) => (
                <DropdownMenuItem
                  key={company.id}
                  onClick={() => setSelectedCompany(company)}
                  className="cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{company.name}</span>
                    {company.cnpj && (
                      <span className="text-xs text-muted-foreground">CNPJ: {company.cnpj}</span>
                    )}
                    {company.industry && (
                      <span className="text-xs text-muted-foreground">{company.industry}</span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : (
            <DropdownMenuItem disabled>
              <span className="text-muted-foreground">Nenhuma empresa cadastrada</span>
            </DropdownMenuItem>
          )}
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem 
                onSelect={(e) => e.preventDefault()}
                className="cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova empresa
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Adicionar Nova Empresa</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddCompany} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Nome da Empresa *</Label>
                  <Input
                    id="company-name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Ex: Minha Empresa Ltda"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-cnpj">CNPJ</Label>
                  <Input
                    id="company-cnpj"
                    value={newCompanyCnpj}
                    onChange={(e) => setNewCompanyCnpj(e.target.value)}
                    placeholder="Ex: 12.345.678/0001-90"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-industry">Setor</Label>
                  <Input
                    id="company-industry"
                    value={newCompanyIndustry}
                    onChange={(e) => setNewCompanyIndustry(e.target.value)}
                    placeholder="Ex: Tecnologia, Varejo, Serviços"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isAdding}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isAdding}>
                    {isAdding ? 'Adicionando...' : 'Adicionar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete Company Option */}
          {selectedCompany && companies.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => handleDeleteClick(selectedCompany)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir empresa atual
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Excluir Empresa
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold">
                Você está prestes a excluir a empresa "{companyToDelete?.name}".
              </p>
              <p>
                ⚠️ <strong>ATENÇÃO:</strong> Esta ação é permanente após 30 dias.
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Todas as dívidas e dados associados serão excluídos</li>
                <li>A empresa será arquivada por 30 dias</li>
                <li>Após 30 dias, os dados serão permanentemente excluídos</li>
              </ul>
              <p className="font-semibold mt-4">
                Tem certeza que deseja continuar?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, excluir empresa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};