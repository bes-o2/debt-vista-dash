import React, { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Building2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/hooks/useCompany";
import { useCompanies } from "@/hooks/useCompanies";
import { cn } from "@/lib/utils";

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/70 backdrop-blur-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const CompanySessionModal: React.FC = () => {
  const { isSessionModalOpen, setSelectedCompany, renewCompanySession } = useCompany();
  const { companies, loading, addCompany } = useCompanies();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyCnpj, setNewCompanyCnpj] = useState("");
  const [newCompanyIndustry, setNewCompanyIndustry] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleSelectCompany = (company: typeof companies[number]) => {
    setSelectedCompany(company);
    renewCompanySession();
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    setIsAdding(true);
    const result = await addCompany({
      name: newCompanyName.trim(),
      cnpj: newCompanyCnpj.trim() || undefined,
      industry: newCompanyIndustry.trim() || undefined,
    });

    if (result) {
      setSelectedCompany(result);
      renewCompanySession();
      setShowAddForm(false);
      setNewCompanyName("");
      setNewCompanyCnpj("");
      setNewCompanyIndustry("");
    }
    setIsAdding(false);
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNewCompanyName("");
    setNewCompanyCnpj("");
    setNewCompanyIndustry("");
  };

  return (
    <DialogPrimitive.Root open={isSessionModalOpen} modal={true}>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            Selecione a empresa ativa
          </h2>
          <p className="text-sm text-muted-foreground">
            Para visualizar os dados financeiros, escolha a empresa abaixo.
            Esta confirmação é solicitada a cada 60 minutos.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Carregando empresas...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {companies.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhuma empresa cadastrada.
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => handleSelectCompany(company)}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{company.name}</span>
                      {company.cnpj && (
                        <span className="text-xs text-muted-foreground">CNPJ: {company.cnpj}</span>
                      )}
                      {company.industry && (
                        <span className="text-xs text-muted-foreground">{company.industry}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showAddForm ? (
              <form onSubmit={handleAddCompany} className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="space-y-2">
                  <Label htmlFor="modal-company-name">Nome da Empresa *</Label>
                  <Input
                    id="modal-company-name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Ex: Minha Empresa Ltda"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modal-company-cnpj">CNPJ</Label>
                  <Input
                    id="modal-company-cnpj"
                    value={newCompanyCnpj}
                    onChange={(e) => setNewCompanyCnpj(e.target.value)}
                    placeholder="Ex: 12.345.678/0001-90"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modal-company-industry">Setor</Label>
                  <Input
                    id="modal-company-industry"
                    value={newCompanyIndustry}
                    onChange={(e) => setNewCompanyIndustry(e.target.value)}
                    placeholder="Ex: Tecnologia, Varejo, Serviços"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={handleCancelAdd} disabled={isAdding}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={isAdding}>
                    {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Adicionar
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4" />
                Nova empresa
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </DialogPrimitive.Root>
  );
};
