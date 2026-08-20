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
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Raw Jute", code: "ML151", hex: "#FFFDD0", category: "Whites & Off Whites" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Ice Age", code: "M8299", hex: "#FFFDD0", category: "Whites & Off Whites" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Butter Cream", code: "M5184", hex: "#FFFDD0", category: "Creams & Neutrals" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Old Lace", code: "M0950", hex: "#FDF5E6", category: "Whites & Off Whites" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Cream Pie", code: "L152", hex: "#F6F3E8", category: "Creams & Neutrals" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Pipe Dream", code: "L154", hex: "#F6F3E7", category: "Whites & Off Whites" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Blank Canvas", code: "7932", hex: "#F7F2E3", category: "Whites & Off Whites" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Absolute White", code: "L161", hex: "#F3F2EC", category: "Whites & Off Whites" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Pale Sisal", code: "L155", hex: "#F5F2E6", category: "Creams & Neutrals" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Soft Honey", code: "7876", hex: "#F7F2DE", category: "Soft Yellows" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Sonnet", code: "L146", hex: "#F7F1E7", category: "Whites & Off Whites" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Firefly Flicker", code: "7916", hex: "#F6F2DF", category: "Soft Yellows" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Sun Screen", code: "7868", hex: "#F7F2DA", category: "Soft Yellows" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Sugared Nut", code: "L126", hex: "#F8F1DF", category: "Creams & Neutrals" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "White Cameo", code: "L145", hex: "#F7F0E6", category: "Whites & Off Whites" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Rain Drop", code: "L143", hex: "#F5F0E7", category: "Whites & Off Whites" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Pressed Linen", code: "L150", hex: "#F6F0E3", category: "Whites & Off Whites" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Powder Puff", code: "7972", hex: "#F6F0E1", category: "Whites & Off Whites" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Soft Linen", code: "7884", hex: "#F9F0D8", category: "Creams & Neutrals" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Crescent", code: "7948", hex: "#F7F0DD", category: "Creams & Neutrals" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Candle Light", code: "7900", hex: "#F7F0D7", category: "Creams & Neutrals" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Liquid Light", code: "7915", hex: "#FAEFD3", category: "Soft Yellows" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Moonlight", code: "L121", hex: "#F3EFDC", category: "Whites & Off Whites" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Crystal Peak", code: "L105", hex: "#F2EEE3", category: "Whites & Off Whites" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Pure Ivory", code: "L124", hex: "#F3EEDD", category: "Creams & Neutrals" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Vanilla Ice", code: "7836", hex: "#F3EEDA", category: "Creams & Neutrals" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Lap Of Himalaya", code: "L186", hex: "#E8E8E2", category: "Light Greys" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Sheer Ice", code: "L111", hex: "#E4E8E1", category: "Light Greys" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Iced Silver", code: "8236", hex: "#E7E4DF", category: "Light Greys" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Ice Grey", code: "8259", hex: "#E0E0DC", category: "Light Greys" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Sky Mimic", code: "7420", hex: "#E7EBE5", category: "Soft Blues" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Snow Princess", code: "7332", hex: "#E2EAE7", category: "Soft Blues" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Winter Morn", code: "7228", hex: "#E4E5E4", category: "Soft Blues" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Oceans Whisper", code: "7436", hex: "#CFE6E5", category: "Soft Blues" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Light Sky", code: "7331", hex: "#C4DEE8", category: "Soft Blues" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Tinted Pista-N", code: "9817", hex: "#EFF3D4", category: "Soft Greens" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Gossamer Green-N", code: "9801", hex: "#EDF1D7", category: "Soft Greens" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Green Dawn-N", code: "9786", hex: "#E6F2D0", category: "Soft Greens" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Mint Frosting-N", code: "9758", hex: "#DEF0DB", category: "Soft Greens" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Quiet Lake", code: "7572", hex: "#E4EDE1", category: "Soft Greens" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Pearly Pink", code: "9412", hex: "#F6EBE5", category: "Soft Pinks & Mauves" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Pale Blush", code: "8132", hex: "#F4E8E7", category: "Soft Pinks & Mauves" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Paradise Light-N", code: "K256", hex: "#F6E5DB", category: "Soft Pinks & Mauves" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Pink Mist", code: "8092", hex: "#F7E2E0", category: "Soft Pinks & Mauves" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Delicate Pink", code: "9427", hex: "#F2E2E8", category: "Soft Pinks & Mauves" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Stratos-N", code: "9645", hex: "#DFE6EE", category: "Soft Pinks & Mauves" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Grape Delight", code: "8220", hex: "#E9E3DD", category: "Soft Pinks & Mauves" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Natural Beauty", code: "7212", hex: "#E3E3E6", category: "Soft Pinks & Mauves" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Light Butter-N", code: "L189", hex: "#E7D5B9", category: "Creams & Neutrals" },
  { brandId: "asian-paints", brandName: "Asian Paints", name: "Twilight Hush", code: "0944", hex: "#E9DBD1", category: "Creams & Neutrals" },

  { brandId: "berger-paints", brandName: "Berger Paints", name: "Savvy White", code: "3P1843", hex: "#F0EFE7", category: "Whites & Off Whites" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Powder Puff", code: "3P1845", hex: "#EFF0EC", category: "Whites & Off Whites" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "White Swan", code: "2P1847", hex: "#F2EEE5", category: "Whites & Off Whites" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Steamed Milk", code: "7P1545", hex: "#EEEADB", category: "Whites & Off Whites" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Blinking Eyes", code: "7P2412", hex: "#EFEAD9", category: "Whites & Off Whites" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Morning Rays", code: "3P1853", hex: "#F1EDE3", category: "Whites & Off Whites" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Frothy Milk", code: "3P1855", hex: "#F1EBDB", category: "Whites & Off Whites" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Pale Ale", code: "2P1857", hex: "#F4F1E7", category: "Whites & Off Whites" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Cream Froth", code: "3P1861", hex: "#F4F0E3", category: "Whites & Off Whites" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Bonita", code: "3P1864", hex: "#F1EDDC", category: "Whites & Off Whites" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Southern Plantation", code: "8P1689", hex: "#E1E0DC", category: "Creams & Neutrals" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "White Sphere", code: "8P2679", hex: "#E4E3DE", category: "Creams & Neutrals" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Flying Seagull", code: "8P1959", hex: "#DEDEDB", category: "Creams & Neutrals" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Snow Fort", code: "8P2687", hex: "#E0DFDA", category: "Creams & Neutrals" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Woven Scarf", code: "8P1958", hex: "#E4E1DE", category: "Creams & Neutrals" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Snow Top", code: "8P1721", hex: "#DFDAD5", category: "Creams & Neutrals" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Milk Moustache", code: "8P1697", hex: "#E2E1DA", category: "Creams & Neutrals" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Starry White", code: "7P1956", hex: "#E9E4DC", category: "Creams & Neutrals" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Versailles", code: "8T1691", hex: "#CCCDC9", category: "Light Greys" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Topsail", code: "8P0204", hex: "#CECDC6", category: "Light Greys" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Galactica", code: "8T2689", hex: "#C9CAC7", category: "Light Greys" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Snow Bits", code: "8P0205", hex: "#CFD0CF", category: "Light Greys" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Tuxe White", code: "8P2698", hex: "#DBDDDB", category: "Light Greys" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "White City", code: "3P0081", hex: "#EBEEEE", category: "Light Greys" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Windy Autumn", code: "8T3009", hex: "#CFCFCF", category: "Light Greys" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "White Glove", code: "3P0057", hex: "#FCF2DC", category: "Soft Yellows" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Santa Fe Sun", code: "2T0683", hex: "#FFE7B8", category: "Soft Yellows" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Nirvana", code: "2P2055", hex: "#FCF0D1", category: "Soft Yellows" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Warm Croissant", code: "2P2067", hex: "#F6EAD2", category: "Soft Yellows" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Ice Pavilion", code: "2P2059", hex: "#F6ECD4", category: "Soft Yellows" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "A Blessing", code: "3P0050", hex: "#FFF0D9", category: "Soft Yellows" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Blue Bead", code: "5P2223", hex: "#DBEDEC", category: "Soft Blues" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "South Bay", code: "5P1033", hex: "#CCE3E3", category: "Soft Blues" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Follow The Tradewinds", code: "5P1041", hex: "#C9E3E4", category: "Soft Blues" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Fly Away", code: "5P2892", hex: "#CFE7E6", category: "Soft Blues" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Crystalline", code: "5P2240", hex: "#CDE2E2", category: "Soft Blues" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Playful Touch", code: "5P2228", hex: "#DAE5E6", category: "Soft Blues" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Pearl Blue", code: "5P2230", hex: "#CEE4EA", category: "Soft Blues" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Soft As Silk", code: "3P0085", hex: "#EFF0D9", category: "Soft Greens" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Young Bud", code: "4P2123", hex: "#E3EED5", category: "Soft Greens" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Misty Vale", code: "4P0092", hex: "#DFECD8", category: "Soft Greens" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Youthful", code: "4P2135", hex: "#DBEFDA", category: "Soft Greens" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Diva Mint", code: "4P0273", hex: "#DDEEE1", category: "Soft Greens" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Quiet Morning", code: "4P2145", hex: "#E0EDE0", category: "Soft Greens" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Falling For Green", code: "4P2152", hex: "#D5EEDC", category: "Soft Greens" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Graceful", code: "1P2823", hex: "#F3E6E5", category: "Soft Pinks & Peaches" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Irish Ribbon", code: "1P1964", hex: "#F4E8E9", category: "Soft Pinks & Peaches" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Raine Pink", code: "1P2828", hex: "#F5EDEA", category: "Soft Pinks & Peaches" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "Pink Tint", code: "1P0019", hex: "#EFDFD6", category: "Soft Pinks & Peaches" },
  { brandId: "berger-paints", brandName: "Berger Paints", name: "French Knot", code: "1P1995", hex: "#EFE4D9", category: "Soft Pinks & Peaches" },

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
