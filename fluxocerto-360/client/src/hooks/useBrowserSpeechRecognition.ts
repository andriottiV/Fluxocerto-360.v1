import { useCallback, useMemo, useRef, useState } from "react";

type RecognitionEventLike = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type RecognitionErrorEventLike = {
  error?: string;
};

type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => RecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const maybeCtor = (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor });
  return maybeCtor.SpeechRecognition ?? maybeCtor.webkitSpeechRecognition ?? null;
}

export function useBrowserSpeechRecognition(language = "pt-BR") {
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const supported = useMemo(() => getSpeechRecognitionCtor() !== null, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setError("Reconhecimento de voz nao suportado neste navegador.");
      return;
    }

    setError(null);
    setTranscript("");

    const recognition = new RecognitionCtor();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const raw = event.results?.[0]?.[0]?.transcript ?? "";
      setTranscript(raw.trim());
    };

    recognition.onerror = (event) => {
      const code = event.error ?? "unknown";
      if (code === "not-allowed") {
        setError("Permita o uso do microfone para registrar por voz.");
      } else if (code === "no-speech") {
        setError("Nenhuma fala detectada.");
      } else {
        setError("Falha ao capturar audio. Tente novamente.");
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [language]);

  return {
    supported,
    listening,
    transcript,
    error,
    start,
    stop,
  };
}
