import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Bank color mapping based on real Brazilian bank brand colors
const BANK_COLORS: Record<string, string> = {
  // Major Brazilian Banks
  'Itaú': 'hsl(25 95% 55%)', // Orange
  'Itau': 'hsl(25 95% 55%)', // Orange (alternative spelling)
  'Bradesco': 'hsl(358 85% 55%)', // Red
  'Banco do Brasil': 'hsl(55 95% 50%)', // Yellow
  'BB': 'hsl(55 95% 50%)', // Yellow (abbreviation)
  'Santander': 'hsl(358 85% 55%)', // Red
  'Caixa': 'hsl(205 90% 45%)', // Blue
  'Caixa Econômica': 'hsl(205 90% 45%)', // Blue
  'Caixa Economica': 'hsl(205 90% 45%)', // Blue (without accent)
  'CEF': 'hsl(205 90% 45%)', // Blue (abbreviation)
  'Banrisul': 'hsl(205 90% 45%)', // Blue
  'BTG Pactual': 'hsl(220 25% 25%)', // Dark gray/black
  'BTG': 'hsl(220 25% 25%)', // Dark gray/black
  'Nubank': 'hsl(280 100% 60%)', // Purple
  'Nu': 'hsl(280 100% 60%)', // Purple
  'Inter': 'hsl(25 95% 55%)', // Orange
  'Banco Inter': 'hsl(25 95% 55%)', // Orange
  'C6 Bank': 'hsl(220 25% 25%)', // Dark gray
  'C6': 'hsl(220 25% 25%)', // Dark gray
  'Sicoob': 'hsl(145 75% 40%)', // Green
  'Sicredi': 'hsl(145 75% 40%)', // Green
  'Safra': 'hsl(205 90% 45%)', // Blue
  'Banco Safra': 'hsl(205 90% 45%)', // Blue
  'Original': 'hsl(145 75% 40%)', // Green
  'Banco Original': 'hsl(145 75% 40%)', // Green
  'Pine': 'hsl(145 75% 40%)', // Green
  'PAN': 'hsl(205 90% 45%)', // Blue
  'Banco PAN': 'hsl(205 90% 45%)', // Blue
  'Votorantim': 'hsl(25 95% 55%)', // Orange
  'BV': 'hsl(25 95% 55%)', // Orange
  'Banco Votorantim': 'hsl(25 95% 55%)', // Orange
};

// Fallback colors for banks not in the mapping
const FALLBACK_COLORS = [
  'hsl(220 70% 50%)', // Blue
  'hsl(25 95% 55%)', // Orange  
  'hsl(145 75% 40%)', // Green
  'hsl(280 100% 60%)', // Purple
  'hsl(358 85% 55%)', // Red
  'hsl(45 95% 50%)', // Yellow
  'hsl(200 95% 45%)', // Light Blue
  'hsl(320 85% 60%)', // Pink
  'hsl(35 85% 50%)', // Brown/Orange
  'hsl(260 85% 55%)', // Indigo
];

export function getBankColor(bankName: string): string {
  // Try exact match first
  if (BANK_COLORS[bankName]) {
    return BANK_COLORS[bankName];
  }
  
  // Try partial match for cases where bank name might have variations
  const bankNameLower = bankName.toLowerCase();
  for (const [key, color] of Object.entries(BANK_COLORS)) {
    if (bankNameLower.includes(key.toLowerCase()) || key.toLowerCase().includes(bankNameLower)) {
      return color;
    }
  }
  
  // Fallback to deterministic color based on bank name hash
  let hash = 0;
  for (let i = 0; i < bankName.length; i++) {
    const char = bankName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}
