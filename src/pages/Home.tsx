import React, { useCallback, useRef, useState } from 'react';
import PromptPanel from '../ui/PromptPanel';
import BpmnCanvas, { BpmnCanvasHandle } from '../ui/BpmnCanvas';
import { llmMode, textToProcessJson, type LlmDiag } from '../services/llm';
import { jsonToBpmnXml } from '../services/bpmn';
import { validateProcess } from '../services/validate';

export default function Home(): JSX.Element {
  const [prompt, setPrompt] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [xml, setXml] = useState<string>('');
  const [diag, setDiag] = useState<LlmDiag | null>(null);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const canvasRef = useRef<BpmnCanvasHandle>(null);

  const onGenerate = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    setDiag(null);
    try {
      const json = await textToProcessJson(prompt, undefined, (d) => setDiag(d));
      const validation = validateProcess(json);
      if (validation.length > 0) {
        setErrors(validation);
        return;
      }
      const laidOut = jsonToBpmnXml(json);
      setXml(laidOut);
      await canvasRef.current?.importXml(laidOut);
      await canvasRef.current?.zoomToFit();
    } catch (e: any) {
      setErrors([e?.message ?? 'Unbekannter Fehler beim Generieren']);
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  const onImprove = useCallback(async () => {
    if (!xml) return;
    setLoading(true);
    setDiag(null);
    try {
      const json = await textToProcessJson(prompt, errors, (d) => setDiag(d));
      const validation = validateProcess(json);
      if (validation.length > 0) {
        setErrors(validation);
        return;
      }
      const laidOut = jsonToBpmnXml(json);
      setXml(laidOut);
      await canvasRef.current?.importXml(laidOut);
      await canvasRef.current?.zoomToFit();
    } catch (e: any) {
      setErrors([e?.message ?? 'Unbekannter Fehler beim Verbessern']);
    } finally {
      setLoading(false);
    }
  }, [prompt, errors, xml]);

  const toggleTheme = useCallback(() => {
    document.documentElement.classList.toggle('dark');
  }, []);

  const mode = llmMode();

  return (
    <div className="h-full flex flex-col">
      <header className="navbar">
        <div className="container flex items-center justify-between h-full">
          <div className="flex items-center gap-3">
            <div className="font-semibold">Prompt → BPMN</div>
            <span className="text-xs text-muted">LLM: {mode.provider}{mode.usingMock ? ' (mock)' : ''}</span>
            {diag && (
              <span className={`run-badge ${diag.ok ? 'success' : 'failure'}`}>{diag.ok ? 'LLM OK' : 'LLM ERR'}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => setMenuOpen((v) => !v)}>Menu</button>
            <button className="btn" onClick={toggleTheme}>Dark/Light</button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="container mt-3">
          <div className="card p-3 text-sm">
            Zusätzliche Funktionen sind temporär ausgeblendet (Export, Demo-Run, Logs/Details). Über dieses Menü kannst du sie später wieder zuschalten.
          </div>
        </div>
      )}

      {/* Fullscreen canvas as background-like layer */}
      <div className="canvas-fixed">
        <BpmnCanvas ref={canvasRef} xml={xml} />
        <div className="canvas-overlay">
          <div className="chat-card pointer-events-auto max-w-xl w-full">
            <PromptPanel
              value={prompt}
              onChange={setPrompt}
              onGenerate={onGenerate}
              onImprove={onImprove}
              loading={loading}
              errors={errors}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
