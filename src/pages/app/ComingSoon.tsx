import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-muted-foreground">{desc}</p>
      <Card className="mt-8 flex flex-col items-center justify-center gap-3 p-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-glow">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-semibold">Próximamente en la Fase 2</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Esta sección llega en la próxima entrega: gestión completa de menú, mesas con QR, pedidos en vivo, KDS de cocina y más.
        </p>
      </Card>
    </div>
  );
}
