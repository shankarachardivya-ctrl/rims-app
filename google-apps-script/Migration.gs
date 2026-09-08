/**
 * Real3D RIMS — one-off sheet migration.
 *
 * Brings the existing workbook up to the schema the app expects:
 *   - Products   : adds Category, Diameter, location, pricing and Status columns
 *                  normalises Weight_kg from text ("1kg") to a number (1)
 *                  infers Category (Filament / Resin) from Material + Color
 *                  merges rows from "Product Master Database"
 *   - Transactions: rewrites the header to the agreed 11-column layout
 *                  CLEARS all existing rows (simulated data)
 *   - Inventory  : rewrites the header, seeds one row per Product at zero stock
 *   - Users      : expands to 5 permission flags, maps Can_Remove_Stock,
 *                  drops incomplete placeholder rows, reports duplicate emails
 *   - Creates Suppliers, Customers and PreOrders
 *
 * Safe to run more than once (idempotent) EXCEPT that it always clears
 * Transactions, which is destructive.
 *
 * HOW TO RUN
 *   1. Add Backup.gs to the same script project (migrate() snapshots first and
 *      aborts if it cannot).
 *   2. Set CONFIRM_DESTRUCTIVE to true below.
 *   3. Run migrate() and read the execution log.
 *
 * Requires: Backup.gs (createBackupNow)
 */

// Safety gate — must be flipped on deliberately.
var CONFIRM_DESTRUCTIVE = false;

var SHEETS = {
  products:     'Products',
  transactions: 'Transactions',
  inventory:    'Inventory',
  masterDb:     'Product Master Database',
  users:        'Users',
  suppliers:    'Suppliers',
  customers:    'Customers',
  preOrders:    'PreOrders'
};

var PRODUCTS_HEADER = [
  'SKU', 'Category', 'Material', 'Color', 'Brand', 'Weight_kg', 'Diameter',
  'Reorder_Level', 'Warehouse', 'Rack', 'Col_No', 'Bin', 'Supplier_ID',
  'Purchase_Price', 'Selling_Price', 'MRP', 'Status'
];

// Column 10 is intentionally blank and column 11 repeats the timestamp, so that
// both the legacy "Timestamp" and newer "TimeStamp" positions stay populated.
var TRANSACTIONS_HEADER = [
  'Transaction_ID', 'SKU', 'Transaction_Type', 'Quantity', 'User',
  'Timestamp', 'Before_Stock', 'After_stock', 'Input_Type', '', 'TimeStamp'
];

var INVENTORY_HEADER = [
  'SKU', 'Material', 'Color', 'Brand', 'Weight_kg', 'Reorder_level',
  'Current_Stock', 'Status', 'Last_Updated'
];

var USERS_HEADER = [
  'Email', 'Name', 'Role', 'Can_Stock_In', 'Can_Stock_Out',
  'Can_Sell', 'Can_Edit', 'Can_Delete', 'Active'
];

var SUPPLIERS_HEADER = [
  'Supplier_ID', 'Name', 'Contact_Person', 'Phone', 'Email', 'Address',
  'GST_Number', 'Materials_Supplied', 'Active'
];

var CUSTOMERS_HEADER = [
  'Customer_ID', 'Name', 'Phone', 'Email', 'Address', 'GST_Number', 'Active'
];

var PREORDERS_HEADER = [
  'Order_ID', 'Customer_Name', 'Customer_ID', 'SKU', 'Product_Name',
  'Quantity_Required', 'Date_Entered', 'Status'
];

/** Permission defaults per role, used only for flags that do not already exist. */
var ROLE_DEFAULTS = {
  ADMIN:     { stockIn: 1, stockOut: 1, sell: 1, edit: 1, del: 1 },
  WAREHOUSE: { stockIn: 1, stockOut: 1, sell: 0, edit: 0, del: 0 },
  SALES:     { stockIn: 0, stockOut: 0, sell: 1, edit: 0, del: 0 },
  INTERN:    { stockIn: 0, stockOut: 0, sell: 0, edit: 0, del: 0 }
};

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

function migrate() {
  if (!CONFIRM_DESTRUCTIVE) {
    throw new Error(
      'Refusing to run. This clears all Transactions rows. ' +
      'Make a copy of the spreadsheet, then set CONFIRM_DESTRUCTIVE = true.'
    );
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  log_('=== RIMS migration starting on "' + ss.getName() + '" ===');

  // Snapshot before touching anything. This rewrites Products and deletes every
  // Transactions row, so an automatic restore point is not optional.
  try {
    var snapshot = createBackupNow();
    log_('Pre-migration snapshot: ' + snapshot);
  } catch (e) {
    throw new Error(
      'Could not create a pre-migration backup (' + e.message + '). ' +
      'Refusing to continue — fix the permission prompt or copy the sheet by hand first.'
    );
  }

  var productCount = migrateProducts_(ss);
  migrateTransactions_(ss);
  var invCount = seedInventory_(ss);
  migrateUsers_(ss);
  ensureSheetWithHeader_(ss, SHEETS.suppliers, SUPPLIERS_HEADER);
  ensureSheetWithHeader_(ss, SHEETS.customers, CUSTOMERS_HEADER);
  ensureSheetWithHeader_(ss, SHEETS.preOrders, PREORDERS_HEADER);

  log_('=== migration complete ===');
  log_('Products rows      : ' + productCount);
  log_('Inventory rows      : ' + invCount + ' (all seeded at 0 stock)');
  log_('');
  log_('IMPORTANT: every SKU now shows 0 stock. Record your real shelf');
  log_('quantities as "Stock In" transactions before relying on the app.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────────────────────────────────────

function migrateProducts_(ss) {
  var sh = ss.getSheetByName(SHEETS.products);
  if (!sh) throw new Error('Missing sheet: ' + SHEETS.products);

  var values = sh.getDataRange().getValues();
  if (values.length === 0) throw new Error('Products sheet is empty');

  var oldHeader = values[0].map(normHeader_);
  var idx = {
    sku:     indexOfAny_(oldHeader, ['sku']),
    mat:     indexOfAny_(oldHeader, ['material']),
    color:   indexOfAny_(oldHeader, ['color', 'colour']),
    brand:   indexOfAny_(oldHeader, ['brand']),
    weight:  indexOfAny_(oldHeader, ['weight_kg', 'weightkg', 'weight']),
    reorder: indexOfAny_(oldHeader, ['reorder_level', 'reorderlevel']),
    diam:    indexOfAny_(oldHeader, ['diameter']),
    mrp:     indexOfAny_(oldHeader, ['mrp'])
  };

  // Preserve any columns we added on a previous run
  var prev = {
    cat:      indexOfAny_(oldHeader, ['category']),
    wh:       indexOfAny_(oldHeader, ['warehouse']),
    rack:     indexOfAny_(oldHeader, ['rack']),
    col:      indexOfAny_(oldHeader, ['col_no', 'column']),
    bin:      indexOfAny_(oldHeader, ['bin']),
    supp:     indexOfAny_(oldHeader, ['supplier_id', 'supplierid']),
    pp:       indexOfAny_(oldHeader, ['purchase_price', 'purchaseprice']),
    sp:       indexOfAny_(oldHeader, ['selling_price', 'sellingprice']),
    status:   indexOfAny_(oldHeader, ['status'])
  };

  var out = [];
  var seen = {};
  var skipped = 0;

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var sku = String(pick_(row, idx.sku, '')).trim();
    var material = String(pick_(row, idx.mat, '')).trim();
    var color = String(pick_(row, idx.color, '')).trim();
    var brand = String(pick_(row, idx.brand, '')).trim();

    // Skip fully blank rows
    if (!sku && !material && !color && !brand) continue;

    // Flag rows with no usable SKU rather than silently importing them
    if (!sku) {
      log_('WARN Products row ' + (r + 1) + ' has no SKU (' +
           [material, color, brand].join(' / ') + ') — imported with blank SKU, please fix');
      skipped++;
    }

    var key = sku.toUpperCase();
    if (key && seen[key]) {
      log_('WARN duplicate SKU in Products, keeping first: ' + sku);
      continue;
    }
    if (key) seen[key] = true;

    out.push([
      sku,
      pick_(row, prev.cat, '') || inferCategory_(material, color),
      material,
      color,
      brand,
      normaliseWeight_(pick_(row, idx.weight, '')),
      pick_(row, idx.diam, ''),
      toNumber_(pick_(row, idx.reorder, ''), 5),
      pick_(row, prev.wh, '')     || 'Main',
      pick_(row, prev.rack, ''),
      pick_(row, prev.col, ''),
      pick_(row, prev.bin, ''),
      pick_(row, prev.supp, ''),
      toNumber_(pick_(row, prev.pp, ''), 0),
      toNumber_(pick_(row, prev.sp, ''), 0),
      toNumber_(pick_(row, idx.mrp, ''), 0),
      pick_(row, prev.status, '') || 'Active'
    ]);
  }

  // Merge the Product Master Database rows in, keyed on SKU
  var master = ss.getSheetByName(SHEETS.masterDb);
  var merged = 0;
  if (master) {
    var mv = master.getDataRange().getValues();
    if (mv.length > 1) {
      var mh = mv[0].map(normHeader_);
      var m = {
        sku:   indexOfAny_(mh, ['sku']),
        mat:   indexOfAny_(mh, ['material']),
        color: indexOfAny_(mh, ['color', 'colour']),
        brand: indexOfAny_(mh, ['brand']),
        diam:  indexOfAny_(mh, ['diameter']),
        mrp:   indexOfAny_(mh, ['mrp'])
      };
      for (var i = 1; i < mv.length; i++) {
        var msku = String(pick_(mv[i], m.sku, '')).trim();
        if (!msku) continue;
        if (seen[msku.toUpperCase()]) continue;   // already in Products
        seen[msku.toUpperCase()] = true;
        var mmat = String(pick_(mv[i], m.mat, '')).trim();
        var mcol = String(pick_(mv[i], m.color, '')).trim();
        out.push([
          msku,
          inferCategory_(mmat, mcol),
          mmat, mcol,
          String(pick_(mv[i], m.brand, '')).trim(),
          1,
          pick_(mv[i], m.diam, ''),
          5,
          'Main', '', '', '', '',
          0, 0, toNumber_(pick_(mv[i], m.mrp, ''), 0),
          'Active'
        ]);
        merged++;
      }
      log_('Merged ' + merged + ' row(s) from "' + SHEETS.masterDb + '"');
    }
  }

  // Rewrite the sheet
  sh.clear();
  sh.getRange(1, 1, 1, PRODUCTS_HEADER.length).setValues([PRODUCTS_HEADER]);
  if (out.length) {
    sh.getRange(2, 1, out.length, PRODUCTS_HEADER.length).setValues(out);
  }
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, PRODUCTS_HEADER.length).setFontWeight('bold');

  var resins = out.filter(function (r) { return r[1] === 'Resin'; }).length;
  log_('Products migrated: ' + out.length + ' rows (' + resins + ' resin, ' +
       (out.length - resins) + ' filament)');
  if (skipped) log_('  ' + skipped + ' row(s) need a SKU filled in');
  return out.length;
}

/**
 * Filament or Resin.
 * "ABS-Like" is resin-only terminology — the category exists because
 * photopolymer resin cannot be true ABS.
 */
function inferCategory_(material, color) {
  var t = (String(material) + ' ' + String(color)).toUpperCase();
  if (/RESIN|ABS[\s\-]?LIKE|PHOTOPOLYMER|WATER[\s\-]?WASHABLE|CASTABLE|DENTAL/.test(t)) {
    return 'Resin';
  }
  return 'Filament';
}

/** "1kg" / "1 KG" / "0.5kg" -> number. Blank -> 1. */
function normaliseWeight_(v) {
  if (v === '' || v === null || v === undefined) return 1;
  if (typeof v === 'number') return v;
  var m = String(v).match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transactions
// ─────────────────────────────────────────────────────────────────────────────

function migrateTransactions_(ss) {
  var sh = ss.getSheetByName(SHEETS.transactions);
  if (!sh) sh = ss.insertSheet(SHEETS.transactions);

  var existing = Math.max(0, sh.getLastRow() - 1);
  sh.clear();
  sh.getRange(1, 1, 1, TRANSACTIONS_HEADER.length).setValues([TRANSACTIONS_HEADER]);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, TRANSACTIONS_HEADER.length).setFontWeight('bold');
  log_('Transactions: header rewritten, ' + existing + ' simulated row(s) removed');
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory
// ─────────────────────────────────────────────────────────────────────────────

function seedInventory_(ss) {
  var products = ss.getSheetByName(SHEETS.products);
  var pv = products.getDataRange().getValues();

  var sh = ss.getSheetByName(SHEETS.inventory);
  if (!sh) sh = ss.insertSheet(SHEETS.inventory);

  // Keep any stock already recorded, keyed by SKU
  var existingStock = {};
  var ev = sh.getDataRange().getValues();
  if (ev.length > 1) {
    var eh = ev[0].map(normHeader_);
    var eSku = indexOfAny_(eh, ['sku']);
    var eCur = indexOfAny_(eh, ['current_stock', 'currentstock']);
    for (var i = 1; i < ev.length; i++) {
      var s = String(pick_(ev[i], eSku, '')).trim().toUpperCase();
      if (s) existingStock[s] = toNumber_(pick_(ev[i], eCur, ''), 0);
    }
  }

  var rows = [];
  for (var r = 1; r < pv.length; r++) {
    var sku = String(pv[r][0]).trim();
    if (!sku) continue;
    var reorder = toNumber_(pv[r][7], 5);
    var stock = existingStock[sku.toUpperCase()] || 0;
    rows.push([
      sku,
      pv[r][2],            // Material
      pv[r][3],            // Color
      pv[r][4],            // Brand
      pv[r][5],            // Weight_kg
      reorder,
      stock,
      stockStatus_(stock, reorder),
      ''                   // Last_Updated — set on first transaction
    ]);
  }

  sh.clear();
  sh.getRange(1, 1, 1, INVENTORY_HEADER.length).setValues([INVENTORY_HEADER]);
  if (rows.length) {
    sh.getRange(2, 1, rows.length, INVENTORY_HEADER.length).setValues(rows);
  }
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, INVENTORY_HEADER.length).setFontWeight('bold');

  log_('Inventory seeded: ' + rows.length + ' SKU(s)');
  return rows.length;
}

function stockStatus_(stock, reorder) {
  if (stock <= 0) return 'Out of Stock';
  if (stock < reorder) return 'Low Stock';
  return 'In Stock';
}

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────

function migrateUsers_(ss) {
  var sh = ss.getSheetByName(SHEETS.users);
  if (!sh) sh = ss.insertSheet(SHEETS.users);

  var values = sh.getDataRange().getValues();
  var out = [];
  var emailSeen = {};

  if (values.length > 1) {
    var h = values[0].map(normHeader_);
    var idx = {
      email:    indexOfAny_(h, ['email']),
      name:     indexOfAny_(h, ['name']),
      role:     indexOfAny_(h, ['role']),
      stockIn:  indexOfAny_(h, ['can_stock_in', 'canstockin']),
      stockOut: indexOfAny_(h, ['can_stock_out', 'can_remove_stock', 'canremovestock']),
      sell:     indexOfAny_(h, ['can_sell', 'cansell']),
      edit:     indexOfAny_(h, ['can_edit', 'canedit']),
      del:      indexOfAny_(h, ['can_delete', 'candelete']),
      active:   indexOfAny_(h, ['active'])
    };

    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var email = String(pick_(row, idx.email, '')).trim();
      var name  = String(pick_(row, idx.name, '')).trim();
      var role  = String(pick_(row, idx.role, '')).trim();

      if (!email && !name) continue;

      // A user without an email can never sign in with Google — drop it and say so
      if (!email) {
        log_('WARN dropping Users row ' + (r + 1) + ' ("' + name +
             '") — no email, so it cannot sign in. Re-add it from the app once you have one.');
        continue;
      }

      // Role may be missing or hold a stray numeric value
      var roleKey = role.toUpperCase();
      if (!ROLE_DEFAULTS[roleKey]) {
        var guessed = /INTERN|VIEW/.test(name.toUpperCase()) ? 'Intern' : 'Warehouse';
        log_('WARN Users row ' + (r + 1) + ' ("' + name + '") had role "' +
             role + '" — defaulting to ' + guessed);
        role = guessed;
        roleKey = guessed.toUpperCase();
      }
      var def = ROLE_DEFAULTS[roleKey];

      var lower = email.toLowerCase();
      if (emailSeen[lower]) {
        log_('WARN duplicate email "' + email + '" (' + emailSeen[lower] + ' and ' + name +
             '). Google sign-in cannot tell them apart; "' + emailSeen[lower] +
             '" will be used. Give one of them a separate address for a clean audit trail.');
      } else {
        emailSeen[lower] = name;
      }

      out.push([
        email,
        name,
        titleCase_(role),
        // Existing flags are preserved; only the new ones come from the role
        hasCol_(idx.stockIn)  ? bool01_(pick_(row, idx.stockIn, def.stockIn))  : def.stockIn,
        hasCol_(idx.stockOut) ? bool01_(pick_(row, idx.stockOut, def.stockOut)) : def.stockOut,
        hasCol_(idx.sell)     ? bool01_(pick_(row, idx.sell, def.sell))         : def.sell,
        hasCol_(idx.edit)     ? bool01_(pick_(row, idx.edit, def.edit))         : def.edit,
        hasCol_(idx.del)      ? bool01_(pick_(row, idx.del, def.del))           : def.del,
        hasCol_(idx.active)   ? bool01_(pick_(row, idx.active, 1))              : 1
      ]);
    }
  }

  sh.clear();
  sh.getRange(1, 1, 1, USERS_HEADER.length).setValues([USERS_HEADER]);
  if (out.length) {
    sh.getRange(2, 1, out.length, USERS_HEADER.length).setValues(out);
  }
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, USERS_HEADER.length).setFontWeight('bold');
  log_('Users migrated: ' + out.length + ' row(s)');
}

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliation — recompute Inventory from the Transactions ledger
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rebuilds every Current_Stock value by replaying all transactions, and
 * refreshes the descriptive columns from Products.
 *
 * Current_Stock is normally maintained incrementally for speed, so run this
 * if you suspect drift, or put it on a daily trigger.
 */
function reconcileInventory() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var tx = ss.getSheetByName(SHEETS.transactions).getDataRange().getValues();
    var totals = {};
    for (var r = 1; r < tx.length; r++) {
      var sku = String(tx[r][1] || '').trim().toUpperCase();
      if (!sku) continue;
      var type = String(tx[r][2] || '').trim().toLowerCase();
      var qty = toNumber_(tx[r][3], 0);
      var delta = (type === 'stock in') ? qty : -qty;
      totals[sku] = (totals[sku] || 0) + delta;
    }

    var products = ss.getSheetByName(SHEETS.products).getDataRange().getValues();
    var bySku = {};
    for (var p = 1; p < products.length; p++) {
      var s = String(products[p][0]).trim();
      if (s) bySku[s.toUpperCase()] = products[p];
    }

    var inv = ss.getSheetByName(SHEETS.inventory);
    var rows = [];
    Object.keys(bySku).forEach(function (key) {
      var pr = bySku[key];
      var reorder = toNumber_(pr[7], 5);
      var stock = totals[key] || 0;
      rows.push([
        pr[0], pr[2], pr[3], pr[4], pr[5], reorder,
        stock, stockStatus_(stock, reorder), new Date()
      ]);
    });

    inv.clear();
    inv.getRange(1, 1, 1, INVENTORY_HEADER.length).setValues([INVENTORY_HEADER]);
    if (rows.length) {
      inv.getRange(2, 1, rows.length, INVENTORY_HEADER.length).setValues(rows);
    }
    inv.setFrozenRows(1);
    log_('Reconciled ' + rows.length + ' SKU(s) from ' + (tx.length - 1) + ' transaction(s)');
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function ensureSheetWithHeader_(ss, name, header) {
  var sh = ss.getSheetByName(name);
  var created = false;
  if (!sh) { sh = ss.insertSheet(name); created = true; }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
  }
  log_((created ? 'Created' : 'Verified') + ' sheet: ' + name);
  return sh;
}

function normHeader_(h) {
  return String(h == null ? '' : h).trim().toLowerCase().replace(/\s+/g, '_');
}
function indexOfAny_(headerArr, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var at = headerArr.indexOf(candidates[i]);
    if (at !== -1) return at;
  }
  return -1;
}
function hasCol_(i) { return i !== -1; }
function pick_(row, i, dflt) {
  if (i === -1 || i >= row.length) return dflt;
  var v = row[i];
  return (v === '' || v === null || v === undefined) ? dflt : v;
}
function toNumber_(v, dflt) {
  if (v === '' || v === null || v === undefined) return dflt;
  if (typeof v === 'number') return v;
  var m = String(v).replace(/,/g, '').match(/-?[\d.]+/);
  return m ? parseFloat(m[0]) : dflt;
}
function bool01_(v) {
  if (v === true) return 1;
  if (v === false) return 0;
  var s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'y') return 1;
  return 0;
}
function titleCase_(s) {
  s = String(s || '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}
function log_(msg) { Logger.log(msg); }
