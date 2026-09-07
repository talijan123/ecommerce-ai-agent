import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCurrencySymbol(currency: string = "USD"): string {
  const curr = (currency || "USD").toUpperCase().trim();
  if (curr === "PKR" || curr === "RS" || curr === "RS." || curr === "RUPEES" || curr === "PAKISTANI RUPEE") {
    return "Rs. ";
  }
  if (curr === "EUR") return "€";
  if (curr === "GBP") return "£";
  return "$";
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  if (typeof amount !== "number" || isNaN(amount)) {
    amount = 0;
  }
  const curr = (currency || "USD").toUpperCase().trim();
  if (curr === "PKR" || curr === "RS" || curr === "RS." || curr === "RUPEES" || curr === "PAKISTANI RUPEE") {
    return `Rs. ${new Intl.NumberFormat("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)}`;
  }
  if (curr === "EUR") {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  }
  if (curr === "GBP") {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateString);
  }
}
