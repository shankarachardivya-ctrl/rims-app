/**
 * SKU extraction from OCR text.
 *
 * Real-world filament labels (e.g. numakers) use continuous alphanumeric SKUs
 * with NO dashes, such as `PPNA11KPAL` / `PPNA11KPAR`. Some other brands use
 * dashed codes like `PLA-B-RED`. Both must be supported.
 *
 * This module is dependency-free so it can be unit tested in isolation.
 */

export interface SkuCandidate {
  value: string
  score: number
  /** 'labelled' = found next to a "SKU" caption, 'pattern' = shape match, 'barcode' = EAN/UPC digits */
  kind: 'labelled' | 'pattern' | 'barcode'
}

/** Words that look SKU-ish in shape but are never SKUs. */
const STOPWORDS = new Set([
  // materials / product words
  'PLA', 'PLA+', 'ABS', 'PETG', 'TPU', 'ASA', 'PVA', 'HIPS', 'NYLON', 'RESIN',
  'POLYLACTIC', 'ACID', 'FILAMENT', 'PRINTING', 'INSTRUCTION', 'INSTRUCTIONS',
  'PRINT', 'SPEED', 'NOZZLE', 'TEMP', 'TEMPERATURE', 'BED', 'DIAMETER',
  'TOLERANCE', 'WEIGHT', 'NET', 'COLOR', 'COLOUR', 'BATCH', 'SKU', 'QTY',
  // descriptors
  'PURE', 'WHITE', 'BLACK', 'ROYAL', 'BLUE', 'RED', 'GREEN', 'GREY', 'GRAY',
  'YELLOW', 'ORANGE', 'NATURAL', 'TRANSPARENT', 'SILVER', 'GOLD',
  // brand / contact
  'NUMAKERS', 'BAMBU', 'ESUN', 'ANYCUBIC', 'CREALITY', 'MADE', 'INDIA', 'CHINA',
  'WWW', 'COM', 'HTTP', 'HTTPS', 'SUPPORT', 'EMAIL', 'MAIL', 'INQUIRIES',
  'E-MAIL', 'E-MAILS', 'WEB-SITE', 'IN-INDIA',
  'TECHNICAL', 'PRODUCT', 'INFO', 'VISIT', 'MORE', 'CONTACT',
  // units
  'KG', 'GRAM', 'GRAMS', 'MM', 'CM', 'ML', 'PCS',
])

/** Pure measurement / unit tokens, e.g. 1KG, 1.75MM, 200C, 250MM. */
const UNIT_RE = /^\d+(?:[.,]\d+)?(?:KG|G|MM|CM|ML|MMS|C|F)?$/
/** Temperature or numeric ranges, e.g. 200-230, 30-60. */
const NUMERIC_RANGE_RE = /^\d+[-–]\d+$/
/** EAN-8 / UPC-12 / EAN-13 / ITF-14 barcode digit strings. */
const BARCODE_RE = /^\d{8}$|^\d{12,14}$/

/**
 * Normalise OCR output: unify unicode dashes, strip zero-width chars,
 * and uppercase for matching.
 */
function normalise(text: string): string {
  return text
    .replace(/[\u2010-\u2015\u2212]/g, '-')  // various dashes -> hyphen
    .replace(/[\u200B-\u200D\uFEFF]/g, '')   // zero-width
    .replace(/[|]/g, 'I')                    // common OCR bar/pipe -> I
    .toUpperCase()
}

/** Trim punctuation that OCR commonly glues onto tokens. */
function trimToken(raw: string): string {
  return raw.replace(/^[^A-Z0-9]+/, '').replace(/[^A-Z0-9+]+$/, '')
}

function hasLetter(s: string): boolean { return /[A-Z]/.test(s) }
function hasDigit(s: string): boolean { return /\d/.test(s) }

/**
 * Score how likely a token is to be a product SKU.
 * Returns 0 when the token should be rejected outright.
 */
function scoreToken(token: string, line: string): number {
  if (token.length < 5 || token.length > 24) return 0
  if (STOPWORDS.has(token)) return 0
  if (UNIT_RE.test(token)) return 0
  if (NUMERIC_RANGE_RE.test(token)) return 0
  // Reject anything that is not uppercase alnum with optional dashes
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(token)) return 0

  const letters = (token.match(/[A-Z]/g) ?? []).length
  const digits  = (token.match(/\d/g) ?? []).length

  // Pure digits are barcodes, not SKUs
  if (letters === 0) return 0
  // Pure letters of moderate length are usually words, not SKUs
  if (digits === 0 && !token.includes('-')) return 0

  let score = 40

  // Mixed letters + digits is the classic SKU signature
  if (letters > 0 && digits > 0) score += 25
  // Dashed codes are also common SKU shapes
  if (token.includes('-') && hasLetter(token)) score += 15
  // Sweet spot length
  if (token.length >= 8 && token.length <= 14) score += 15
  // Starting with letters is far more typical than starting with a digit
  if (/^[A-Z]{2,}/.test(token)) score += 15
  else if (/^\d/.test(token)) score -= 25

  // Batch/lot numbers are long, digit-heavy, and captioned as such
  if (/\bBATCH\b|\bLOT\b/.test(line)) score -= 45
  if (token.length > 16) score -= 15
  if (digits > letters * 2) score -= 15

  return score > 0 ? score : 0
}

/**
 * Extract ranked SKU candidates from raw OCR text.
 * Highest confidence first.
 */
export function extractSkuCandidates(rawText: string): SkuCandidate[] {
  const text  = normalise(rawText)
  const lines = text.split(/\r?\n/)

  const best = new Map<string, SkuCandidate>()
  const offer = (value: string, score: number, kind: SkuCandidate['kind']) => {
    if (!value) return
    const prev = best.get(value)
    if (!prev || score > prev.score) best.set(value, { value, score, kind })
  }

  for (const line of lines) {
    // 1) Explicit "SKU" caption — strongest signal.
    //    Handles "SKU : PPNA11KPAR", "Sku PPNA11KPAL", "SKU- PPNA11KPAR".
    //    The caption and value are sometimes split across columns, so we scan
    //    every SKU occurrence on the line.
    const labelRe = /\bSKU\b\s*[:\-.]?\s*([A-Z0-9][A-Z0-9-]{3,})/g
    let m: RegExpExecArray | null
    while ((m = labelRe.exec(line)) !== null) {
      const tok = trimToken(m[1])
      if (tok && !STOPWORDS.has(tok) && hasLetter(tok)) {
        offer(tok, 100 + (hasDigit(tok) ? 10 : 0), 'labelled')
      }
    }

    // 2) Shape-based candidates from every token on the line.
    for (const rawTok of line.split(/[\s,;:()[\]{}<>"'=]+/)) {
      // Batch numbers often carry a slash suffix: 0526P18W48PAR1608/5
      for (const part of rawTok.split('/')) {
        const tok = trimToken(part)
        if (!tok) continue

        if (BARCODE_RE.test(tok)) {
          offer(tok, 30, 'barcode')
          continue
        }
        const s = scoreToken(tok, line)
        if (s > 0) offer(tok, s, 'pattern')
      }
    }
  }

  return Array.from(best.values()).sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))
}

/** Convenience: just the ranked candidate strings. */
export function extractTokens(rawText: string): string[] {
  return extractSkuCandidates(rawText).map((c) => c.value)
}

/**
 * OCR frequently confuses these glyph pairs. Generate plausible alternate
 * readings so a failed lookup can be retried before giving up.
 * Capped to keep the number of network lookups small.
 */
export function skuVariants(sku: string, limit = 8): string[] {
  const swaps: Array<[RegExp, string]> = [
    [/O/g, '0'], [/0/g, 'O'],
    [/I/g, '1'], [/1/g, 'I'],
    [/S/g, '5'], [/5/g, 'S'],
    [/B/g, '8'], [/8/g, 'B'],
    [/Z/g, '2'], [/2/g, 'Z'],
  ]
  const out = new Set<string>([sku])
  for (const [re, to] of swaps) {
    if (out.size >= limit) break
    if (re.test(sku)) out.add(sku.replace(re, to))
  }
  return Array.from(out)
}
