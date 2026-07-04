import { useState } from "react";
import { AlertTriangle, ClipboardList, ClipboardPaste, Settings2, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRotinas } from "@/hooks/useRotinas";
import { RotinaClientDialog } from "./RotinaClientDialog";
import { RotinaConfigDialog } from "./RotinaConfigDialog";
import { RotinasMacroView } from "./RotinasMacroView";
import { RotinaPasteDialog } from "./RotinaPasteDialog";

export const RotinasPanel = () => {
  const rotinas = useRotinas();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const isMissingTable = (rotinas.error as any)?.code === "42P01";

  if (isMissingTable) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <h3 className="font-semibold">Módulo de Rotinas ainda não aplicado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Aplique a migration <code>20260619120000_routines_module.sql</code> no Supabase.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedView = selectedClientId ? rotinas.clientViews.get(selectedClientId) ?? null : null;

  return (
    <Card className="relative z-0 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Rotinas
            <span className="text-xs font-normal text-muted-foreground">
              {rotinas.clients.length} cliente{rotinas.clients.length === 1 ? "" : "s"}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => rotinas.ensureGeneralSection.mutate()} disabled={rotinas.ensureGeneralSection.isPending} title="Cria/abre a seção Geral (rotinas não vinculadas a empresa)">
              <Sparkles className="h-3.5 w-3.5" /> Geral
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => setPasteOpen(true)}>
              <ClipboardPaste className="h-3.5 w-3.5" /> Colar Texto
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => setConfigOpen(true)}>
              <Settings2 className="h-3.5 w-3.5" /> Configurar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rotinas.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : rotinas.segments.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/60" />
            <div>
              <p className="font-semibold">Nenhuma rotina configurada</p>
              <p className="text-sm text-muted-foreground">Crie a estrutura inicial (Construção, Regulação, CONAB, Nery Agro) ou configure manualmente.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => rotinas.seedInitialStructure.mutate()} disabled={rotinas.seedInitialStructure.isPending} className="gap-2">
                <Plus className="h-4 w-4" /> Criar estrutura inicial
              </Button>
              <Button variant="outline" onClick={() => setConfigOpen(true)} className="gap-2">
                <Settings2 className="h-4 w-4" /> Configurar manualmente
              </Button>
            </div>
          </div>
        ) : (
          <RotinasMacroView rotinas={rotinas} onSelectClient={setSelectedClientId} />
        )}
      </CardContent>

      {selectedView && (
        <RotinaClientDialog
          view={selectedView}
          rotinas={rotinas}
          open={!!selectedClientId}
          onClose={() => setSelectedClientId(null)}
          defaultTab="relatorio"
        />
      )}
      <RotinaConfigDialog rotinas={rotinas} open={configOpen} onClose={() => setConfigOpen(false)} />
      <RotinaPasteDialog rotinas={rotinas} open={pasteOpen} onClose={() => setPasteOpen(false)} />
    </Card>
  );
};

export default RotinasPanel;
