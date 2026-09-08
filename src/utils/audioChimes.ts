/**
 * Web Audio API Chime Synthesizer for OPD Queue & Patient Call Announcements
 * Provides 8 distinct synthesized audio sound options without needing external MP3 assets.
 */

export type ChimeType = "bell" | "ding-dong" | "synth" | "elevator" | "gong" | "beep" | "marimba" | "mute";

export const CHIME_OPTIONS: { id: ChimeType; label: string; icon: string }[] = [
  { id: "bell", label: "Classic Reception Bell", icon: "🔔" },
  { id: "ding-dong", label: "Hospital Ding-Dong", icon: "🏨" },
  { id: "synth", label: "Soft Digital Synth Chime", icon: "✨" },
  { id: "elevator", label: "Elevator Arrival Tone", icon: "🛗" },
  { id: "gong", label: "Gentle Brass Gong", icon: "📯" },
  { id: "beep", label: "Modern High-Beep", icon: "⚡" },
  { id: "marimba", label: "Marimba Double Strike", icon: "🎵" },
  { id: "mute", label: "Mute / Silent Mode", icon: "🔇" },
];

export function playChimeSound(type: ChimeType = "bell") {
  if (type === "mute" || typeof window === "undefined") return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    switch (type) {
      case "bell": {
        // High metallic bell chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.2);
        break;
      }

      case "ding-dong": {
        // Hospital 2-tone chime (High then Low)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(659.25, now); // E5
        gain1.gain.setValueAtTime(0.5, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.8);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(523.25, now + 0.35); // C5
        gain2.gain.setValueAtTime(0.6, now + 0.35);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.35);
        osc2.stop(now + 1.4);
        break;
      }

      case "synth": {
        // Soft tri-chord synth
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.3, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 1.0);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 1.0);
        });
        break;
      }

      case "elevator": {
        // Dual harmonic elevator ding
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(587.33, now); // D5
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.5);
        break;
      }

      case "gong": {
        // Warm resonant brass gong
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(261.63, now); // C4
        osc.frequency.exponentialRampToValueAtTime(130.81, now + 1.8);
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 2.0);
        break;
      }

      case "beep": {
        // Double electronic beep
        [880, 880].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(freq, now + idx * 0.18);
          gain.gain.setValueAtTime(0.15, now + idx * 0.18);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.18);
          osc.stop(now + idx * 0.18 + 0.12);
        });
        break;
      }

      case "marimba": {
        // Percussive marimba strike
        [440, 659.25].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.15);
          gain.gain.setValueAtTime(0.6, now + idx * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.15);
          osc.stop(now + idx * 0.15 + 0.5);
        });
        break;
      }
    }
  } catch (e) {
    console.warn("Audio chime playback error:", e);
  }
}

export type VoiceAnnounceLanguage = "off" | "en" | "hi" | "both";

export interface AnnouncePatientOptions {
  tokenNumber: number;
  doctorName?: string;
  cabinName?: string;
  language?: VoiceAnnounceLanguage;
  chimeType?: ChimeType;
}

/**
 * Multi-lingual Web Speech Synthesizer for Doorway & Waiting Room Token Summons
 * Plays chime sound followed by spoken announcement in English, Hindi, or Both.
 */
export function announcePatientToken({
  tokenNumber,
  doctorName,
  cabinName,
  language = "en",
  chimeType = "ding-dong",
}: AnnouncePatientOptions) {
  if (language === "off" || typeof window === "undefined") return;

  // 1. Play audio chime first
  if (chimeType !== "mute") {
    playChimeSound(chimeType);
  }

  // 2. Synthesize voice speech via Web Speech API after slight delay for chime to ring
  if (!("speechSynthesis" in window)) return;

  setTimeout(() => {
    try {
      window.speechSynthesis.cancel(); // Cancel any lingering speech

      const room = cabinName || (doctorName ? `Cabin Dr. ${doctorName.replace(/^Dr\.\s*/i, "")}` : "Doctor Cabin");
      const utterances: SpeechSynthesisUtterance[] = [];

      if (language === "en" || language === "both") {
        const textEn = `Token Number ${tokenNumber}. Please proceed to ${room}.`;
        const utterEn = new SpeechSynthesisUtterance(textEn);
        utterEn.lang = "en-IN";
        utterEn.rate = 0.95;
        utterEn.pitch = 1.0;
        utterances.push(utterEn);
      }

      if (language === "hi" || language === "both") {
        const roomHi = cabinName ? `${cabinName}` : (doctorName ? `डॉक्टर ${doctorName.replace(/^Dr\.\s*/i, "")} के केबिन` : "डॉक्टर केबिन");
        const textHi = `टोकन नंबर ${tokenNumber}. कृपया ${roomHi} में आइए.`;
        const utterHi = new SpeechSynthesisUtterance(textHi);
        utterHi.lang = "hi-IN";
        utterHi.rate = 0.95;
        utterHi.pitch = 1.0;
        utterances.push(utterHi);
      }

      utterances.forEach((u) => window.speechSynthesis.speak(u));
    } catch (err) {
      console.warn("Speech synthesis error:", err);
    }
  }, 450);
}
