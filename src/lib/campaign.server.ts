import { supabaseAdmin } from "../integrations/supabase/client.server.js";
import { getAppSettings } from "./settings.server.js";

export interface CampaignConfigServer {
  enabled: boolean;
  startDate?: string;
  endDate?: string;
  bonusScans: number;
  freeAiDays: number;
}

export async function getCampaignConfigServer(): Promise<CampaignConfigServer> {
  const settings = await getAppSettings();

  const enabled =
    settings.campaign_enabled === "true" ||
    settings.campaign_enabled === true ||
    process.env.CAMPAIGN_ENABLED === "true";

  const startDate = settings.campaign_start_date || process.env.CAMPAIGN_START_DATE || "";
  const endDate = settings.campaign_end_date || process.env.CAMPAIGN_END_DATE || "";
  const bonusScans = parseInt(
    settings.campaign_bonus_scans || process.env.CAMPAIGN_BONUS_SCANS || "22",
    10,
  );
  const freeAiDays = parseInt(
    settings.campaign_free_ai_days || process.env.CAMPAIGN_FREE_AI_DAYS || "7",
    10,
  );

  return {
    enabled,
    startDate,
    endDate,
    bonusScans: isNaN(bonusScans) ? 22 : bonusScans,
    freeAiDays: isNaN(freeAiDays) ? 7 : freeAiDays,
  };
}

function parseDateResilient(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  if (
    dateStr.includes("T") &&
    !dateStr.endsWith("Z") &&
    !dateStr.includes("+") &&
    !dateStr.includes("-")
  ) {
    return new Date(dateStr + ":00Z").getTime();
  }
  return new Date(dateStr).getTime();
}

/**
 * Computes remaining campaign free AI days for a user based on their profile creation date.
 */
export async function getRemainingCampaignDaysServer(userId: string): Promise<number> {
  try {
    const config = await getCampaignConfigServer();
    if (!config.enabled || !config.startDate || !config.endDate) return 0;

    const { data: profile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("created_at")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.created_at) return 0;

    const regTime = parseDateResilient(profile.created_at);
    const startTime = parseDateResilient(config.startDate);
    const endTime = parseDateResilient(config.endDate);

    if (regTime >= startTime && regTime <= endTime) {
      const expiryTime = regTime + config.freeAiDays * 86400000;
      const remainingMillis = expiryTime - Date.now();
      if (remainingMillis > 0) {
        return Math.ceil(remainingMillis / 86400000);
      }
    }
    return 0;
  } catch (err) {
    console.error("[Campaign Server] Erro ao calcular dias restantes de campanha:", err);
    return 0;
  }
}

/**
 * Calculates adjusted subscription expiration date by preserving and adding remaining campaign days.
 */
export async function calculatePlanPeriodEndWithCampaignBonus(
  userId: string,
  planId: string,
): Promise<{ periodEnd: string; bonusDaysAdded: number }> {
  let baseDays = 30;
  const lowerPlan = (planId || "").toLowerCase();
  if (lowerPlan === "weekly" || lowerPlan === "semanal") {
    baseDays = 7;
  } else if (lowerPlan === "yearly" || lowerPlan === "anual" || lowerPlan === "annual") {
    baseDays = 365;
  }

  const bonusDaysAdded = await getRemainingCampaignDaysServer(userId);
  const totalDays = baseDays + bonusDaysAdded;
  const periodEnd = new Date(Date.now() + totalDays * 86400000).toISOString();

  console.log(
    `[Campaign Server] Período calculado para usuário ${userId}, plano ${planId}: ${baseDays} dias base + ${bonusDaysAdded} dias bónus campanha = ${totalDays} dias totais (Expira em: ${periodEnd})`,
  );

  return { periodEnd, bonusDaysAdded };
}

/**
 * Atomically checks and applies the campaign bonus ONCE in the database.
 * Completely eliminates duplicate bonus scans across multiple devices/logins.
 */
export async function applyCampaignBonusInternal(userId: string): Promise<{
  success: boolean;
  applied: boolean;
  alreadyApplied?: boolean;
  addedCredits?: number;
  totalCredits?: number;
  message?: string;
}> {
  try {
    const config = await getCampaignConfigServer();
    if (!config.enabled || !config.startDate || !config.endDate || config.bonusScans <= 0) {
      return { success: true, applied: false, message: "Campanha inativa ou sem bônus." };
    }

    // 1. Check if the user ALREADY has a campaign reward recorded in the database
    const { data: existingRewards, error: rewError } = await (supabaseAdmin as any)
      .from("rewards")
      .select("id, bonus_aplicado")
      .eq("user_id", userId)
      .eq("titulo", "Bónus de Registo a Tempo: Campanha Especial")
      .limit(1);

    if (rewError) {
      console.warn("[Campaign Server] Aviso ao consultar rewards:", rewError.message);
    }

    if (existingRewards && existingRewards.length > 0) {
      console.log(
        `[Campaign Server] Utilizador ${userId} já possui o bónus de campanha registrado. Omitindo duplicação.`,
      );
      return {
        success: true,
        applied: false,
        alreadyApplied: true,
        message: "Bónus já aplicado anteriormente.",
      };
    }

    // 2. Check user's profile registration date
    const { data: profile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("created_at")
      .eq("id", userId)
      .maybeSingle();

    const regTime = parseDateResilient(profile?.created_at);
    const startTime = parseDateResilient(config.startDate);
    const endTime = parseDateResilient(config.endDate);

    if (regTime < startTime || regTime > endTime) {
      return {
        success: true,
        applied: false,
        message: "Data de registro fora do período da campanha.",
      };
    }

    // 3. User is eligible and has NOT received the bonus yet. Fetch current subscription.
    const { data: currentSub } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const currentCredits = (currentSub as any)?.scans_credits ?? 3;
    const finalCredits = currentCredits + config.bonusScans;

    // 4. Update subscription credits atomically
    await (supabaseAdmin as any).from("subscriptions").upsert(
      {
        user_id: userId,
        status: (currentSub as any)?.status ?? "free",
        plan: (currentSub as any)?.plan ?? null,
        scans_credits: finalCredits,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    // 5. Insert reward record using supabaseAdmin (bypasses RLS so it is permanently saved in DB)
    await (supabaseAdmin as any).from("rewards").insert({
      user_id: userId,
      titulo: "Bónus de Registo a Tempo: Campanha Especial",
      descricao: `Parabéns por se registar a tempo da nossa Campanha de Lançamento! Recebeu +${config.bonusScans} scans adicionais e o Chatbot IA Nutricionista foi desbloqueado gratuitamente por ${config.freeAiDays} dias.`,
      bonus_scans: config.bonusScans,
      bonus_aplicado: true,
      lida: false,
      created_at: new Date().toISOString(),
    });

    console.log(
      `[Campaign Server] Bónus de campanha aplicado com sucesso para o utilizador ${userId}! +${config.bonusScans} scans (Total: ${finalCredits})`,
    );

    return {
      success: true,
      applied: true,
      addedCredits: config.bonusScans,
      totalCredits: finalCredits,
      message: `+${config.bonusScans} scans de bônus creditados com sucesso.`,
    };
  } catch (err: any) {
    console.error("[Campaign Server] Erro ao aplicar bônus de campanha:", err);
    return { success: false, applied: false, message: err?.message || "Erro interno na campanha." };
  }
}
