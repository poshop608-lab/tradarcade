"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MentorConfig } from "@/lib/types";

const STORAGE_KEY = "trades-arcade-custom-config";

interface TermRow { term: string; definition: string; category: string; }
interface ConceptRow { label: string; isValid: boolean; explanation: string; }
interface RuleRow { rule: string; description?: string; isTrue: boolean; }

function emptyTerm(): TermRow { return { term: "", definition: "", category: "" }; }
function emptyConcept(): ConceptRow { return { label: "", isValid: true, explanation: "" }; }
function emptyRule(): RuleRow { return { rule: "", description: "", isTrue: true }; }

export default function SetupPage() {
  const router = useRouter();
  const [mentorName, setMentorName] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; text: string }[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [extractingFiles, setExtractingFiles] = useState<Set<string>>(new Set());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [terms, setTerms] = useState<TermRow[]>([emptyTerm()]);
  const [concepts, setConcepts] = useState<ConceptRow[]>([emptyConcept(), emptyConcept()]);
  const [rules, setRules] = useState<RuleRow[]>([emptyRule(), emptyRule()]);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"terms" | "concepts" | "rules">("terms");

  // Load existing config on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const cfg: MentorConfig = JSON.parse(raw);
      setMentorName(cfg.displayName || "");
      setTerms(cfg.terms.length > 0 ? cfg.terms.map((t) => ({ term: t.term, definition: t.definition, category: t.category ?? "" })) : [emptyTerm()]);
      setConcepts(cfg.concepts.length > 0 ? cfg.concepts.map((c) => ({ label: c.label, isValid: c.isValid, explanation: c.explanation ?? "" })) : [emptyConcept()]);
      setRules(cfg.rules.length > 0 ? cfg.rules.map((r) => ({ rule: r.rule, description: r.description, isTrue: r.isTrue })) : [emptyRule()]);
    } catch { /* ignore */ }
  }, []);

  function saveConfig() {
    const cleanTerms = terms.filter((t) => t.term.trim() && t.definition.trim());
    const cleanConcepts = concepts.filter((c) => c.label.trim());
    const cleanRules = rules.filter((r) => r.rule.trim() && (r.description ?? "").trim());

    const config: MentorConfig = {
      id: "custom",
      displayName: mentorName.trim() || "My Trading Config",
      branding: { primaryColor: "#1DB97C", accentColor: "#F59E0B" },
      terms: cleanTerms.map((t) => ({ term: t.term.trim().toUpperCase(), definition: t.definition.trim(), category: t.category.trim() || undefined })),
      concepts: cleanConcepts.map((c) => ({ label: c.label.trim(), isValid: c.isValid, explanation: c.explanation.trim() || undefined })),
      rules: cleanRules.map((r) => ({ rule: r.rule.trim(), description: r.description?.trim(), isTrue: r.isTrue })),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleSaveAndPlay() {
    saveConfig();
    router.push("/preview");
  }

  // Term row helpers
  function updateTerm(i: number, field: keyof TermRow, val: string) {
    setTerms((prev) => prev.map((t, j) => (j === i ? { ...t, [field]: val } : t)));
  }
  function addTerm() { setTerms((prev) => [...prev, emptyTerm()]); }
  function removeTerm(i: number) { setTerms((prev) => prev.filter((_, j) => j !== i)); }

  // Concept row helpers
  function updateConcept(i: number, field: keyof ConceptRow, val: string | boolean) {
    setConcepts((prev) => prev.map((c, j) => (j === i ? { ...c, [field]: val } : c)));
  }
  function addConcept() { setConcepts((prev) => [...prev, emptyConcept()]); }
  function removeConcept(i: number) { setConcepts((prev) => prev.filter((_, j) => j !== i)); }

  // Rule row helpers
  function updateRule(i: number, field: keyof RuleRow, val: string | boolean) {
    setRules((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: val } : r)));
  }
  function addRule() { setRules((prev) => [...prev, emptyRule()]); }
  function removeRule(i: number) { setRules((prev) => prev.filter((_, j) => j !== i)); }

  const PLAIN_TEXT_EXTS = [".txt", ".md", ".text", ".csv", ".tsv", ".log", ".srt", ".vtt", ".rtf"];
  const BINARY_EXTS = [".docx", ".pdf"];

  function isPlainText(name: string) {
    const lower = name.toLowerCase();
    return PLAIN_TEXT_EXTS.some((ext) => lower.endsWith(ext));
  }

  const readPlainText = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string ?? "");
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }, []);

  const processFile = useCallback(async (file: File) => {
    // Skip duplicates
    if (uploadedFiles.some((f) => f.name === file.name)) return;

    const supported = [...PLAIN_TEXT_EXTS, ...BINARY_EXTS].some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    if (!supported) {
      setAiError(`".${file.name.split(".").pop()}" is not supported. Use .docx, .pdf, .txt, .md, .rtf, .csv, .srt, etc.`);
      return;
    }

    setExtractingFiles((prev) => new Set(prev).add(file.name));
    setAiError(null);

    try {
      let text = "";
      if (isPlainText(file.name)) {
        text = await readPlainText(file);
      } else {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/extract-text", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Extraction failed");
        text = data.text;
      }
      setUploadedFiles((prev) => [...prev, { name: file.name, text }]);
    } catch (e) {
      setAiError(`${file.name}: ${e instanceof Error ? e.message : "Could not read file"}`);
    } finally {
      setExtractingFiles((prev) => { const s = new Set(prev); s.delete(file.name); return s; });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFiles, readPlainText]);

  const handleFiles = useCallback((fileList: FileList) => {
    Array.from(fileList).forEach((file) => processFile(file));
  }, [processFile]);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = "";
  }

  function removeFile(name: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== name));
  }

  function clearAll() {
    setUploadedFiles([]);
    setPasteText("");
    setAiError(null);
  }

  // Combined transcript from all sources
  const combinedTranscript = [
    ...uploadedFiles.map((f) => `--- ${f.name} ---\n${f.text}`),
    pasteText.trim(),
  ].filter(Boolean).join("\n\n");

  const totalChars = combinedTranscript.length;

  async function handleAiParse() {
    if (!combinedTranscript.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/parse-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: combinedTranscript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      if (data.terms?.length) setTerms(data.terms.map((t: { term: string; definition: string; category?: string }) => ({ term: t.term, definition: t.definition, category: t.category ?? "" })));
      if (data.concepts?.length) setConcepts(data.concepts.map((c: { label: string; isValid: boolean; explanation?: string }) => ({ label: c.label, isValid: c.isValid, explanation: c.explanation ?? "" })));
      if (data.rules?.length) setRules(data.rules.map((r: { rule: string; description: string; isTrue: boolean }) => ({ rule: r.rule, description: r.description, isTrue: r.isTrue })));
      setShowTranscript(false);
      setUploadedFiles([]);
      setPasteText("");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Failed to parse — check ANTHROPIC_API_KEY");
    } finally {
      setAiLoading(false);
    }
  }

  const validTerms = terms.filter((t) => t.term.trim() && t.definition.trim()).length;
  const validConcepts = concepts.filter((c) => c.label.trim()).length;
  const validRules = rules.filter((r) => r.rule.trim() && (r.description ?? "").trim()).length;

  const tabs = [
    { id: "terms" as const, label: "Terms", count: validTerms, min: 6, note: "Used in Wordle, Hangman, Memory, Wheel of Fortune" },
    { id: "concepts" as const, label: "Concepts", count: validConcepts, min: 8, note: "Used in Asteroids, Fruit Ninja, Crossy Road, Doodle Jump, Whack-a-Mole" },
    { id: "rules" as const, label: "Rules", count: validRules, min: 4, note: "Used in Flappy Bird and Wheel of Fortune" },
  ];

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-5 py-10">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-foreground transition-colors uppercase tracking-[0.2em] mb-6"
        >
          ← Home
        </Link>
        <h1 className="text-3xl font-black text-foreground uppercase tracking-wide mb-1">
          Setup Your Content
        </h1>
        <p className="text-muted text-sm font-mono">
          Import your trading knowledge — terms, concepts &amp; rules — to power all 10 games.
        </p>
      </div>

      {/* AI Import */}
      <div className="mb-6 bg-card border border-card-border rounded-2xl overflow-hidden">
        {/* Header toggle */}
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">✨</span>
            <div className="text-left">
              <div className="text-sm font-semibold text-foreground">AI Import from Transcript</div>
              <div className="text-[11px] text-muted font-mono">
                Upload a file or paste text — AI extracts terms, concepts &amp; rules automatically
              </div>
            </div>
          </div>
          <span className="text-muted font-mono text-lg">{showTranscript ? "−" : "+"}</span>
        </button>

        {showTranscript && (
          <div className="px-5 pb-5 space-y-3">

            {/* Hidden multi-file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.docx,.pdf,.rtf,.csv,.tsv,.srt,.vtt,.text,.log"
              className="hidden"
              onChange={handleFileInput}
            />

            {/* Drop zone — always visible so you can keep adding files */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-all py-8 px-6 text-center select-none cursor-pointer ${
                isDragging
                  ? "border-green/60 bg-green/5 scale-[1.005]"
                  : "border-card-border hover:border-white/20 hover:bg-white/2"
              }`}
            >
              <div className={`text-3xl transition-transform ${isDragging ? "scale-110" : ""}`}>
                {isDragging ? "📂" : "📁"}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isDragging ? "Drop files!" : "Drop files or click to browse"}
                </p>
                <p className="text-[10px] text-muted font-mono mt-0.5">
                  Multiple files supported · .docx · .pdf · .txt · .md · .rtf · .csv · .srt and more
                </p>
              </div>
            </div>

            {/* Files currently extracting */}
            {extractingFiles.size > 0 && (
              <div className="space-y-1.5">
                {Array.from(extractingFiles).map((name) => (
                  <div key={name} className="flex items-center gap-3 bg-blue/8 border border-blue/20 rounded-xl px-4 py-2.5">
                    <span className="inline-block w-3.5 h-3.5 border-2 border-blue/30 border-t-blue rounded-full animate-spin shrink-0" />
                    <span className="text-xs font-mono text-blue/80 truncate">{name} — extracting…</span>
                  </div>
                ))}
              </div>
            )}

            {/* Loaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-1.5">
                {uploadedFiles.map((f) => (
                  <div key={f.name} className="flex items-center gap-3 bg-green/6 border border-green/20 rounded-xl px-4 py-2.5">
                    <span className="text-base shrink-0">📄</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-green truncate">{f.name}</p>
                      <p className="text-[10px] text-muted font-mono">{f.text.length.toLocaleString()} chars</p>
                    </div>
                    <button
                      onClick={() => removeFile(f.name)}
                      className="text-muted hover:text-red transition-colors text-lg leading-none shrink-0"
                      title="Remove"
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Paste fallback */}
            <details className="group">
              <summary className="text-[11px] text-muted font-mono cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1.5">
                <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                Or paste text directly
              </summary>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste transcript, notes, or any trading content here…"
                rows={5}
                className="mt-2 w-full bg-background border border-card-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-green/40 font-mono text-xs resize-y leading-relaxed"
              />
            </details>

            {/* Error */}
            {aiError && (
              <p className="text-red text-xs font-mono bg-red/10 border border-red/20 rounded-lg px-4 py-2">
                {aiError}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <button
                onClick={handleAiParse}
                disabled={aiLoading || !combinedTranscript.trim()}
                className="px-6 py-2.5 bg-green text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-sm uppercase tracking-wide flex items-center gap-2"
              >
                {aiLoading ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analysing…
                  </>
                ) : "✨ Parse with AI"}
              </button>
              {totalChars > 0 && !aiLoading && (
                <span className="text-[11px] text-muted font-mono">
                  {totalChars.toLocaleString()} chars total
                  {uploadedFiles.length > 1 && ` across ${uploadedFiles.length} files`}
                </span>
              )}
              {(uploadedFiles.length > 0 || pasteText) && (
                <button
                  onClick={clearAll}
                  className="text-[11px] font-mono text-muted hover:text-red transition-colors ml-auto"
                >
                  Clear all
                </button>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Mentor name */}
      <div className="mb-8 bg-card border border-card-border rounded-2xl p-5">
        <label className="text-[10px] font-mono text-muted uppercase tracking-widest block mb-2">
          Your Name / Brand
        </label>
        <input
          type="text"
          value={mentorName}
          onChange={(e) => setMentorName(e.target.value)}
          placeholder="e.g. TradeWithTom"
          className="w-full max-w-sm bg-background border border-card-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:border-green/40 font-mono text-sm"
        />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-0 border-b border-card-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-green text-green"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className={`ml-2 text-xs font-mono px-1.5 py-0.5 rounded ${
              tab.count >= tab.min ? "bg-green/15 text-green" : "bg-card text-muted"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-card border border-card-border border-t-0 rounded-b-2xl p-5 mb-6">

        {/* Terms */}
        {activeTab === "terms" && (
          <div>
            <p className="text-[11px] text-muted font-mono mb-4">
              Used in Wordle, Hangman, Memory &amp; Wheel of Fortune. Terms must be a <span className="text-amber">single word</span> (for Wordle/Hangman). Recommend 6+ terms.
            </p>
            <div className="space-y-2">
              {terms.map((t, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={t.term}
                      onChange={(e) => updateTerm(i, "term", e.target.value)}
                      placeholder="TERM (one word)"
                      className="bg-background border border-card-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-green/40 font-mono text-xs uppercase"
                    />
                    <input
                      type="text"
                      value={t.definition}
                      onChange={(e) => updateTerm(i, "definition", e.target.value)}
                      placeholder="Definition"
                      className="col-span-2 bg-background border border-card-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-green/40 text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={t.category}
                    onChange={(e) => updateTerm(i, "category", e.target.value)}
                    placeholder="Category (opt)"
                    className="w-36 bg-background border border-card-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-green/40 text-xs"
                  />
                  <button
                    onClick={() => removeTerm(i)}
                    className="text-muted hover:text-red transition-colors text-lg leading-none mt-1.5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addTerm}
              className="mt-3 text-xs font-mono text-green/70 hover:text-green transition-colors border border-green/20 hover:border-green/40 rounded-lg px-4 py-2"
            >
              + Add Term
            </button>
          </div>
        )}

        {/* Concepts */}
        {activeTab === "concepts" && (
          <div>
            <p className="text-[11px] text-muted font-mono mb-4">
              Used in Asteroids, Fruit Ninja, Crossy Road, Doodle Jump &amp; Whack-a-Mole. Each concept is labelled as a <span className="text-green">valid</span> or <span className="text-red">invalid</span> trading behaviour. Recommend 8+ with a mix of both.
            </p>
            <div className="space-y-2">
              {concepts.map((c, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={c.label}
                      onChange={(e) => updateConcept(i, "label", e.target.value)}
                      placeholder="Short label (3-5 words)"
                      className="bg-background border border-card-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-green/40 text-xs"
                    />
                    <input
                      type="text"
                      value={c.explanation}
                      onChange={(e) => updateConcept(i, "explanation", e.target.value)}
                      placeholder="Why? (explanation)"
                      className="bg-background border border-card-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-green/40 text-xs"
                    />
                  </div>
                  {/* Valid / Invalid toggle */}
                  <button
                    onClick={() => updateConcept(i, "isValid", !c.isValid)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold border transition-all ${
                      c.isValid
                        ? "bg-green/10 border-green/40 text-green"
                        : "bg-red/10 border-red/40 text-red"
                    }`}
                  >
                    {c.isValid ? "✓ Valid" : "✗ Invalid"}
                  </button>
                  <button
                    onClick={() => removeConcept(i)}
                    className="text-muted hover:text-red transition-colors text-lg leading-none mt-1.5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addConcept}
              className="mt-3 text-xs font-mono text-green/70 hover:text-green transition-colors border border-green/20 hover:border-green/40 rounded-lg px-4 py-2"
            >
              + Add Concept
            </button>
          </div>
        )}

        {/* Rules */}
        {activeTab === "rules" && (
          <div>
            <p className="text-[11px] text-muted font-mono mb-4">
              Used in Flappy Bird (TRUE/FALSE gates) and Wheel of Fortune (phrases to reveal). Each rule is a statement that is either <span className="text-green">true</span> or <span className="text-red">false</span>. Recommend 4+ rules.
            </p>
            <div className="space-y-2">
              {rules.map((r, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={r.rule}
                      onChange={(e) => updateRule(i, "rule", e.target.value)}
                      placeholder="The rule / statement"
                      className="bg-background border border-card-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-green/40 text-xs"
                    />
                    <input
                      type="text"
                      value={r.description}
                      onChange={(e) => updateRule(i, "description", e.target.value)}
                      placeholder="Explanation / context"
                      className="bg-background border border-card-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-green/40 text-xs"
                    />
                  </div>
                  {/* True / False toggle */}
                  <button
                    onClick={() => updateRule(i, "isTrue", !r.isTrue)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold border transition-all ${
                      r.isTrue
                        ? "bg-green/10 border-green/40 text-green"
                        : "bg-red/10 border-red/40 text-red"
                    }`}
                  >
                    {r.isTrue ? "TRUE" : "FALSE"}
                  </button>
                  <button
                    onClick={() => removeRule(i)}
                    className="text-muted hover:text-red transition-colors text-lg leading-none mt-1.5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addRule}
              className="mt-3 text-xs font-mono text-green/70 hover:text-green transition-colors border border-green/20 hover:border-green/40 rounded-lg px-4 py-2"
            >
              + Add Rule
            </button>
          </div>
        )}
      </div>

      {/* Summary counts */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {tabs.map((tab) => (
          <div key={tab.id} className="flex items-center gap-2 text-xs font-mono">
            <span className={tab.count >= tab.min ? "text-green" : "text-muted"}>
              {tab.count >= tab.min ? "✓" : "○"}
            </span>
            <span className={tab.count >= tab.min ? "text-foreground/60" : "text-muted"}>
              {tab.label}: {tab.count}/{tab.min} min
            </span>
          </div>
        ))}
      </div>

      {/* Save buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSaveAndPlay}
          className="px-8 py-3 bg-green text-white font-bold rounded-xl hover:opacity-90 transition-opacity uppercase tracking-wide text-sm"
        >
          Save & Play →
        </button>
        <button
          onClick={saveConfig}
          className="px-6 py-3 bg-card border border-card-border text-foreground font-bold rounded-xl hover:border-white/20 transition-colors uppercase tracking-wide text-sm"
        >
          {saved ? "Saved ✓" : "Save"}
        </button>
        {validTerms > 0 || validConcepts > 0 || validRules > 0 ? (
          <Link
            href="/preview"
            className="px-6 py-3 text-muted font-mono text-xs border border-card-border rounded-xl hover:text-foreground transition-colors flex items-center"
          >
            Preview last saved →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
