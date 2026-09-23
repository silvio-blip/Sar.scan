import { randomUUID } from "crypto";
import { generateContentWithOptimalModel } from "./gemini-client.server.js";
import { supabaseAdmin } from "../integrations/supabase/client.server.js";
import { checkEligibility, deductScan } from "./edge-proxy.server.js";

export type QueueJobType = "food_scan" | "calibrate_hand";
export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface QueueJob {
  id: string;
  type: QueueJobType;
  userId?: string | null;
  payload: any;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  result?: any;
  error?: string | null;
}

class ScanQueueManager {
  private queue: QueueJob[] = [];
  private activeJobsCount = 0;
  private readonly maxConcurrent = 1; // 1 job por vez garante respeito estrito à cota Free Tier do Gemini
  private resultsCache = new Map<string, QueueJob>();

  constructor() {
    // Limpeza periódica de resultados antigos (após 15 minutos)
    setInterval(() => {
      const now = Date.now();
      for (const [id, job] of this.resultsCache.entries()) {
        if (job.finishedAt && now - job.finishedAt > 15 * 60 * 1000) {
          this.resultsCache.delete(id);
        }
      }
    }, 60 * 1000);
  }

  public enqueue(
    type: QueueJobType,
    payload: any,
    userId?: string | null,
  ): { jobId: string; position: number; totalInQueue: number } {
    const job: QueueJob = {
      id: randomUUID(),
      type,
      userId: userId || null,
      payload,
      status: "queued",
      createdAt: Date.now(),
    };

    this.queue.push(job);
    this.resultsCache.set(job.id, job);

    console.log(
      `[Queue] Novo job adicionado (${job.id}, tipo: ${type}). Tamanho atual da fila: ${this.queue.length}`,
    );

    // Dispara processamento assíncrono
    this.processNext();

    const position = this.getJobPosition(job.id);
    return {
      jobId: job.id,
      position,
      totalInQueue: this.queue.length,
    };
  }

  public getJobStatus(jobId: string): {
    jobId: string;
    status: JobStatus;
    position: number;
    totalInQueue: number;
    result?: any;
    error?: string | null;
    estimatedWaitSeconds: number;
  } | null {
    const job = this.resultsCache.get(jobId);
    if (!job) return null;

    const position = this.getJobPosition(jobId);
    const totalInQueue = this.queue.length;
    // Estimativa de ~3 segundos por pessoa na frente
    const estimatedWaitSeconds = position > 0 ? (position - 1) * 3 + 2 : 0;

    return {
      jobId: job.id,
      status: job.status,
      position,
      totalInQueue,
      result: job.result,
      error: job.error,
      estimatedWaitSeconds,
    };
  }

  public getOverview(): { totalInQueue: number; activeJobs: number } {
    return {
      totalInQueue: this.queue.length,
      activeJobs: this.activeJobsCount,
    };
  }

  private getJobPosition(jobId: string): number {
    const idx = this.queue.findIndex((j) => j.id === jobId);
    if (idx === -1) return 0; // Já saiu da fila / está concluído ou processando
    return idx + 1;
  }

  private async processNext() {
    if (this.activeJobsCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.activeJobsCount++;
    job.status = "processing";
    job.startedAt = Date.now();

    console.log(`[Queue] Iniciando processamento do job ${job.id} (tipo: ${job.type})...`);

    try {
      if (job.type === "food_scan") {
        job.result = await this.executeFoodScan(job.payload, job.userId);
      } else if (job.type === "calibrate_hand") {
        job.result = await this.executeCalibrateHand(job.payload);
      }
      job.status = "completed";
      console.log(`[Queue] Job ${job.id} finalizado com sucesso.`);
    } catch (err: any) {
      console.error(`[Queue] Erro ao processar job ${job.id}:`, err);
      job.status = "failed";
      job.error = err?.message || "Erro durante o processamento da imagem.";
    } finally {
      job.finishedAt = Date.now();
      this.activeJobsCount--;
      // Processa o próximo job da fila
      setTimeout(() => this.processNext(), 100);
    }
  }

  private async executeFoodScan(payload: any, userId?: string | null) {
    const {
      base64Data: rawBase64Data,
      deduct_on_fail: deductOnFail,
      hand_calibration: handCalibration,
    } = payload || {};

    let eligibility: any = null;
    if (userId) {
      eligibility = await checkEligibility(userId).catch(() => null);
    }

    const parts = (rawBase64Data || "").split(",");
    const base64Data = parts.length > 1 ? parts[1] : parts[0];
    const mimeTypeMatch = parts.length > 1 ? parts[0].match(/:(.*?);/) : null;
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

    let userProfileContext = "";
    if (userId && supabaseAdmin) {
      try {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (profile) {
          userProfileContext = `
Dados e Perfil do Utilizador:
- Objetivo principal: ${profile.objetivo || "manter"} (opções: perder gordura, manter, ganhar massa)
- Peso atual: ${profile.peso || "não informado"} kg
- Altura: ${profile.altura || "não informado"} cm
- Meta de peso: ${profile.meta_peso || "não informado"} kg
- Calorias diárias alvo: ${profile.calorias_meta || "não informado"} kcal
`;
        }
      } catch (e) {
        console.warn("[Queue] Falha ao buscar perfil:", e);
      }
    }

    let handCalibrationInstruction = "";
    if (handCalibration && Number(handCalibration.comprimento_cm) > 0) {
      handCalibrationInstruction = `
INSTRUÇÃO ESPECIAL DE ALTA PRECISÃO MÉTRICA COM MÃO BIOMÉTRICA:
O utilizador possui uma calibração biométrica da sua mão VALIDADA E REGISTRADA no sistema:
- Comprimento da mão do utilizador (do pulso até a ponta do dedo médio): ${handCalibration.comprimento_cm} cm
- Largura da palma do utilizador (transversal): ${handCalibration.largura_palma_cm || 8.0} cm
- Objeto de referência utilizado na calibração: ${handCalibration.objeto_referencia || "cartão"}

DIRETRIZ DE VISÃO ESPACIAL 3D:
Verifique atentamente se a mão humana do utilizador está visível na imagem (ao lado do prato, segurando o prato/recipiente ou próxima aos alimentos).
- Se a mão ESTIVER VISÍVEL: Use as medidas anatômicas calibradas acima como régua biométrica de escala real no espaço 3D para calcular o diâmetro, altura, volume em cm³ e o peso exato em gramas dos alimentos com máxima precisão. No campo "calibrado_por_mao", retorne true.
- Se a mão NÃO estiver visível: Estime as porções visualmente pelo tamanho do prato ou recipientes convencionais e defina "calibrado_por_mao": false.
`;
    } else {
      handCalibrationInstruction = `
INSTRUÇÃO IMPORTANTE DE ESCALA:
O utilizador NÃO POSSUI calibração biométrica de mão registrada no sistema.
REGRA ABSOLUTA: Caso qualquer mão humana apareça na foto (segurando o prato, talher ou descansando na mesa), IGNORE-A TOTALMENTE para fins de calibração métrica e NÃO tente deduzir medidas anatômicas da mão. Calcule as porções e gramas exclusivamente com base no tamanho convencional do prato, taça, talher ou embalagem. No campo "calibrado_por_mao", você DEVE OBRIGATORIAMENTE retornar false.
`;
    }

    const promptText = `Analisa esta imagem de comida no contexto do perfil e objetivos do utilizador.
${userProfileContext}
${handCalibrationInstruction}

IMPORTANTE: Se a imagem NÃO contiver alimentos ou refeições visíveis (por exemplo, se for apenas uma pessoa, vestuário/calças, o chão, teto, objetos aleatórios, paisagens, ou uma imagem preta/ilegível), você DEVE obrigatoriamente retornar a lista de "itens" totalmente vazia: "itens": []. Nunca crie itens fictícios para indicar a ausência de comida (como "Nenhum alimento visível", "Sem alimentos" ou similares). No "feedback_meta", explique de forma amigável em português (PT) que nenhum alimento foi detectado na imagem e peça para enviar uma foto clara da refeição.

Retorna UM OBJETO JSON ESTRITAMENTE, sem texto extra, markdown ou explicações fora do JSON.
O formato deve ser exatamente:
{
  "itens": [
    { 
      "nome": "string",
      "quantidade": "string (ex: 100g, 1 unidade)",
      "cal": number, 
      "carb": number, 
      "prot": number, 
      "gord": number 
    }
  ],
  "calibrado_por_mao": boolean,
  "feedback_meta": "string breve, direta e encorajadora em português (PT) explicando ao utilizador como este alimento impacta a sua meta específica (seja perder gordura, manter ou ganhar massa), indicando se o aproxima ou afasta da meta, balanço calórico/nutricional e uma recomendação prática."
}`;

    const { response: aiResponse, modelUsed } = await generateContentWithOptimalModel({
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      maxOutputTokens: 2048,
    });

    console.log(`[Queue executeFoodScan] Sucesso com modelo ${modelUsed}`);
    const textoFinal = aiResponse.text || "";

    let hasFoods = false;
    try {
      const cleanJson = textoFinal.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      const list = parsed?.itens || parsed?.items || [];
      const realFoods = list.filter((item: any) => {
        if (!item || !item.nome) return false;
        const name = String(item.nome).toLowerCase();
        return !(
          name.includes("nenhum") ||
          name.includes("não detectado") ||
          name.includes("nao detectado") ||
          name.includes("no food") ||
          name.includes("not detected") ||
          name.includes("sem alimento") ||
          name.includes("invisível") ||
          name.includes("invisivel") ||
          name.includes("ausência") ||
          name.includes("ausencia")
        );
      });
      if (Array.isArray(realFoods) && realFoods.length > 0) {
        hasFoods = true;
      }
    } catch (e) {
      console.warn("[Queue] JSON parse warn:", e);
    }

    if (userId && eligibility) {
      if (hasFoods || deductOnFail) {
        await deductScan(userId, eligibility).catch((err) => {
          console.warn("[Queue] Falha ao debitar scan:", err);
        });
      }
    }

    return { result: textoFinal };
  }

  private async executeCalibrateHand(payload: any) {
    const { base64Data: rawBase64Data, reference_type: referenceType = "card" } = payload || {};

    if (!rawBase64Data) {
      throw new Error("Imagem não fornecida para calibração.");
    }

    const parts = (rawBase64Data || "").split(",");
    const base64Data = parts.length > 1 ? parts[1] : parts[0];
    const mimeTypeMatch = parts.length > 1 ? parts[0].match(/:(.*?);/) : null;
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

    const promptCalib = `Você é um sistema especialista em visão computacional biométrica, medição óptica e calibração espacial de alta precisão.
O utilizador capturou uma foto de sua mão aberta/espalmada sobre uma superfície plana ao lado de um objeto de referência do tipo: "${referenceType}".

Dimensões físicas padronizadas dos objetos de referência:
- "card": Cartão Plástico Padrão ISO (Crédito, Débito, ID, Cidadão) -> Largura exata = 85.60 mm (8.56 cm), Altura = 53.98 mm (5.40 cm).
- "coin_2eur": Moeda de 2 Euros -> Diâmetro exato = 25.75 mm (2.575 cm).
- "coin_1real": Moeda de 1 Real Brasileiro -> Diâmetro exato = 27.00 mm (2.70 cm).
- "coin_1eur": Moeda de 1 Euro -> Diâmetro exato = 23.25 mm (2.325 cm).
- "bottle_cap": Tampa de garrafa PET padrão -> Diâmetro = 28.00 mm (2.80 cm).
- "ruler": Régua ou fita métrica com graduação em centímetros/milímetros.

INSTRUÇÕES DE ANÁLISE:
1. Detecte o objeto de referência na imagem e meça seus pixels de largura/diâmetro para definir a relação Pixels por Milímetro (PPM).
2. Detecte a mão humana aberta do usuário posicionada no mesmo plano focal.
3. Meça com precisão biométrica em centímetros (com uma casa decimal):
   - "comprimento_cm": Distância linear do início do pulso (vinco da base da mão) até o ápice da ponta do dedo médio (geralmente entre 15.5 cm e 22.0 cm para adultos).
   - "largura_palma_cm": Largura transversal da palma medida na base dos nós dos dedos (geralmente entre 6.8 cm e 9.8 cm).
   - "largura_indicador_cm": Largura média do dedo indicador (geralmente entre 1.6 cm e 2.3 cm).
4. Verifique a coerência anatômica da mão humana.
5. Calcule um índice de confiança da detecção (0 a 100%).

Retorne ESTRITAMENTE um objeto JSON no seguinte formato (sem blocos de código markdown desnecessários):
{
  "sucesso": true,
  "comprimento_cm": 18.5,
  "largura_palma_cm": 8.2,
  "largura_indicador_cm": 1.9,
  "objeto_detectado": "Cartão Bancário",
  "confianca_percentual": 96,
  "mensagem": "Calibração concluída com altíssima precisão! A sua mão mede 18.5 cm de comprimento e 8.2 cm de largura.",
  "dicas": [
    "Ao escanear um prato de comida, posicione sua mão aberta ao lado do prato para que a IA use a sua escala real.",
    "Mantenha a câmera paralela ao prato (ângulo superior) para garantir máxima precisão das gramas."
  ]
}

Se a mão ou o objeto não puderem ser identificados com segurança, faltar algum elemento ou a imagem estiver inadequada, retorne ESTRITAMENTE:
{
  "sucesso": false,
  "motivo_falha": "objeto_ausente" | "mao_ausente" | "imagem_escura" | "mao_fechada" | "objeto_errado" | "distancia_incorreta" | "outro",
  "titulo_erro": "Título curto e claro em português (ex: 'Cartão não encontrado na imagem', 'Mão fora do enquadramento', 'Imagem muito escura ou borrada')",
  "erro": "Explicação detalhada e amigável em português (PT) sobre exatamente o que impediu a verificação da mão (ex: 'Não encontramos o cartão de referência ao lado da sua mão', 'A mão precisa estar aberta sobre a mesa para calcularmos os dedos', etc.)",
  "dica_correcao": "Orientação prática e direta de como posicionar a mão e o objeto na próxima foto para dar certo."
}`;

    const { response: aiResponse, modelUsed } = await generateContentWithOptimalModel({
      contents: [
        {
          role: "user",
          parts: [
            { text: promptCalib },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      maxOutputTokens: 1024,
    });

    console.log(`[Queue executeCalibrateHand] Sucesso com modelo ${modelUsed}`);
    const responseText = aiResponse.text || "";
    const cleanJson = responseText.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleanJson);
  }
}

export const scanQueue = new ScanQueueManager();
