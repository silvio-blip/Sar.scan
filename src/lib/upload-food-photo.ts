import { supabase } from "@/integrations/supabase/client";

const MAX_DIM = 1024;
const QUALITY = 0.85;

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const ratio = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", QUALITY);
  });
}

export async function uploadFoodPhoto(
  file: File,
  userId: string,
  prefix: "manual" | "edit" = "manual",
): Promise<string> {
  const blob = await compressImage(file);
  const path = `${userId}/${prefix}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("scan-photos")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("scan-photos").getPublicUrl(path);
  return data.publicUrl;
}
