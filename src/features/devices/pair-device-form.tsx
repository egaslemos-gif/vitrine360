"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/ui/info-tooltip";

export function PairDeviceForm() {
  const router = useRouter();
  const [activationCode, setActivationCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [deviceCode, setDeviceCode] = useState("TV-HALL-001");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const res = await fetch("/api/admin/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activationCode,
        name,
        location,
        deviceCode: deviceCode.toUpperCase(),
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Falha no pairing");
      return;
    }
    setMessage("Dispositivo associado. O Player irá receber o token.");
    setActivationCode("");
    router.refresh();
  }

  return (
    <Card className="border-0 shadow-sm ring-1 ring-black/5 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Adicionar Ecrã
          <InfoTooltip 
            title="Associação de Novo Ecrã" 
            text="Esta secção serve para registar e associar fisicamente um novo Ecrã à sua conta. Para isso, inicie o Player no dispositivo e ele mostrará um código no ecrã." 
          />
        </CardTitle>
        <CardDescription>Introduza o código gerado no ecrã do dispositivo para o associar ao seu painel.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor="code">Código de Activação</Label>
              <InfoTooltip text="Código de 6 dígitos temporário (Ex: 123456) que aparece no ecrã do dispositivo quando inicia o player pela primeira vez." />
            </div>
            <Input
              id="code"
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
              placeholder="6 dígitos"
              required
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor="deviceCode">Código de Identificação (ID)</Label>
              <InfoTooltip text="Um código interno único e sem espaços que servirá para identificar esta máquina no sistema (Ex: TV-RECECAO, PISO-1-ESQ)." />
            </div>
            <Input
              id="deviceCode"
              value={deviceCode}
              onChange={(e) => setDeviceCode(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor="name">Nome Descritivo</Label>
              <InfoTooltip text="Um nome amigável para reconhecer o ecrã facilmente na lista de dispositivos. Pode usar espaços e acentos." />
            </div>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Ecrã da Entrada Principal"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor="location">Localização Física</Label>
              <InfoTooltip text="(Opcional) A morada, edifício ou sala onde o ecrã se encontra instalado, útil para gestão e manutenção futura." />
            </div>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Edifício Central - Piso 0"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Associar dispositivo</Button>
            {message ? (
              <p className="mt-2 text-sm text-[var(--color-success)]">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="mt-2 text-sm text-[var(--color-destructive)]">
                {error}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
