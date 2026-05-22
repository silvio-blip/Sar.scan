import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/perfil/dados-fisicos")({ component: DadosPage });

function DadosPage() {
  const { user, profile, refresh } = useAuth();
  const nav = useNavigate();
  const [idade, setIdade] = useState<number>(profile?.idade ?? 28);
  const [peso, setPeso] = useState<number>(Number(profile?.peso ?? 70));
  const [altura, setAltura] = useState<number>(Number(profile?.altura ?? 170));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ idade, peso, altura })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    toast.success("Dados atualizados");
    nav({ to: "/perfil" });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex items-center gap-4">
        <Link
          to="/perfil"
          className="size-12 rounded-[18px] border border-border bg-card flex items-center justify-center hover:bg-secondary transition-all shadow-sm text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-display font-black tracking-tight text-foreground">Dados Físicos</h1>
      </div>

      <Card className="bg-card rounded-[32px] p-6 space-y-5 border border-border shadow-sm text-foreground">
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/90">
            Idade (anos)
          </Label>
          <Input
            type="number"
            value={idade}
            onChange={(e) => setIdade(+e.target.value)}
            className="h-12 rounded-2xl bg-secondary/30 border border-border focus:ring-2 ring-primary/20 text-foreground font-semibold"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/90">Peso (kg)</Label>
          <Input
            type="number"
            value={peso}
            onChange={(e) => setPeso(+e.target.value)}
            className="h-12 rounded-2xl bg-secondary/30 border border-border focus:ring-2 ring-primary/20 text-foreground font-semibold"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/90">
            Altura (cm)
          </Label>
          <Input
            type="number"
            value={altura}
            onChange={(e) => setAltura(+e.target.value)}
            className="h-12 rounded-2xl bg-secondary/30 border border-border focus:ring-2 ring-primary/20 text-foreground font-semibold"
          />
        </div>
      </Card>

      <Button
        className="w-full h-14 rounded-[24px] bg-primary text-primary-foreground hover:bg-primary/95 font-bold uppercase tracking-widest text-[10px] shadow-sm transition-all active:scale-95"
        onClick={save}
        disabled={saving}
      >
        {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : "Salvar Alterações"}
      </Button>
    </div>
  );
}
