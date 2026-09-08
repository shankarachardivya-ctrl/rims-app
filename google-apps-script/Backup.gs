/**
 * Real3D RIMS — backup and recovery.
 *
 * This workbook is the sole store of inventory data, so losing it loses
 * everything. These functions provide the automated layer of protection.
 *
 * WHAT THIS PROTECTS AGAINST
 *   - a bad bulk edit or accidental row deletion   -> restore a dated snapshot
 *   - the file being deleted                       -> snapshots are separate files
 *   - a script bug corrupting values               -> snapshots predate it
 *
 * WHAT THIS DOES NOT PROTECT AGAINST
 *   - loss of the Google account that owns the file. Snapshots live in the SAME
 *     Drive, so they die with it. Ownership must sit in a Shared Drive or an
 *     organisation account with 2FA and a second admin. See README notes.
 *
 * SETUP (once)
 *   Run installDailyBackup() and approve the permission prompt.
 *   Snapshots then appear daily in a "RIMS Backups" folder.
 */

/** Folder that snapshots are written to. Created next to the workbook. */
var BACKUP_FOLDER_NAME = 'RIMS Backups';

/** How many dated snapshots to keep. Older ones are moved to Drive trash. */
var BACKUP_KEEP_COUNT = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Public entry points
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Take a snapshot right now. Safe to run any time, including by hand
 * before a risky edit.
 * @return {string} name of the snapshot created
 */
function createBackupNow() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = backupName_(ss.getName());
  var folder = getOrCreateBackupFolder_(ss);

  var copy = DriveApp.getFileById(ss.getId()).makeCopy(name, folder);
  Logger.log('Backup created: ' + name);
  Logger.log('  location: ' + folder.getName() + '  (id ' + copy.getId() + ')');

  pruneOldBackups_(folder);
  return name;
}

/**
 * Install a daily trigger for createBackupNow().
 * Idempotent — an existing daily backup trigger is replaced, not duplicated.
 */
function installDailyBackup() {
  removeDailyBackup();
  ScriptApp.newTrigger('createBackupNow')
    .timeBased()
    .everyDays(1)
    .atHour(2)                 // ~2am in the script's timezone
    .create();
  Logger.log('Daily backup installed (runs about 02:00, keeps ' +
             BACKUP_KEEP_COUNT + ' snapshots).');
  Logger.log('Reminder: snapshots live in the same Drive as the workbook, so they');
  Logger.log('do NOT survive loss of this Google account. Move the file to a');
  Logger.log('Shared Drive and add a second admin for that.');
}

/** Remove the daily backup trigger, if present. */
function removeDailyBackup() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'createBackupNow') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  if (removed) Logger.log('Removed ' + removed + ' existing backup trigger(s).');
}

/** List the snapshots currently held, newest first. */
function listBackups() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var folder = getOrCreateBackupFolder_(ss);
  var items = collectBackups_(folder);
  if (!items.length) {
    Logger.log('No snapshots yet. Run createBackupNow() or installDailyBackup().');
    return [];
  }
  Logger.log(items.length + ' snapshot(s), newest first:');
  items.forEach(function (f) {
    Logger.log('  ' + f.getName() + '   ' + f.getDateCreated());
  });
  return items.map(function (f) { return f.getName(); });
}

/**
 * Emergency check: confirms every expected tab exists and reports row counts.
 * Run this after a restore to verify the workbook is intact.
 */
function verifyWorkbook() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var expected = ['Products', 'Transactions', 'Inventory', 'Users',
                  'Suppliers', 'Customers', 'PreOrders'];
  var problems = 0;

  Logger.log('=== workbook check: ' + ss.getName() + ' ===');
  expected.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      Logger.log('MISSING tab: ' + name);
      problems++;
      return;
    }
    var rows = Math.max(0, sh.getLastRow() - 1);
    Logger.log(pad_(name, 14) + rows + ' data row(s)');
    if (name === 'Products' && rows === 0) {
      Logger.log('  WARNING Products is empty — the catalogue is gone');
      problems++;
    }
  });

  // Cross-check: Inventory should cover every Product SKU
  var prod = ss.getSheetByName('Products');
  var inv = ss.getSheetByName('Inventory');
  if (prod && inv) {
    var pSkus = {};
    var pv = prod.getDataRange().getValues();
    for (var i = 1; i < pv.length; i++) {
      var s = String(pv[i][0] || '').trim().toUpperCase();
      if (s) pSkus[s] = true;
    }
    var iv = inv.getDataRange().getValues();
    var covered = 0;
    for (var j = 1; j < iv.length; j++) {
      var t = String(iv[j][0] || '').trim().toUpperCase();
      if (t && pSkus[t]) covered++;
    }
    var total = Object.keys(pSkus).length;
    Logger.log('Inventory covers ' + covered + ' of ' + total + ' product SKU(s)');
    if (covered < total) {
      Logger.log('  run reconcileInventory() to rebuild the missing rows');
    }
  }

  Logger.log(problems === 0 ? 'RESULT: workbook looks healthy'
                            : 'RESULT: ' + problems + ' problem(s) found');
  return problems;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

function backupName_(baseName) {
  var tz = Session.getScriptTimeZone() || 'Etc/UTC';
  var stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd_HH-mm');
  return '[backup ' + stamp + '] ' + baseName;
}

/**
 * Backups go in a folder beside the workbook so they are easy to find,
 * falling back to Drive root if the parent is not reachable.
 */
function getOrCreateBackupFolder_(ss) {
  var parent = null;
  try {
    var parents = DriveApp.getFileById(ss.getId()).getParents();
    if (parents.hasNext()) parent = parents.next();
  } catch (e) {
    // fall through to root
  }
  var root = parent || DriveApp.getRootFolder();

  var existing = root.getFoldersByName(BACKUP_FOLDER_NAME);
  if (existing.hasNext()) return existing.next();
  return root.createFolder(BACKUP_FOLDER_NAME);
}

function collectBackups_(folder) {
  var items = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf('[backup ') === 0) items.push(f);
  }
  items.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  return items;
}

/**
 * Trash snapshots beyond BACKUP_KEEP_COUNT.
 * Trashed rather than hard-deleted, so they stay recoverable for 30 days.
 */
function pruneOldBackups_(folder) {
  var items = collectBackups_(folder);
  if (items.length <= BACKUP_KEEP_COUNT) return;
  var stale = items.slice(BACKUP_KEEP_COUNT);
  stale.forEach(function (f) {
    f.setTrashed(true);
    Logger.log('  pruned old snapshot: ' + f.getName());
  });
  Logger.log('  kept ' + BACKUP_KEEP_COUNT + ', trashed ' + stale.length);
}

function pad_(s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s;
}
