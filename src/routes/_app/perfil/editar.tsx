import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/perfil/editar")({ component: EditarPerfil });

function EditarPerfil() {
  const { user, profile, refresh } = useAuth();
  const nav = useNavigate();
  const [nome, setNome] = useState(profile?.nome ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const initials = (nome || profile?.email || "U").slice(0, 2).toUpperCase();

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success("Foto carregada");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome, avatar_url: avatarUrl || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    toast.success("Perfil atualizado");
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
        <h1 className="text-2xl font-display font-black tracking-tight">Editar Perfil</h1>
      </div>

      <div className="flex flex-col items-center gap-4 py-4">
        <div className="relative group">
          <Avatar className="size-28 ring-4 ring-white/5 shadow-2xl overflow-hidden">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="avatar" className="object-cover" />}
            <AvatarFallback className="bg-white/10 text-white text-3xl font-black">
              {initials}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-1 right-1 bg-white text-black rounded-full p-2.5 shadow-xl transition-all hover:scale-110 active:scale-90"
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Camera className="size-5" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
          Toque na câmera para trocar a foto
        </p>
      </div>

      <Card className="glass rounded-[32px] p-6 space-y-5 border-white/5 shadow-xl">
        <div className="space-y-2">
          <Label htmlFor="nome" className="text-[10px] font-black uppercase tracking-widest ml-1">
            Nome de Exibição
          </Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="h-12 rounded-2xl bg-white/5 border-white/10 focus:ring-2 ring-white/10"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
            Email (não editável)
          </Label>
          <Input
            value={profile?.email ?? ""}
            disabled
            className="h-12 rounded-2xl bg-white/0 border-white/5 text-white/30"
          />
        </div>
      </Card>

      <Button
        className="w-full h-16 rounded-[28px] bg-white text-black hover:bg-zinc-200 font-black uppercase tracking-widest text-xs shadow-xl shadow-white/5 transition-all active:scale-95"
        onClick={save}
        disabled={saving}
      >
        {saving && <Loader2 className="size-4 animate-spin mr-2" />}Salvar Alterações
      </Button>
    </div>
  );
}
