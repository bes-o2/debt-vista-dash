import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Bank color mapping based on real Brazilian bank brand colors (corporate versions)
const BANK_COLORS: Record<string, string> = {
  // Major Brazilian Banks
  'Itaú': 'hsl(24 54% 43%)',
  'Itau': 'hsl(24 54% 43%)',
  'Bradesco': 'hsl(352 52% 39%)',
  'Banco do Brasil': 'hsl(46 58% 40%)',
  'BB': 'hsl(46 58% 40%)',
  'Santander': 'hsl(358 55% 43%)',
  'Caixa': 'hsl(207 52% 39%)',
  'Caixa Econômica': 'hsl(207 52% 39%)',
  'Caixa Economica': 'hsl(207 52% 39%)',
  'CEF': 'hsl(207 52% 39%)',
  'Banrisul': 'hsl(216 46% 40%)',
  'BTG Pactual': 'hsl(220 22% 32%)',
  'BTG': 'hsl(220 22% 32%)',
  'Nubank': 'hsl(278 46% 42%)',
  'Nu': 'hsl(278 46% 42%)',
  'Inter': 'hsl(26 56% 43%)',
  'Banco Inter': 'hsl(26 56% 43%)',
  'C6 Bank': 'hsl(220 20% 34%)',
  'C6': 'hsl(220 20% 34%)',
  'Sicoob': 'hsl(146 42% 35%)',
  'Sicredi': 'hsl(138 43% 36%)',
  'Safra': 'hsl(200 48% 38%)',
  'Banco Safra': 'hsl(200 48% 38%)',
  'Original': 'hsl(154 42% 35%)',
  'Banco Original': 'hsl(154 42% 35%)',
  'Pine': 'hsl(156 40% 36%)',
  'PAN': 'hsl(195 50% 40%)',
  'Banco PAN': 'hsl(195 50% 40%)',
  'Votorantim': 'hsl(31 48% 40%)',
  'BV': 'hsl(31 48% 40%)',
  'Banco Votorantim': 'hsl(31 48% 40%)',
};

// Fallback colors for banks not in the mapping (corporate versions)
const FALLBACK_COLORS = [
  'hsl(220 44% 40%)',
  'hsl(24 50% 42%)',
  'hsl(145 40% 35%)',
  'hsl(280 42% 42%)',
  'hsl(358 46% 42%)',
  'hsl(45 50% 39%)',
  'hsl(200 44% 39%)',
  'hsl(320 40% 42%)',
  'hsl(35 42% 39%)',
  'hsl(260 42% 42%)',
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
