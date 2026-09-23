"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type ContentItem = {
  id: string;
  title: string;
  type: string;
  durationMs: number;
};

export function ContentPicker({
  isOpen,
  onClose,
  contents,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  contents: ContentItem[];
  onSelect: (contentId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = contents.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Conteúdo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground uppercase">{item.type} • {item.durationMs / 1000}s</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => {
                  onSelect(item.id);
                  onClose();
                }}>
                  Adicionar
                </Button>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum conteúdo encontrado.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
