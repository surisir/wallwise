export type PaintBrandId = "asian-paints" | "berger-paints" | "nerolac" | "dulux" | "indigo-paints";

export type PaintShade = {
  brandId: PaintBrandId;
  brandName: string;
  name: string;
  code: string;
  hex: string;
  category: string;
};

export type PaintBrand = {
  id: PaintBrandId;
  name: string;
  shortName: string;
  description: string;
};

export const PAINT_BRANDS: PaintBrand[] = [
  {
    id: "asian-paints",
    name: "Asian Paints",
    shortName: "Asian",
    description: "Warm Indian neutrals, soft pastels, and confident accents.",
  },
  {
    id: "berger-paints",
    name: "Berger Paints",
    shortName: "Berger",
    description: "Everyday wall shades with balanced neutral and accent families.",
  },
  {
    id: "nerolac",
    name: "Nerolac",
    shortName: "Nerolac",
    description: "Clean contemporary whites, creams, greens, blues, and earthy tones.",
  },
  {
    id: "dulux",
    name: "Akzo Nobel India / Dulux",
    shortName: "Dulux",
    description: "Dulux-inspired palettes for calm, premium room color choices.",
  },
  {
    id: "indigo-paints",
    name: "Indigo Paints",
    shortName: "Indigo",
    description: "Modern Indian home shades, from airy neutrals to rich feature colors.",
  },
];

export const PAINT_SHADES: PaintShade[] = [
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Ivory Palace", code: "AP-CUR-001", hex: "#F4EBDD", category: "Whites & Creams" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Morning Glory", code: "AP-CUR-002", hex: "#F7F3E8", category: "Whites & Creams" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Warm Sand", code: "AP-CUR-003", hex: "#E6D5B8", category: "Beige & Taupe" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Soft Almond", code: "AP-CUR-004", hex: "#D8C3A3", category: "Beige & Taupe" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Misty Sage", code: "AP-CUR-005", hex: "#B8C1AE", category: "Greens" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Washed Indigo", code: "AP-CUR-006", hex: "#8FA9BD", category: "Blues" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Terracotta Glow", code: "AP-CUR-007", hex: "#B96E52", category: "Earth & Accent" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Rose Beige", code: "AP-CUR-008", hex: "#D7A99C", category: "Pinks & Mauves" },

  { brandId: "berger-paints", brandName: "Berger Paints", name: "Classic Ivory", code: "BP-CUR-001", hex: "#F2E8D2", category: "Whites & Creams" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Moonlit White", code: "BP-CUR-002", hex: "#F5F4EC", category: "Whites & Creams" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Cappuccino", code: "BP-CUR-003", hex: "#C9B292", category: "Beige & Taupe" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Greige Mist", code: "BP-CUR-004", hex: "#BDB7A9", category: "Greys" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Olive Haze", code: "BP-CUR-005", hex: "#9BA58F", category: "Greens" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Harbour Blue", code: "BP-CUR-006", hex: "#6D8DA7", category: "Blues" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Burnt Clay", code: "BP-CUR-007", hex: "#AA624B", category: "Earth & Accent" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Dusty Blush", code: "BP-CUR-008", hex: "#D3A5A0", category: "Pinks & Mauves" },

  { brandId: "nerolac", brandName: "Nerolac", name: "Pearl White", code: "NL-CUR-001", hex: "#F6F2E8", category: "Whites & Creams" },
  { brandId: "nerolac", brandName: "Nerolac", name: "Vanilla Cream", code: "NL-CUR-002", hex: "#EFE0BF", category: "Whites & Creams" },
  { brandId: "nerolac", brandName: "Nerolac", name: "Wheat Beige", code: "NL-CUR-003", hex: "#D8C19C", category: "Beige & Taupe" },
  { brandId: "nerolac", brandName: "Nerolac", name: "Urban Grey", code: "NL-CUR-004", hex: "#A9AAA3", category: "Greys" },
  { brandId: "nerolac", brandName: "Nerolac", name: "Aloe Leaf", code: "NL-CUR-005", hex: "#A7B79B", category: "Greens" },
  { brandId: "nerolac", brandName: "Nerolac", name: "Powder Blue", code: "NL-CUR-006", hex: "#A9C9D9", category: "Blues" },
  { brandId: "nerolac", brandName: "Nerolac", name: "Brick Dust", code: "NL-CUR-007", hex: "#B7775E", category: "Earth & Accent" },
  { brandId: "nerolac", brandName: "Nerolac", name: "Mauve Whisper", code: "NL-CUR-008", hex: "#C9A7B4", category: "Pinks & Mauves" },

  { brandId: "dulux", brandName: "Akzo Nobel India / Dulux", name: "Cotton White", code: "DX-CUR-001", hex: "#F7F4EA", category: "Whites & Creams" },
  { brandId: "dulux", brandName: "Akzo Nobel India / Dulux", name: "Natural Hessian", code: "DX-CUR-002", hex: "#D8C7AB", category: "Beige & Taupe" },
  { brandId: "dulux", brandName: "Akzo Nobel India / Dulux", name: "Timeless Taupe", code: "DX-CUR-003", hex: "#BBB0A0", category: "Beige & Taupe" },
  { brandId: "dulux", brandName: "Akzo Nobel India / Dulux", name: "Polished Pebble", code: "DX-CUR-004", hex: "#C9CBC5", category: "Greys" },
  { brandId: "dulux", brandName: "Akzo Nobel India / Dulux", name: "Sage Calm", code: "DX-CUR-005", hex: "#AEBBA6", category: "Greens" },
  { brandId: "dulux", brandName: "Akzo Nobel India / Dulux", name: "Denim Drift", code: "DX-CUR-006", hex: "#6F8797", category: "Blues" },
  { brandId: "dulux", brandName: "Akzo Nobel India / Dulux", name: "Copper Blush", code: "DX-CUR-007", hex: "#C4796A", category: "Earth & Accent" },
  { brandId: "dulux", brandName: "Akzo Nobel India / Dulux", name: "Soft Heather", code: "DX-CUR-008", hex: "#B8A2B8", category: "Pinks & Mauves" },

  { brandId: "indigo-paints", brandName: "Indigo Paints", name: "Snow Cream", code: "IP-CUR-001", hex: "#F5EEDC", category: "Whites & Creams" },
  { brandId: "indigo-paints", brandName: "Indigo Paints", name: "Linen Beige", code: "IP-CUR-002", hex: "#E2D1B6", category: "Beige & Taupe" },
  { brandId: "indigo-paints", brandName: "Indigo Paints", name: "Clay Beige", code: "IP-CUR-003", hex: "#C8AA87", category: "Beige & Taupe" },
  { brandId: "indigo-paints", brandName: "Indigo Paints", name: "Stone Grey", code: "IP-CUR-004", hex: "#A8A59A", category: "Greys" },
  { brandId: "indigo-paints", brandName: "Indigo Paints", name: "Herbal Green", code: "IP-CUR-005", hex: "#8FA084", category: "Greens" },
  { brandId: "indigo-paints", brandName: "Indigo Paints", name: "Skyline Blue", code: "IP-CUR-006", hex: "#8BB5CA", category: "Blues" },
  { brandId: "indigo-paints", brandName: "Indigo Paints", name: "Rustic Red", code: "IP-CUR-007", hex: "#A85845", category: "Earth & Accent" },
  { brandId: "indigo-paints", brandName: "Indigo Paints", name: "Peach Bloom", code: "IP-CUR-008", hex: "#D7A38C", category: "Pinks & Mauves" },
];

export function shadesForBrand(brandId: PaintBrandId) {
  return PAINT_SHADES.filter(shade => shade.brandId === brandId);
}

export function colorLabel(shade: PaintShade) {
  return `${shade.brandName} ${shade.name} ${shade.code}`;
}
