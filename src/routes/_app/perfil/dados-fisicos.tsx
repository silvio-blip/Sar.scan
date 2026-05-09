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
          className="size-12 rounded-2xl glass flex items-center justify-center hover:bg-white/10 transition-all border-white/5 shadow-xl"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-display font-black tracking-tight">Dados Físicos</h1>
      </div>

      <Card className="glass rounded-[32px] p-6 space-y-5 border-white/5 shadow-xl">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
            Idade (anos)
          </Label>
          <Input
            type="number"
            value={idade}
            onChange={(e) => setIdade(+e.target.value)}
            className="h-12 rounded-2xl bg-white/5 border-white/10 focus:ring-2 ring-white/10"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Peso (kg)</Label>
          <Input
            type="number"
            value={peso}
            onChange={(e) => setPeso(+e.target.value)}
            className="h-12 rounded-2xl bg-white/5 border-white/10 focus:ring-2 ring-white/10"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
            Altura (cm)
          </Label>
          <Input
            type="number"
            value={altura}
            onChange={(e) => setAltura(+e.target.value)}
            className="h-12 rounded-2xl bg-white/5 border-white/10 focus:ring-2 ring-white/10"
          />
        </div>
      </Card>

      <Button
        className="w-full h-16 rounded-[28px] bg-white text-black hover:bg-zinc-200 font-black uppercase tracking-widest text-xs shadow-xl shadow-white/5 transition-all active:scale-95"
        onClick={save}
        disabled={saving}
      >
        {saving && <Loader2 className="size-4 animate-spin mr-2" />}Salvar
      </Button>
    </div>
  );
}
