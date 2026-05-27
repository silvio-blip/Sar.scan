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
import { isInstalledApp, dataURLtoFile } from "@/lib/utils";

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

    const name = file.name ? file.name.toLowerCase() : "";
    const mimeType = file.type ? file.type.toLowerCase() : "";
    const extMatch = name.match(/\.([a-z0-9]+)$/);
    const fileExt = extMatch ? extMatch[1] : "";

    const allowedExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

    const hasValidExtension = allowedExtensions.includes(fileExt);
    const hasValidMime =
      allowedMimeTypes.includes(mimeType) ||
      (mimeType.startsWith("image/") &&
        !mimeType.includes("svg") &&
        !mimeType.includes("html") &&
        !mimeType.includes("xml"));

    if (!hasValidExtension || !hasValidMime) {
      toast.error(
        "Por favor, envie um arquivo de imagem válido (PNG, JPEG, WEBP). Outros formatos não são permitidos.",
      );
      return;
    }

    setUploading(true);
    try {
      const path = `${user.id}/avatar-${Date.now()}.${fileExt}`;
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

  const handleAvatarPick = async () => {
    if (isInstalledApp()) {
      try {
        const {
          Camera: CapCamera,
          CameraResultType,
          CameraSource,
        } = await import("@capacitor/camera");
        try {
          const check = await CapCamera.checkPermissions();
          if (check.photos !== "granted") {
            await CapCamera.requestPermissions({ permissions: ["photos"] });
          }
        } catch (permErr) {
          console.warn("[Capacitor Permissions Error]", permErr);
        }

        const photo = await CapCamera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
        });

        if (photo.dataUrl && user) {
          setUploading(true);
          try {
            const file = await dataURLtoFile(photo.dataUrl, `avatar-${Date.now()}.jpg`);
            const path = `${user.id}/avatar-${Date.now()}.jpg`;
            const { error } = await supabase.storage
              .from("avatars")
              .upload(path, file, { upsert: true });
            if (error) throw error;
            const { data } = supabase.storage.from("avatars").getPublicUrl(path);
            setAvatarUrl(data.publicUrl);
            toast.success("Foto carregada");
          } catch (uploadErr) {
            console.error("Capacitor avatar upload error:", uploadErr);
            toast.error("Falha ao salvar avatar");
          } finally {
            setUploading(false);
          }
        } else if (photo.webPath && user) {
          setUploading(true);
          try {
            const response = await fetch(photo.webPath);
            const blob = await response.blob();
            const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
            const path = `${user.id}/avatar-${Date.now()}.jpg`;
            const { error } = await supabase.storage
              .from("avatars")
              .upload(path, file, { upsert: true });
            if (error) throw error;
            const { data } = supabase.storage.from("avatars").getPublicUrl(path);
            setAvatarUrl(data.publicUrl);
            toast.success("Foto carregada");
          } catch (uploadErr) {
            console.error("Capacitor avatar upload error by webPath:", uploadErr);
            toast.error("Falha ao salvar avatar");
          } finally {
            setUploading(false);
          }
        }
      } catch (err: any) {
        console.error("Capacitor avatar picker error:", err);
        if (
          err?.message !== "User cancelled photos app" &&
          err?.message?.indexOf("cancelled") === -1
        ) {
          fileRef.current?.click();
        }
      }
    } else {
      fileRef.current?.click();
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
          className="size-12 rounded-[18px] border border-border bg-card flex items-center justify-center hover:bg-secondary transition-all shadow-sm text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-display font-black tracking-tight text-foreground">
          Editar Perfil
        </h1>
      </div>

      <div className="flex flex-col items-center gap-4 py-4">
        <div className="relative group">
          <Avatar className="size-28 ring-4 ring-primary/20 bg-secondary shadow-md overflow-hidden">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="avatar" className="object-cover" />}
            <AvatarFallback className="bg-secondary text-primary text-3xl font-black">
              {initials}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={handleAvatarPick}
            className="absolute bottom-1 right-1 bg-primary text-primary-foreground rounded-full p-2.5 shadow-md transition-all hover:scale-110 active:scale-90 hover:bg-primary/95"
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
            className="sr-only absolute pointer-events-none w-0 h-0"
            onChange={onPickFile}
          />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Toque na câmera para trocar a foto
        </p>
      </div>

      <Card className="bg-card rounded-[32px] p-6 space-y-5 border border-border shadow-sm text-foreground">
        <div className="space-y-2">
          <Label
            htmlFor="nome"
            className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/80"
          >
            Nome de Exibição
          </Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="h-12 rounded-2xl bg-secondary/30 border border-border focus:ring-2 ring-primary/20 text-foreground font-semibold"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/80">
            Email (não editável)
          </Label>
          <Input
            value={profile?.email ?? ""}
            disabled
            className="h-12 rounded-2xl bg-secondary/10 border border-border/40 text-muted-foreground/50 font-medium"
          />
        </div>
      </Card>

      <Button
        className="w-full h-14 rounded-[24px] bg-primary text-primary-foreground hover:bg-primary/95 font-bold uppercase tracking-widest text-[10px] shadow-sm transition-all active:scale-95"
        onClick={save}
        disabled={saving}
      >
        {saving && <Loader2 className="size-4 animate-spin mr-2" />}Salvar Alterações
      </Button>
    </div>
  );
}
