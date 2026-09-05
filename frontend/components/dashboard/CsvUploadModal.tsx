"use client";

import React, { useState, useRef } from "react";
import {
  X,
  UploadCloud,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/lib/ui";
import { api, CSVImportSummary, formatApiError } from "@/lib/api";

interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  onSuccess: () => void;
}

export function CsvUploadModal({ isOpen, onClose, storeId, onSuccess }: CsvUploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [summary, setSummary] = useState<CSVImportSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith(".csv")) {
        setSelectedFile(file);
        setErrorMsg(null);
      } else {
        setErrorMsg("Please drop a valid .csv file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith(".csv")) {
        setSelectedFile(file);
        setErrorMsg(null);
      } else {
        setErrorMsg("Please select a valid .csv file.");
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !storeId) return;
    setIsUploading(true);
    setErrorMsg(null);

    try {
      const res = await api.uploadProductsCSV(storeId, selectedFile);
      setSummary(res);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(formatApiError(err));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card w-full max-w-lg rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl relative bg-white dark:bg-zinc-950">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Import Product Catalog CSV
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Bulk update inventory quantities, prices, and size variants
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Sample Template Download */}
        <div className="mb-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
            Need the correct spreadsheet schema?
          </span>
          <button
            onClick={() => api.downloadSampleProductsCsv()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Sample CSV</span>
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-6 rounded-2xl border-2 border-dashed cursor-pointer text-center transition-all ${
            dragActive
              ? "border-blue-500 bg-blue-500/10"
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
            className={`h-8 w-8 mx-auto mb-2 ${
              selectedFile ? "text-emerald-500" : "text-zinc-400"
            }`}
          />
          {selectedFile ? (
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                {selectedFile.name}
              </span>
              <span className="text-[10px] text-zinc-400">
                {(selectedFile.size / 1024).toFixed(1)} KB • Click to change file
              </span>
            </div>
          ) : (
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                Choose CSV file or drag here
              </span>
              <span className="text-[10px] text-zinc-400">
                Must contain: title, price, stock_quantity, category, sku
              </span>
            </div>
          )}
        </div>

        {/* Success feedback */}
        {summary && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Imported {summary.imported} of {summary.total_rows} products successfully!</span>
            </div>
            {summary.errors?.length > 0 && (
              <span className="text-[10px] text-amber-500 block">
                {summary.errors.length} rows skipped due to invalid format.
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            {summary ? "Done" : "Cancel"}
          </Button>

          {selectedFile && !summary && (
            <Button
              variant="gradient"
              size="sm"
              onClick={handleUpload}
              disabled={isUploading}
              className="gap-2 text-xs font-bold"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing CSV...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload & Ingest Catalog</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
