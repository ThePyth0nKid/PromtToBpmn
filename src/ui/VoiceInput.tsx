import React, { useEffect, useRef, useState } from 'react';

type Props = {
  onTranscript: (text: string) => void;
};

export default function VoiceInput({ onTranscript }: Props): JSX.Element {
  const [supported, setSupported] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const recognitionRef = useRef<any | null>(null);
  const transcriptRef = useRef<string>('');

  useEffect(() => {
    const SpeechRecognition: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'de-DE';
      rec.onresult = (event: any) => {
        let combined = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          combined += event.results[i][0].transcript;
        }
        transcriptRef.current = combined.trim();
        if (transcriptRef.current) onTranscript(transcriptRef.current);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
      setSupported(true);
    }
  }, [onTranscript]);

  const toggle = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      transcriptRef.current = '';
      try {
        rec.start();
        setListening(true);
      } catch (_) {
        // ignore double start
      }
    }
  };

  if (!supported) {
    return (
      <span className="text-xs text-muted" title="Web Speech API nicht verfügbar">
        Mikrofon nicht verfügbar
      </span>
    );
  }

  return (
    <button type="button" className={`btn ${listening ? 'btn-primary' : ''}`} onClick={toggle}>
      {listening ? 'Stop' : 'Aufnehmen'}
    </button>
  );
}
