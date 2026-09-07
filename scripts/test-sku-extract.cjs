/**
 * Verification harness for the OCR SKU extractor.
 * Uses realistic OCR transcripts of the two numakers labels supplied by the user,
 * including typical OCR noise (glyph confusion, column bleed, stray punctuation).
 *
 * Run:  node scripts/test-sku-extract.cjs
 */
const path = require('path')
const { extractSkuCandidates, extractTokens, skuVariants } = require(
  path.join(__dirname, '..', '.tmp-test', 'skuExtract.cjs')
)

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' -> ' + detail : ''}`) }
}

// ── Label 1: Royal Blue PLA+, rotated 90deg, SKU printed as "SKU : PPNA11KPAR"
const LABEL1 = `
numakers
3D PRINTING FILAMENT
PLA+
Color : Royal Blue
Net Weight : 1 Kg
Tolerance : +/- 0.03 mm
Batch No : 0526P18W48PAR1608/5   O 1.75 mm
PRINTING INSTRUCTION
Nozzle Temp : 200-230 °C
Bed Temp : 30-60 °C
Printing Speed : <250 mm/s
For more product info, visit us :
www.numakers.com
SKU : PPNA11KPAR
Made in India
For inquiries or technical support e-mail us
support@numakers.com
PPNA11KPAR
`

// ── Label 2: Pure White PLA+, upright, "Sku  PPNA11KPAL", EAN-13 barcode
const LABEL2 = `
PLA+
Polylactic Acid
Pure White
Sku            PPNA11KPAL
Net Weight     1 kg
Diameter       O 1.75 mm +-0.03 mm
Printing Temp  200-230 °C
Bed Temp       30-60 °C
Print Speed    <250 mm/s
numakers       www.numakers.com
               Made in India
8906216210115
`

// ── Noisy variant: caption lost, glyph confusion, no explicit "SKU" label
const LABEL_NOISY = `
PLA+ Polylactic Acid
Pure White
PPNA11KPAL
Net Weight 1 kg
8906216210115
`

// ── Legacy dashed SKU format (other brands / existing demo data)
const LABEL_DASHED = `
PLA Pro Nuclear Red
SKU: PLA-A11-KPAH
Net Weight 1 Kg
`

console.log('\n=== Label 1 (Royal Blue, SKU PPNA11KPAR) ===')
{
  const cands = extractSkuCandidates(LABEL1)
  const tokens = cands.map((c) => c.value)
  console.log('  ranked:', tokens.slice(0, 6).join(', '))
  check('top candidate is PPNA11KPAR', tokens[0] === 'PPNA11KPAR', `got ${tokens[0]}`)
  check('PPNA11KPAR marked as labelled', cands[0] && cands[0].kind === 'labelled', cands[0] && cands[0].kind)
  check('batch number not ranked above SKU',
    tokens.indexOf('PPNA11KPAR') < (tokens.indexOf('0526P18W48PAR1608') === -1 ? 99 : tokens.indexOf('0526P18W48PAR1608')))
  check('no material word PLA as candidate', !tokens.includes('PLA') && !tokens.includes('PLA+'))
  check('no unit token 1KG', !tokens.includes('1KG'))
  check('no temp range 200-230', !tokens.includes('200-230'))
  check('no brand NUMAKERS', !tokens.includes('NUMAKERS'))
  check('no INSTRUCTION word', !tokens.includes('INSTRUCTION'))
}

console.log('\n=== Label 2 (Pure White, SKU PPNA11KPAL, EAN-13) ===')
{
  const cands = extractSkuCandidates(LABEL2)
  const tokens = cands.map((c) => c.value)
  console.log('  ranked:', tokens.slice(0, 6).join(', '))
  check('top candidate is PPNA11KPAL', tokens[0] === 'PPNA11KPAL', `got ${tokens[0]}`)
  check('EAN-13 detected as barcode kind',
    cands.some((c) => c.value === '8906216210115' && c.kind === 'barcode'))
  check('EAN-13 ranked below SKU',
    tokens.indexOf('PPNA11KPAL') < tokens.indexOf('8906216210115'))
  check('no POLYLACTIC / ACID', !tokens.includes('POLYLACTIC') && !tokens.includes('ACID'))
  check('no PURE / WHITE', !tokens.includes('PURE') && !tokens.includes('WHITE'))
  check('no diameter 1.75', !tokens.some((t) => t.includes('1.75')))
}

console.log('\n=== Noisy label (no SKU caption) ===')
{
  const tokens = extractTokens(LABEL_NOISY)
  console.log('  ranked:', tokens.slice(0, 6).join(', '))
  check('still finds PPNA11KPAL', tokens.includes('PPNA11KPAL'))
  check('PPNA11KPAL ranked first', tokens[0] === 'PPNA11KPAL', `got ${tokens[0]}`)
}

console.log('\n=== Legacy dashed SKU format ===')
{
  const tokens = extractTokens(LABEL_DASHED)
  console.log('  ranked:', tokens.slice(0, 6).join(', '))
  check('finds PLA-A11-KPAH', tokens.includes('PLA-A11-KPAH'), tokens.join(','))
  check('PLA-A11-KPAH ranked first', tokens[0] === 'PLA-A11-KPAH', `got ${tokens[0]}`)
}

console.log('\n=== OCR glyph-confusion variants ===')
{
  const v = skuVariants('PPNA11KPAL')
  console.log('  variants:', v.join(', '))
  check('includes original', v.includes('PPNA11KPAL'))
  check('generates I->1 / 1->I alternative', v.some((x) => x !== 'PPNA11KPAL'))
  check('variant count capped', v.length <= 8, String(v.length))
}

console.log('\n=== Regression: OLD regex behaviour (why it failed) ===')
{
  const oldPattern = /\b[A-Z]{2,}[-][A-Z0-9]{1,}([-][A-Z0-9]{1,})*/g
  const old1 = LABEL1.toUpperCase().match(oldPattern) || []
  const old2 = LABEL2.toUpperCase().match(oldPattern) || []
  console.log('  old regex on label1:', JSON.stringify(old1))
  console.log('  old regex on label2:', JSON.stringify(old2))
  check('old regex MISSED PPNA11KPAR (confirms the bug)', !old1.includes('PPNA11KPAR'))
  check('old regex MISSED PPNA11KPAL (confirms the bug)', !old2.includes('PPNA11KPAL'))
}

console.log(`\n──────────────────────────────`)
console.log(`  ${pass} passed, ${fail} failed`)
console.log(`──────────────────────────────\n`)
process.exit(fail === 0 ? 0 : 1)
