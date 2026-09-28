"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeviceConfigurationHelp() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="border-0 bg-[var(--color-primary)]/5 shadow-sm ring-1 ring-[var(--color-primary)]/15 transition-all duration-200">
      <CardHeader 
        className="pb-3 cursor-pointer flex flex-row items-center justify-between space-y-0" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-base">Configuração da Smart TV</CardTitle>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-3 text-sm text-[var(--color-muted-foreground)]">
          <div>
            <p className="font-medium text-[var(--color-foreground)]">Link recomendado</p>
            <code className="break-all">/tv.html</code>
            <p className="mt-1">
              Em Android TV/Chrome também pode usar <code>/player</code>. A TV e o painel
              devem estar na mesma rede; substitua o host pelo IPv4 do computador que executa o
              Vitrine360 (por exemplo, <code>http://192.168.1.20:3000/tv.html</code>).
            </p>
          </div>
          <div>
            <p className="font-medium text-[var(--color-foreground)]">Emparelhamento</p>
            <p>
              Abra o link, introduza o código de 6 dígitos mostrado na TV uma única vez e reutilize
              o mesmo código interno, nome e localização. O navegador guarda a identidade da TV para
              evitar novos registos após reload.
            </p>
          </div>
          <div>
            <p className="font-medium text-[var(--color-foreground)]">Estado da ligação</p>
            <p>
              <strong>ONLINE</strong> = heartbeat recente; <strong>INSTÁVEL</strong> = janela de
              tolerância; <strong>OFFLINE</strong> = sem heartbeat há mais de 15 minutos. O painel
              atualiza automaticamente e mostra o último heartbeat.
            </p>
          </div>
          <div>
            <p className="font-medium text-[var(--color-foreground)]">Se a TV perder a configuração</p>
            <p>
              Não crie um novo nome imediatamente. Verifique primeiro a TV existente na lista,
              mantenha o mesmo código interno e use a ação de rotação/reemparelhamento do dispositivo
              quando disponível.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
