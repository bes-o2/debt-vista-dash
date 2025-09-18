import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Bank color mapping based on real Brazilian bank brand colors (corporate versions)
const BANK_COLORS: Record<string, string> = {
  // Major Brazilian Banks
  'Itaú': 'hsl(20 85% 45%)', // Corporate Orange
  'Itau': 'hsl(20 85% 45%)', // Corporate Orange (alternative spelling)
  'Bradesco': 'hsl(8 75% 45%)', // Deep Red/Burgundy
  'Banco do Brasil': 'hsl(48 80% 35%)', // Corporate Yellow/Gold
  'BB': 'hsl(48 80% 35%)', // Corporate Yellow/Gold (abbreviation)
  'Santander': 'hsl(358 75% 50%)', // Bright Red
  'Caixa': 'hsl(210 85% 40%)', // Corporate Blue
  'Caixa Econômica': 'hsl(210 85% 40%)', // Corporate Blue
  'Caixa Economica': 'hsl(210 85% 40%)', // Corporate Blue (without accent)
  'CEF': 'hsl(210 85% 40%)', // Corporate Blue (abbreviation)
  'Banrisul': 'hsl(215 80% 45%)', // Deep Blue
  'BTG Pactual': 'hsl(220 30% 25%)', // Corporate Dark Gray
  'BTG': 'hsl(220 30% 25%)', // Corporate Dark Gray
  'Nubank': 'hsl(280 85% 50%)', // Corporate Purple
  'Nu': 'hsl(280 85% 50%)', // Corporate Purple
  'Inter': 'hsl(25 80% 45%)', // Corporate Orange
  'Banco Inter': 'hsl(25 80% 45%)', // Corporate Orange
  'C6 Bank': 'hsl(220 35% 30%)', // Corporate Dark Gray
  'C6': 'hsl(220 35% 30%)', // Corporate Dark Gray
  'Sicoob': 'hsl(145 65% 35%)', // Corporate Green
  'Sicredi': 'hsl(140 70% 40%)', // Slightly different Corporate Green
  'Safra': 'hsl(200 75% 40%)', // Corporate Blue
  'Banco Safra': 'hsl(200 75% 40%)', // Corporate Blue
  'Original': 'hsl(150 70% 35%)', // Corporate Green
  'Banco Original': 'hsl(150 70% 35%)', // Corporate Green
  'Pine': 'hsl(155 65% 38%)', // Corporate Green
  'PAN': 'hsl(195 80% 42%)', // Corporate Blue
  'Banco PAN': 'hsl(195 80% 42%)', // Corporate Blue
  'Votorantim': 'hsl(30 75% 40%)', // Corporate Orange
  'BV': 'hsl(30 75% 40%)', // Corporate Orange
  'Banco Votorantim': 'hsl(30 75% 40%)', // Corporate Orange
};

// Fallback colors for banks not in the mapping (corporate versions)
const FALLBACK_COLORS = [
  'hsl(220 65% 40%)', // Corporate Blue
  'hsl(20 80% 40%)', // Corporate Orange  
  'hsl(145 65% 35%)', // Corporate Green
  'hsl(280 75% 45%)', // Corporate Purple
  'hsl(358 70% 45%)', // Corporate Red
  'hsl(45 75% 40%)', // Corporate Gold
  'hsl(200 80% 40%)', // Corporate Light Blue
  'hsl(320 70% 45%)', // Corporate Pink
  'hsl(35 70% 40%)', // Corporate Brown/Orange
  'hsl(260 75% 45%)', // Corporate Indigo
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
