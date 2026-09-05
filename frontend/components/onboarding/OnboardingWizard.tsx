"use client";

import React, { useState, useRef } from "react";
import {
  Store,
  FileSpreadsheet,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  Download,
  Loader2,
  ShieldCheck,
  HelpCircle,
  FileText,
  Smartphone,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Bot,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import {
  api,
  StoreResponse,
  CSVImportSummary,
  WhatsAppVerifyResponse,
  formatApiError,
} from "@/lib/api";
import { Button } from "@/lib/ui";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose?: () => void;
  onComplete: (store: StoreResponse) => void;
}

type ToneType = "friendly" | "formal" | "concise" | "enthusiastic";

const TONE_PRESETS: Record<ToneType, { label: string; description: string; prompt: (name: string) => string }> = {
  friendly: {
    label: "Friendly & Warm",
    description: "Approachable, conversational, and helpful tone for everyday retail",
    prompt: (name) =>
      `You are a friendly, warm, and highly helpful AI shopping assistant for ${name || "our store"}. Greet customers warmly, answer product inquiries with enthusiasm, provide accurate inventory details, and help them track shipments effortlessly.`,
  },
  formal: {
    label: "Formal & Professional",
    description: "Courteous, precise, and sophisticated tone for luxury or enterprise",
    prompt: (name) =>
      `You are a professional and courteous corporate e-commerce assistant representing ${name || "our company"}. Provide clear, well-structured, and accurate information regarding catalog items, order statuses, and return policies.`,
  },
  concise: {
    label: "Concise & Direct",
    description: "Quick, bulleted responses optimized for fast resolution",
    prompt: (name) =>
      `You are a concise, fast-responding AI assistant for ${name || "the store"}. Answer customer questions directly in brief bullet points without unnecessary filler, focusing strictly on product availability, prices, and tracking.`,
  },
  enthusiastic: {
    label: "Enthusiastic & High Energy",
    description: "Exciting, energetic brand ambassador driving recommendations",
    prompt: (name) =>
      `You are an enthusiastic brand ambassador and AI stylist for ${name || "our brand"}! Proactively highlight bestsellers, recommend coordinating items, and create an exciting and delightful shopping journey!`,
  },
};

export function OnboardingWizard({ isOpen, onClose, onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [createdStore, setCreatedStore] = useState<StoreResponse | null>(null);

  // Step 1: Store Setup State
  const [storeName, setStoreName] = useState("");
  const [selectedTone, setSelectedTone] = useState<ToneType>("friendly");
  const [systemPrompt, setSystemPrompt] = useState(TONE_PRESETS.friendly.prompt(""));
  const [isSubmittingStep1, setIsSubmittingStep1] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2: Catalog Ingestion State
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [csvSummary, setCsvSummary] = useState<CSVImportSummary | null>(null);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: WhatsApp Setup State
  const [phoneId, setPhoneId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isVerifyingWa, setIsVerifyingWa] = useState(false);
  const [waVerification, setWaVerification] = useState<WhatsAppVerifyResponse | null>(null);
  const [step3Error, setStep3Error] = useState<string | null>(null);
  const [showMetaGuide, setShowMetaGuide] = useState(false);

  if (!isOpen) return null;

  // Change tone updates system instructions if user hasn't heavily customized
  const handleToneChange = (tone: ToneType) => {
    setSelectedTone(tone);
    setSystemPrompt(TONE_PRESETS[tone].prompt(storeName));
  };

  const handleStoreNameChange = (val: string) => {
    setStoreName(val);
    if (!systemPrompt || systemPrompt === TONE_PRESETS[selectedTone].prompt("")) {
      setSystemPrompt(TONE_PRESETS[selectedTone].prompt(val));
    }
  };

  // STEP 1 SUBMIT
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep1Error(null);

    if (!storeName.trim()) {
      setStep1Error("Please enter a name for your store.");
      return;
    }

    setIsSubmittingStep1(true);
    try {
      const newStore = await api.createStore({
        name: storeName.trim(),
        system_prompt: systemPrompt.trim(),
      });
      setCreatedStore(newStore);
      setCurrentStep(2);
    } catch (err: any) {
      setStep1Error(formatApiError(err));
    } finally {
      setIsSubmittingStep1(false);
    }
  };

  // STEP 2: FILE DRAG & DROP
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith(".csv")) {
        setSelectedFile(file);
        setStep2Error(null);
      } else {
        setStep2Error("Please upload a valid .csv spreadsheet.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith(".csv")) {
        setSelectedFile(file);
        setStep2Error(null);
      } else {
        setStep2Error("Please select a valid .csv file.");
      }
    }
  };

  const handleUploadCsv = async () => {
    if (!selectedFile || !createdStore) return;
    setIsUploadingCsv(true);
    setStep2Error(null);

    try {
      const summary = await api.uploadProductsCSV(createdStore.id, selectedFile);
      setCsvSummary(summary);
    } catch (err: any) {
      setStep2Error(formatApiError(err));
    } finally {
      setIsUploadingCsv(false);
    }
  };

  // STEP 3: WHATSAPP VERIFY
  const handleVerifyWhatsApp = async () => {
    if (!createdStore) return;
    setStep3Error(null);

    if (!phoneId.trim() || !accessToken.trim()) {
      setStep3Error("Please provide both the WhatsApp Phone Number ID and Access Token.");
      return;
    }

    setIsVerifyingWa(true);
    try {
      const res = await api.verifyWhatsApp(createdStore.id, {
        whatsapp_phone_number_id: phoneId.trim(),
        whatsapp_access_token: accessToken.trim(),
      });

      if (res.status === "connected") {
        setWaVerification(res);
        // Refresh store record
        const updated = await api.getStore(createdStore.id).catch(() => createdStore);
        setCreatedStore(updated);
      } else {
        setStep3Error(res.error || "Could not verify credentials with Meta Cloud API. Check phone ID and token.");
      }
    } catch (err: any) {
      setStep3Error(formatApiError(err));
    } finally {
      setIsVerifyingWa(false);
    }
  };

  // COMPLETE WIZARD
  const handleFinishOnboarding = () => {
    if (!createdStore) return;

    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#3b82f6", "#6366f1", "#10b981", "#ec4899"],
      });
    } catch {
      // Confetti fallback
    }

    setCurrentStep(4);
  };

  const handleEnterDashboard = () => {
    if (createdStore) {
      onComplete(createdStore);
    }
    if (onClose) onClose();
  };

  // QR code deep link for completion
  const targetPhone = waVerification?.display_phone_number || phoneId || "WhatsApp";
  const cleanPhone = targetPhone.replace(/[^0-9]/g, "");
  const testMsg = `Hi! I want to explore products and track orders at ${createdStore?.name || "the store"}.`;
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(testMsg)}`
    : `https://wa.me/?text=${encodeURIComponent(testMsg)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="glass-card w-full max-w-2xl rounded-3xl p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 shadow-2xl relative bg-white dark:bg-zinc-950 my-8">
        {/* Close Button (if dismissible) */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Stepper Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-md mx-auto relative mb-3">
            {/* Connecting Line */}
            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-zinc-200 dark:bg-zinc-800 -z-0" />
            <div
              className="absolute left-6 top-1/2 -translate-y-1/2 h-0.5 bg-blue-600 transition-all duration-300 -z-0"
              style={{
                width:
                  currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "100%",
              }}
            />

            {/* Step 1 Pill */}
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep >= 1
                    ? "gradient-blue-indigo text-white shadow-md shadow-blue-500/25"
                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 border border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {currentStep > 1 ? <CheckCircle2 className="h-5 w-5" /> : "1"}
              </div>
              <span className="text-[10px] font-bold mt-1 text-zinc-600 dark:text-zinc-400">
                Store Setup
              </span>
            </div>

            {/* Step 2 Pill */}
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep >= 2
                    ? "gradient-blue-indigo text-white shadow-md shadow-blue-500/25"
                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 border border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {currentStep > 2 ? <CheckCircle2 className="h-5 w-5" /> : "2"}
              </div>
              <span className="text-[10px] font-bold mt-1 text-zinc-600 dark:text-zinc-400">
                Product Catalog
              </span>
            </div>

            {/* Step 3 Pill */}
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep >= 3
                    ? "gradient-blue-indigo text-white shadow-md shadow-blue-500/25"
                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 border border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {currentStep >= 4 ? <CheckCircle2 className="h-5 w-5" /> : "3"}
              </div>
              <span className="text-[10px] font-bold mt-1 text-zinc-600 dark:text-zinc-400">
                WhatsApp API
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* STEP 1: STORE SETUP & AI PERSONALITY */}
        {/* ============================================================ */}
        {currentStep === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-5 animate-in fade-in">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Store className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white">
                  Step 1: Store Setup & AI Personality
                </h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Name your store tenant and configure how your AI shopping assistant communicates.
              </p>
            </div>

            {step1Error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{step1Error}</span>
              </div>
            )}

            {/* Store Name */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Store / Merchant Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Velocity Athletic Apparel"
                value={storeName}
                onChange={(e) => handleStoreNameChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            {/* Support Tone Selector */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Customer Support AI Tone
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(TONE_PRESETS) as ToneType[]).map((t) => {
                  const info = TONE_PRESETS[t];
                  const isSelected = selectedTone === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleToneChange(t)}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        isSelected
                          ? "bg-blue-600/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300"
                      }`}
                    >
                      <span className="text-xs font-bold block">{info.label}</span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 line-clamp-1 block mt-0.5">
                        {info.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* System Instructions / Prompt */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Custom AI Assistant System Instructions
                </label>
                <span className="text-[10px] text-zinc-400">Editable prompt</span>
              </div>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Instruct your AI agent on brand rules, policies, and tone..."
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none font-mono"
              />
            </div>

            {/* Step 1 Actions */}
            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                variant="gradient"
                size="md"
                disabled={isSubmittingStep1}
                className="gap-2 font-bold px-6"
              >
                {isSubmittingStep1 ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating Store...</span>
                  </>
                ) : (
                  <>
                    <span>Next: Product Catalog</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* STEP 2: PRODUCT CATALOG INGESTION */}
        {/* ============================================================ */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileSpreadsheet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white">
                  Step 2: Product Catalog Ingestion
                </h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Upload your product spreadsheet (.csv) to enable real-time inventory checks and recommendations.
              </p>
            </div>

            {step2Error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{step2Error}</span>
              </div>
            )}

            {/* Template Download Card */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                    Need a CSV Template?
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Download pre-formatted sample with headers: title, price, stock, category, sku.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => api.downloadSampleProductsCsv()}
                className="shrink-0 gap-1.5 text-xs bg-white dark:bg-zinc-900"
              >
                <Download className="h-3.5 w-3.5 text-indigo-500" />
                <span>Download Sample CSV</span>
              </Button>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed cursor-pointer text-center transition-all ${
                dragActive
                  ? "border-indigo-500 bg-indigo-500/10"
                  : selectedFile
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <UploadCloud
                className={`h-10 w-10 mx-auto mb-2 ${
                  selectedFile ? "text-emerald-500" : "text-zinc-400"
                }`}
              />
              {selectedFile ? (
                <div className="space-y-1">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                    {selectedFile.name}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Click or drop new file to replace
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                    Drag and drop product catalog .csv here
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    or browse from your computer
                  </span>
                </div>
              )}
            </div>

            {/* Ingestion Summary Feedback */}
            {csvSummary && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Catalog Ingested: {csvSummary.imported} of {csvSummary.total_rows} items
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px]">
                    Success
                  </span>
                </div>
                {csvSummary.sample_imported?.length > 0 && (
                  <div className="text-[11px] text-zinc-600 dark:text-zinc-400 bg-white/70 dark:bg-zinc-900/70 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-1">
                    <span className="font-bold text-zinc-900 dark:text-white block">
                      Sample Ingested Products:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 font-mono text-[10px]">
                      {csvSummary.sample_imported.slice(0, 3).map((p: any, i) => (
                        <li key={i}>
                          {p.title} (${p.price}) — Stock: {p.stock_quantity || p.stock}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {csvSummary.errors?.length > 0 && (
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg">
                    <span>Note: {csvSummary.errors.length} skipped rows (invalid format).</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 2 Actions */}
            <div className="pt-2 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setCurrentStep(1)}
                className="gap-1 text-xs"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>

              <div className="flex items-center gap-2">
                {selectedFile && !csvSummary && (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleUploadCsv}
                    disabled={isUploadingCsv}
                    className="gap-2 text-xs font-bold"
                  >
                    {isUploadingCsv ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Importing CSV...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4" />
                        <span>Upload & Parse Catalog</span>
                      </>
                    )}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="gradient"
                  size="md"
                  onClick={() => setCurrentStep(3)}
                  className="gap-2 text-xs font-bold"
                >
                  <span>{csvSummary ? "Next: Connect WhatsApp" : "Skip & Connect WhatsApp"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: CONNECT WHATSAPP CLOUD API */}
        {/* ============================================================ */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-in fade-in">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white">
                  Step 3: Connect WhatsApp Cloud API
                </h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Connect Meta WhatsApp Cloud API credentials to link your autonomous customer agent.
              </p>
            </div>

            {step3Error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{step3Error}</span>
              </div>
            )}

            {/* Meta Guide Tooltip Accordion */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowMetaGuide(!showMetaGuide)}
                className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-blue-500" />
                  <span>Where to find Phone Number ID & Token in Meta Developers?</span>
                </div>
                {showMetaGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showMetaGuide && (
                <div className="p-4 pt-1 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-2">
                  <p>
                    1. Go to{" "}
                    <a
                      href="https://developers.facebook.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline font-bold"
                    >
                      developers.facebook.com/apps
                    </a>{" "}
                    and open your WhatsApp App.
                  </p>
                  <p>
                    2. In the sidebar, navigate to <strong>WhatsApp &rarr; API Setup</strong> (or Quickstart).
                  </p>
                  <p>
                    3. Copy the <strong>Phone number ID</strong> from Step 1 of API Setup.
                  </p>
                  <p>
                    4. Generate a <strong>Temporary Access Token</strong> or create a System User Permanent Token in Business Manager.
                  </p>
                </div>
              )}
            </div>

            {/* Phone Number ID Input */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                WhatsApp Phone Number ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 104829104820194"
                value={phoneId}
                onChange={(e) => setPhoneId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
              />
            </div>

            {/* Access Token Input */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                WhatsApp Access Token (Bearer Token) <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                placeholder="EAA..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
              />
            </div>

            {/* Verification Result Banner */}
            {waVerification && waVerification.status === "connected" && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 dark:text-emerald-300 space-y-1">
                  <p className="font-bold text-sm">Meta WhatsApp Cloud API Connected!</p>
                  <p>
                    Verified Business:{" "}
                    <strong>{waVerification.verified_name || createdStore?.name}</strong>
                  </p>
                  {waVerification.display_phone_number && (
                    <p className="font-mono text-[11px]">
                      Display Phone: {waVerification.display_phone_number}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3 Actions */}
            <div className="pt-2 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setCurrentStep(2)}
                className="gap-1 text-xs"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>

              <div className="flex items-center gap-2">
                {phoneId && accessToken && (!waVerification || waVerification.status !== "connected") && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleVerifyWhatsApp}
                    disabled={isVerifyingWa}
                    className="gap-2 text-xs font-bold"
                  >
                    {isVerifyingWa ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Verifying Meta API...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <span>Verify Credentials</span>
                      </>
                    )}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="gradient"
                  size="md"
                  onClick={handleFinishOnboarding}
                  className="gap-2 text-xs font-bold"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Complete Setup & Launch</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: CELEBRATION & TESTING SCREEN */}
        {/* ============================================================ */}
        {currentStep === 4 && (
          <div className="text-center space-y-6 py-2 animate-in zoom-in-95 duration-300">
            <div className="h-16 w-16 rounded-2xl gradient-blue-indigo text-white flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/25 animate-bounce">
              <Bot className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                Store Tenant Setup Complete!
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                Your autonomous AI agent for <strong>{createdStore?.name}</strong> is deployed and grounded to your catalog.
              </p>
            </div>

            {/* WhatsApp Test Card with QR Code */}
            <div className="p-6 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 max-w-sm mx-auto shadow-inner flex flex-col items-center">
              <span className="text-xs font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-emerald-500" />
                Scan to Send First WhatsApp Test Turn
              </span>

              <div className="p-3.5 bg-white rounded-2xl shadow-md border border-zinc-100">
                <QRCodeSVG
                  value={whatsappUrl}
                  size={160}
                  level="M"
                  includeMargin={false}
                  fgColor="#0f172a"
                />
              </div>

              <div className="mt-4 w-full">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/20 transition-all"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open in WhatsApp Web / App</span>
                </a>
              </div>
            </div>

            {/* Launch Dashboard Button */}
            <div>
              <Button
                type="button"
                variant="gradient"
                size="lg"
                onClick={handleEnterDashboard}
                className="w-full max-w-sm gap-2 font-bold shadow-xl shadow-blue-500/25"
              >
                <span>Launch Merchant Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
