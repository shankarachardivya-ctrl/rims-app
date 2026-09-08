/**
 * Verifies the pure helper logic inside google-apps-script/Migration.gs
 * against real values taken from the Real3D workbook.
 *
 * Apps Script APIs are stubbed; only the data-transformation functions run.
 *
 * Run: node scripts/test-migration-logic.cjs
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const src = fs.readFileSync(
  path.join(__dirname, '..', 'google-apps-script', 'Migration.gs'), 'utf8'
)

// Stub the Apps Script globals the file references at load time
const sandbox = {
  Logger: { log: () => {} },
  SpreadsheetApp: { getActiveSpreadsheet: () => { throw new Error('not used') } },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  console,
}
vm.createContext(sandbox)
vm.runInContext(src, sandbox)

let pass = 0, fail = 0
function eq(name, actual, expected) {
  const ok = actual === expected
  if (ok) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name} -> got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`) }
}

const { inferCategory_, normaliseWeight_, toNumber_, bool01_, stockStatus_, titleCase_, normHeader_, indexOfAny_ } = sandbox

console.log('\n=== Category inference (real Products rows) ===')
// The dirty row: Material blank, "ABS LIKE PRO" sat in the Color column
eq('blank material + "ABS LIKE PRO" -> Resin', inferCategory_('', 'ABS LIKE PRO'), 'Resin')
eq('"ABS-Like Resin" -> Resin',                inferCategory_('ABS-Like Resin', 'Grey'), 'Resin')
eq('"Standard Resin" -> Resin',                inferCategory_('Standard Resin', 'Clear'), 'Resin')
eq('"Water-Washable" -> Resin',                inferCategory_('Water-Washable Resin', 'Black'), 'Resin')
eq('"Dental" -> Resin',                        inferCategory_('Dental Resin', 'Beige'), 'Resin')
// Real filament rows from the sheet
eq('"PLA Pro" / Apricot skin -> Filament',     inferCategory_('PLA Pro', 'Apricot skin'), 'Filament')
eq('"PLA+" / Black -> Filament',               inferCategory_('PLA+', 'Black'), 'Filament')
eq('"PLA Pro" / Bahama Yellow -> Filament',    inferCategory_('PLA Pro', 'Bahama Yellow'), 'Filament')
eq('"PETG" -> Filament',                       inferCategory_('PETG', 'Blue'), 'Filament')
eq('"TPU" -> Filament',                        inferCategory_('TPU', 'Red'), 'Filament')
// Guard: real ABS filament must NOT be misread as resin
eq('plain "ABS" stays Filament',               inferCategory_('ABS', 'White'), 'Filament')
eq('"ASA" stays Filament',                     inferCategory_('ASA', 'Black'), 'Filament')

console.log('\n=== Weight normalisation ("1kg" text -> number) ===')
eq('"1kg" -> 1',      normaliseWeight_('1kg'), 1)
eq('"1 kg" -> 1',     normaliseWeight_('1 kg'), 1)
eq('"1KG" -> 1',      normaliseWeight_('1KG'), 1)
eq('"0.5kg" -> 0.5',  normaliseWeight_('0.5kg'), 0.5)
eq('"2.5 KG" -> 2.5', normaliseWeight_('2.5 KG'), 2.5)
eq('numeric 1 kept',  normaliseWeight_(1), 1)
eq('blank -> 1',      normaliseWeight_(''), 1)
eq('null -> 1',       normaliseWeight_(null), 1)

console.log('\n=== Numeric coercion (Reorder_Level came through as "5.0") ===')
eq('"5.0" -> 5',    toNumber_('5.0', 99), 5)
eq('"4.0" -> 4',    toNumber_('4.0', 99), 4)
eq('"1699.0" -> 1699', toNumber_('1699.0', 0), 1699)
eq('"1,699" -> 1699',  toNumber_('1,699', 0), 1699)
eq('blank -> default', toNumber_('', 5), 5)
eq('garbage -> default', toNumber_('abc', 7), 7)

console.log('\n=== Permission flag coercion ===')
eq('"1" -> 1',    bool01_('1'), 1)
eq('"0" -> 0',    bool01_('0'), 0)
eq('1 -> 1',      bool01_(1), 1)
eq('0 -> 0',      bool01_(0), 0)
eq('true -> 1',   bool01_(true), 1)
eq('false -> 0',  bool01_(false), 0)
eq('"TRUE" -> 1', bool01_('TRUE'), 1)
eq('"yes" -> 1',  bool01_('yes'), 1)
eq('blank -> 0',  bool01_(''), 0)

console.log('\n=== Stock status thresholds ===')
eq('0 of 5 -> Out of Stock',  stockStatus_(0, 5), 'Out of Stock')
eq('-1 -> Out of Stock',      stockStatus_(-1, 5), 'Out of Stock')
eq('3 of 5 -> Low Stock',     stockStatus_(3, 5), 'Low Stock')
eq('4 of 5 -> Low Stock',     stockStatus_(4, 5), 'Low Stock')
eq('5 of 5 -> In Stock',      stockStatus_(5, 5), 'In Stock')
eq('9 of 5 -> In Stock',      stockStatus_(9, 5), 'In Stock')

console.log('\n=== Role normalisation ===')
eq('"Admin" -> Admin', titleCase_('Admin'), 'Admin')
eq('"ADMIN" -> Admin', titleCase_('ADMIN'), 'Admin')
eq('"admin" -> Admin', titleCase_('admin'), 'Admin')

console.log('\n=== Header matching (tolerates the sheet\'s casing) ===')
eq('"Reorder_Level" normalises', normHeader_('Reorder_Level'), 'reorder_level')
eq('"Reorder_level" normalises', normHeader_('Reorder_level'), 'reorder_level')
eq('"After_stock" normalises',   normHeader_('After_stock'), 'after_stock')
eq('"Can_Remove_Stock" found as stock-out',
  indexOfAny_(['email','name','role','can_stock_in','can_remove_stock','active'],
              ['can_stock_out', 'can_remove_stock']), 4)
eq('missing column -> -1',
  indexOfAny_(['email','name'], ['can_sell']), -1)

console.log(`\n──────────────────────────────`)
console.log(`  ${pass} passed, ${fail} failed`)
console.log(`──────────────────────────────\n`)
process.exit(fail === 0 ? 0 : 1)
