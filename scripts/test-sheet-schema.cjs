/**
 * Verifies src/lib/sheetSchema.ts against real rows from the Real3D workbook.
 *
 * Run: npm run test:schema
 */
const path = require('path')
const S = require(path.join(__dirname, '..', '.tmp-test', 'sheetSchema.cjs'))

let pass = 0, fail = 0
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected)
  if (a === b) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}\n          got  ${a}\n          want ${b}`) }
}
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' -> ' + detail : ''}`) }
}

// ── Real header + rows, post-migration shape ────────────────────────────────
const P_HDR = [...S.PRODUCTS_COLUMNS]
const P_ROW_FILAMENT = ['PLNA11KPAQ','Filament','PLA Pro','Apricot skin','Numakers',1,1.75,5,'Main','A','1','B','',0,0,1699,'Active']
const P_ROW_RESIN    = ['ONYX-ABSLP-001','Resin','ABS-Like Resin','Grey','Onyx',1,'',5,'Main','','','','',0,0,0,'Active']

console.log('\n=== Products: row -> domain ===')
{
  const p = S.productFromRow(P_HDR, P_ROW_FILAMENT)
  eq('sku', p.sku, 'PLNA11KPAQ')
  eq('category', p.category, 'filament')
  eq('material', p.material, 'PLA Pro')
  eq('color', p.color, 'Apricot skin')
  eq('weightKg', p.weightKg, 1)
  eq('diameter', p.diameter, 1.75)
  eq('minStock from Reorder_Level', p.minStock, 5)
  eq('mrp', p.mrp, 1699)
  eq('status', p.status, 'active')
  eq('currentStock starts 0 (joined later)', p.currentStock, 0)

  const r = S.productFromRow(P_HDR, P_ROW_RESIN)
  eq('resin category', r.category, 'resin')
  eq('blank diameter -> undefined', r.diameter, undefined)
}

console.log('\n=== Products: pre-migration rows (old 6-column shape) ===')
{
  // The sheet as it exists today: text weight, "5.0" reorder, no Category
  const OLD_HDR = ['SKU','Material','Color','Brand','Weight_kg','Reorder_Level']
  const p = S.productFromRow(OLD_HDR, ['PLNA11KPAH','PLA Pro','Atomic Pink','Numakers','1kg','5.0'])
  eq('"1kg" text -> 1', p.weightKg, 1)
  eq('"5.0" -> 5', p.minStock, 5)
  eq('category inferred when column absent', p.category, 'filament')

  // The dirty row: "ABS LIKE PRO" sitting in Color
  const d = S.productFromRow(OLD_HDR, ['328','','ABS LIKE PRO','ONYX','1kg','5.0'])
  eq('dirty row inferred as resin', d.category, 'resin')

  ok('row with no SKU is rejected',
    S.productFromRow(OLD_HDR, ['','PLA','Red','X','1kg','5']) === null)
}

console.log('\n=== Products: round trip ===')
{
  const p = S.productFromRow(P_HDR, P_ROW_FILAMENT)
  const row = S.productToRow(p)
  eq('column count matches header', row.length, S.PRODUCTS_COLUMNS.length)
  const back = S.productFromRow(P_HDR, row)
  eq('sku survives', back.sku, p.sku)
  eq('category survives', back.category, p.category)
  eq('minStock survives', back.minStock, p.minStock)
  eq('mrp survives', back.mrp, p.mrp)
  eq('Category written in sheet casing', row[1], 'Filament')
}

console.log('\n=== Sheets serial dates ===')
{
  // 46202.58194444444 is a real Timestamp value from the Transactions tab
  const d = S.serialToDate(46202.58194444444)
  ok('46202.58 lands in 2026', d.getUTCFullYear() === 2026, String(d.toISOString()))
  const round = S.dateToSerial(d)
  ok('serial round trips', Math.abs(round - 46202.58194444444) < 1e-6, String(round))

  ok('parseSheetDate handles a serial number', S.parseSheetDate(46202.5) instanceof Date)
  ok('parseSheetDate handles a serial string', S.parseSheetDate('46202.5') instanceof Date)
  ok('parseSheetDate handles ISO', S.parseSheetDate('2026-09-04T10:30:00Z') instanceof Date)
  eq('parseSheetDate blank -> null', S.parseSheetDate(''), null)
  eq('parseSheetDate null -> null', S.parseSheetDate(null), null)

  const known = new Date(2026, 8, 4, 14, 30, 5)
  eq('toDatePart', S.toDatePart(known), '2026-09-04')
  eq('toTimePart', S.toTimePart(known), '14:30:05')
}

console.log('\n=== Transaction type mapping (sheet spellings) ===')
{
  eq('Stock In',        S.transactionTypeFromSheet('Stock In'), 'stock_in')
  eq('Sale',            S.transactionTypeFromSheet('Sale'), 'sale')
  eq('Internal Usage',  S.transactionTypeFromSheet('Internal Usage'), 'internal_use')
  eq('Internal Use too', S.transactionTypeFromSheet('Internal Use'), 'internal_use')
  eq('lowercase/underscore', S.transactionTypeFromSheet('stock_in'), 'stock_in')
  eq('writes "Internal Usage"', S.TRANSACTION_TYPE_TO_SHEET.internal_use, 'Internal Usage')
  eq('writes "Stock In"', S.TRANSACTION_TYPE_TO_SHEET.stock_in, 'Stock In')
}

console.log('\n=== Transactions: row -> domain, both timestamp positions ===')
{
  const T_HDR = [...S.TRANSACTIONS_COLUMNS]
  // Newer real row shape: timestamp in column 11
  const t = S.transactionFromRow(T_HDR,
    ['TXN-1785078002164','PLSK11KPBA','Stock In',2,'inventory.real3d@gmail.com',
     '', 0, 2, 'Scanned Barcode Entry', '', 46229.85418981482, 'first receipt'])
  eq('id', t.transactionId, 'TXN-1785078002164')
  eq('type', t.transactionType, 'stock_in')
  eq('qty', t.quantity, 2)
  eq('before', t.stockBefore, 0)
  eq('after', t.stockAfter, 2)
  eq('inputType', t.inputType, 'Scanned Barcode Entry')
  eq('remarks', t.remarks, 'first receipt')
  ok('timestamp parsed from col 11', t.timestamp !== '' && t.date !== '', t.timestamp)

  // Legacy row shape: timestamp in column 6 only
  const legacy = S.transactionFromRow(T_HDR,
    ['7c8d7ef2','PLNA11KPCR','Stock In',3,'inventory.real3d@gmail.com', 46202.58194444444])
  ok('timestamp parsed from col 6 fallback', legacy.timestamp !== '', legacy.timestamp)
  eq('legacy type', legacy.transactionType, 'stock_in')
}

console.log('\n=== Transactions: write layout ===')
{
  const row = S.transactionToRow({
    transactionId: 'TXN-1', timestamp: new Date(2026, 8, 4, 12, 0, 0).toISOString(),
    date: '', time: '', sku: 'PPNA11KPAL', productName: '',
    transactionType: 'sale', quantity: 2, stockBefore: 10, stockAfter: 8,
    userId: 'a@b.com', userName: 'A', inputType: S.INPUT_TYPE.ocr, remarks: 'note',
  })
  eq('column count', row.length, S.TRANSACTIONS_COLUMNS.length)
  eq('type written in sheet spelling', row[2], 'Sale')
  eq('column 10 stays blank', row[9], '')
  eq('timestamp written to col 6', row[5], '2026-09-04 12:00:00')
  eq('timestamp written to col 11', row[10], '2026-09-04 12:00:00')
  ok('both timestamps identical', row[5] === row[10])
  eq('remarks in col 12', row[11], 'note')
  ok('all cells are JSON primitives (REST requirement)',
    row.every((c) => c === null || ['string', 'number', 'boolean'].includes(typeof c)),
    JSON.stringify(row))
}

console.log('\n=== Stock maths ===')
{
  eq('stock in adds',      S.stockDelta('stock_in', 5), 5)
  eq('sale subtracts',     S.stockDelta('sale', 3), -3)
  eq('internal subtracts', S.stockDelta('internal_use', 2), -2)

  const led = [
    { sku: 'PPNA11KPAL', transactionType: 'stock_in', quantity: 10 },
    { sku: 'PPNA11KPAL', transactionType: 'sale', quantity: 3 },
    { sku: 'PPNA11KPAL', transactionType: 'internal_use', quantity: 2 },
    { sku: 'PLNA11KPAQ', transactionType: 'stock_in', quantity: 4 },
    { sku: 'ppna11kpal', transactionType: 'stock_in', quantity: 1 }, // case variance
  ]
  const m = S.deriveStockFromLedger(led)
  eq('derived stock is case-insensitive', m.get('PPNA11KPAL'), 6)
  eq('second sku', m.get('PLNA11KPAQ'), 4)

  eq('status out of stock', S.stockStatus(0, 5), 'Out of Stock')
  eq('status low',          S.stockStatus(4, 5), 'Low Stock')
  eq('status in stock',     S.stockStatus(5, 5), 'In Stock')
}

console.log('\n=== Users: real rows, duplicate email handling ===')
{
  const U_HDR = [...S.USERS_COLUMNS]
  const darshan  = S.userFromRow(U_HDR, ['real3d.india1@gmail.com','Darshan','Admin',1,1,1,1,1,1])
  const nagarjun = S.userFromRow(U_HDR, ['real3d.india1@gmail.com','Nagarjun','Admin',1,0,1,1,1,1])
  eq('role', darshan.role, 'admin')
  eq('canStockOut true', darshan.canStockOut, true)
  eq('Nagarjun canStockOut false (preserved)', nagarjun.canStockOut, false)

  ok('row without email rejected',
    S.userFromRow(U_HDR, ['','Intern','',0,0,0,0,0,1]) === null)

  // Legacy header using Can_Remove_Stock
  const OLD_U = ['Email','Name','Role','Can_Stock_In','Can_Remove_Stock','Active']
  const legacy = S.userFromRow(OLD_U, ['inventory.real3d@gmail.com','Janardhan','Admin',1,1,1])
  eq('Can_Remove_Stock maps to canStockOut', legacy.canStockOut, true)
  eq('missing Can_Sell falls back to admin default', legacy.canSell, true)
  eq('missing Can_Delete falls back to admin default', legacy.canDelete, true)

  // Duplicate resolution must be deterministic: first active wins
  const chosen = S.findUserByEmail([darshan, nagarjun], 'real3d.india1@gmail.com')
  eq('first active match wins', chosen.name, 'Darshan')
  eq('case-insensitive lookup',
    S.findUserByEmail([darshan], 'REAL3D.INDIA1@GMAIL.COM').name, 'Darshan')
  eq('unknown email -> undefined',
    S.findUserByEmail([darshan], 'nobody@x.com'), undefined)

  // Inactive users must still resolve (so we can refuse the login explicitly)
  const inactive = S.userFromRow(U_HDR, ['x@y.com','Gone','Sales',0,0,1,0,0,0])
  eq('inactive parsed', inactive.active, false)
  eq('inactive still found', S.findUserByEmail([inactive], 'x@y.com').name, 'Gone')
}

console.log('\n=== Role permission defaults ===')
{
  eq('admin all on', S.ROLE_DEFAULTS.admin,
    { canStockIn:true, canStockOut:true, canSell:true, canEdit:true, canDelete:true })
  eq('warehouse cannot sell or edit', S.ROLE_DEFAULTS.warehouse,
    { canStockIn:true, canStockOut:true, canSell:false, canEdit:false, canDelete:false })
  eq('sales cannot receive stock', S.ROLE_DEFAULTS.sales,
    { canStockIn:false, canStockOut:false, canSell:true, canEdit:false, canDelete:false })
}

console.log('\n=== Suppliers / Customers / PreOrders ===')
{
  const s = S.supplierFromRow([...S.SUPPLIERS_COLUMNS],
    ['SUP-1','Numakers','Ravi','9999','a@b.com','Bengaluru','29ABC','PLA, PETG, ABS',1])
  eq('materials split', s.materialsSupplied, ['PLA','PETG','ABS'])
  eq('supplier round trip materials', S.supplierToRow(s)[7], 'PLA, PETG, ABS')

  const c = S.customerFromRow([...S.CUSTOMERS_COLUMNS],
    ['CUS-1','Acme','8888','x@y.com','Mysuru','29XYZ',1])
  eq('customer name', c.name, 'Acme')

  const o = S.preOrderFromRow([...S.PREORDERS_COLUMNS],
    ['ORD-1','Acme','CUS-1','PPNA11KPAL','PLA+ Pure White',10,46229.5,'Pending'])
  eq('preorder status', o.status, 'pending')
  eq('preorder qty', o.quantityRequired, 10)
  ok('preorder date parsed', o.dateEntered !== '', o.dateEntered)
  const oRow = S.preOrderToRow(o)
  eq('preorder writes capitalised status', oRow[7], 'Pending')
  eq('preorder date written as YYYY-MM-DD', oRow[6], o.dateEntered)
  ok('preorder cells are primitives',
    oRow.every((c) => ['string', 'number', 'boolean'].includes(typeof c)),
    JSON.stringify(oRow))
}

console.log('\n=== ID generation ===')
{
  const now = new Date(1786001400698)
  eq('txn id format', S.generateTransactionId(now), 'TXN-1786001400698')
  eq('order id format', S.generateOrderId(now), 'ORD-1786001400698')
}

console.log('\n=== A1 ranges ===')
{
  eq('Products A:Q (17 cols)', S.tabRange('Products', 17), 'Products!A:Q')
  eq('Transactions A:L (12 cols)', S.tabRange('Transactions', 12), 'Transactions!A:L')
  eq('Users A:I (9 cols)', S.tabRange('Users', 9), 'Users!A:I')
  eq('26 cols -> Z', S.tabRange('X', 26), 'X!A:Z')
  eq('27 cols -> AA', S.tabRange('X', 27), 'X!A:AA')
}

console.log('\n=== Category inference guard ===')
{
  eq('ABS-Like -> resin', S.inferCategory('ABS-Like Resin', ''), 'resin')
  eq('ABS LIKE PRO in colour -> resin', S.inferCategory('', 'ABS LIKE PRO'), 'resin')
  eq('plain ABS stays filament', S.inferCategory('ABS', 'White'), 'filament')
  eq('ASA stays filament', S.inferCategory('ASA', 'Black'), 'filament')
  eq('PLA+ stays filament', S.inferCategory('PLA+', 'Black'), 'filament')
}

console.log(`\n──────────────────────────────`)
console.log(`  ${pass} passed, ${fail} failed`)
console.log(`──────────────────────────────\n`)
process.exit(fail === 0 ? 0 : 1)
