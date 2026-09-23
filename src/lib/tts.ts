import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { isInstalledApp } from "./utils";

type SpeechCallback = () => void;

let activeUtterance: SpeechSynthesisUtterance | null = null;
let currentOnEndCallback: SpeechCallback | null = null;
let isCurrentlySpeaking = false;
let preferredPortugueseVoice: SpeechSynthesisVoice | null = null;

/**
 * Inicializa e seleciona a melhor voz em Português disponível no dispositivo
 */
function initVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const updateVoice = () => {
    try {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      // Prioriza vozes em Português (pt-PT ou pt-BR) de alta qualidade nativas do sistema
      const ptPtVoice = voices.find(
        (v) =>
          v.lang === "pt-PT" ||
          v.lang.startsWith("pt-PT") ||
          v.lang.toLowerCase().includes("portugal"),
      );
      const ptBrVoice = voices.find(
        (v) =>
          v.lang === "pt-BR" ||
          v.lang.startsWith("pt-BR") ||
          v.lang.toLowerCase().includes("brazil"),
      );
      const anyPtVoice = voices.find((v) => v.lang.toLowerCase().startsWith("pt"));

      preferredPortugueseVoice = ptPtVoice || ptBrVoice || anyPtVoice || null;
    } catch {
      // Ignore voice query errors
    }
  };

  updateVoice();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = updateVoice;
  }
}

if (typeof window !== "undefined") {
  initVoices();
}

/**
 * Encerra imediatamente qualquer reprodução de áudio/fala e reseta todos os estados
 */
export async function stopSpeech() {
  isCurrentlySpeaking = false;
  currentOnEndCallback = null;

  // 1. Parar TTS nativo no Capacitor (APK)
  if (isInstalledApp()) {
    try {
      await TextToSpeech.stop();
    } catch {
      // ignore
    }
  }

  // 2. Parar Web Speech API no Navegador
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      if (activeUtterance) {
        activeUtterance.onend = null;
        activeUtterance.onerror = null;
        activeUtterance = null;
      }
      window.speechSynthesis.cancel();
      // Destravar o motor de fala caso estivesse em pausa ou travado
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Fala o texto em Português com garantia de interrupção instantânea e sem loops/reinícios
 */
export async function speakText(text: string, onEnd?: SpeechCallback): Promise<() => void> {
  // Sempre encerra qualquer áudio anterior antes de iniciar novo
  await stopSpeech();

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    if (onEnd) onEnd();
    return () => {};
  }

  const cleanText = text
    .replace(/[#*`_~]/g, "") // Limpa formatação Markdown
    .replace(/\s+/g, " ")
    .trim();

  isCurrentlySpeaking = true;
  currentOnEndCallback = onEnd || null;

  const notifyEnd = () => {
    if (!isCurrentlySpeaking) return;
    isCurrentlySpeaking = false;
    const cb = currentOnEndCallback;
    currentOnEndCallback = null;
    activeUtterance = null;
    if (cb) {
      try {
        cb();
      } catch (e) {
        console.warn("[TTS] Error in onEnd callback:", e);
      }
    }
  };

  // Se estiver no APK nativo instalado (Capacitor)
  if (isInstalledApp()) {
    try {
      // Não aguardamos o speak com bloqueio de promise para não travar a UI
      TextToSpeech.speak({
        text: cleanText,
        lang: "pt-PT",
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: "ambient",
      })
        .then(() => {
          notifyEnd();
        })
        .catch((err) => {
          console.warn("[Native TTS] Error:", err);
          notifyEnd();
        });

      return () => {
        stopSpeech();
      };
    } catch (e) {
      console.warn("Native TTS failed, falling back to Web Speech:", e);
    }
  }

  // Web Speech API (Navegador)
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      activeUtterance = utterance;

      if (!preferredPortugueseVoice) {
        initVoices();
      }

      if (preferredPortugueseVoice) {
        utterance.voice = preferredPortugueseVoice;
        utterance.lang = preferredPortugueseVoice.lang;
      } else {
        utterance.lang = "pt-PT";
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        notifyEnd();
      };

      utterance.onerror = (event) => {
        // Se foi cancelado manualmente por stopSpeech, ignora
        if (event.error === "canceled" || event.error === "interrupted") {
          return;
        }
        notifyEnd();
      };

      window.speechSynthesis.speak(utterance);

      return () => {
        stopSpeech();
      };
    } catch (err) {
      console.warn("[Web Speech] Error:", err);
      notifyEnd();
      return () => {};
    }
  }

  notifyEnd();
  return () => {};
}

/**
 * Retorna se o áudio está sendo falado no momento
 */
export function isSpeaking(): boolean {
  return isCurrentlySpeaking;
}
