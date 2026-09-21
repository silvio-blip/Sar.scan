import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { isInstalledApp } from "./utils";

export async function speakText(text: string, onEnd?: () => void): Promise<() => void> {
  if (!text) return () => {};

  if (isInstalledApp()) {
    try {
      await TextToSpeech.speak({
        text,
        lang: "pt-BR",
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
      });
      if (onEnd) onEnd();
      return async () => {
        try {
          await TextToSpeech.stop();
        } catch {
          // ignore stop failure
        }
      };
    } catch (e) {
      console.warn("Native TTS error, falling back to Web Speech:", e);
    }
  }

  // Web Speech fallback
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
      if (onEnd) onEnd();
    };
  }

  if (onEnd) onEnd();
  return () => {};
}

export async function stopSpeech() {
  if (isInstalledApp()) {
    try {
      await TextToSpeech.stop();
    } catch {
      // ignore stop failure
    }
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
