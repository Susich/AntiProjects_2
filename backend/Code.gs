/**
 * =========================================================================================
 * PARTY SPLIT — GOOGLE APPS SCRIPT WEB APP BACKEND (Google Sheets)
 * =========================================================================================
 *
 * Cloud backend for shared bills, authentication and payment status sync.
 *
 * SHEET STRUCTURE (created automatically on first run):
 * 1. Users:            [id, name, phone, bank, legacyPaymentUrl, updatedAt,
 *                       passwordHash, passwordSalt, sessionToken, createdAt]
 * 2. Parties:          [id, code, title, createdBy, createdAt]
 * 3. PartyMembers:     [partyId, userId, joinedAt, bank]
 * 4. Expenses:         [id, partyId, title, amount, paidById, sharedUserIds,
 *                       createdAt, category]
 * 5. PaymentStatuses:  [partyId, transferId, fromUserId, toUserId, amount,
 *                       isPaid, updatedBy, updatedAt]
 *
 * DEPLOYMENT:
 * 1. Create a Google Sheet and open Extensions -> Apps Script.
 * 2. Replace Code.gs with this file and save.
 * 3. Deploy -> New deployment -> Web app.
 * 4. Execute as: Me. Who has access: Anyone.
 * 5. Copy the /exec URL into the app (Profile -> Google Sheets).
 *
 * UPDATING AN EXISTING DEPLOYMENT:
 * Deploy -> Manage deployments -> Edit -> Version: New version -> Deploy.
 * The URL stays the same, and the app's "Проверить подключение" probe checks
 * that API version 2 and the batch capability are live.
 *
 * Passwords are stored as salted SHA-256 hashes. This is a small Google Sheets
 * backend, not a production identity provider; use a real auth service if you
 * need password reset, rate limiting, email verification, etc.
 * =========================================================================================
 */

var API_VERSION = 2;

var SHEET_USERS = 'Users';
var SHEET_PARTIES = 'Parties';
var SHEET_MEMBERS = 'PartyMembers';
var SHEET_EXPENSES = 'Expenses';
var SHEET_STATUSES = 'PaymentStatuses';
var SHEET_SHOPPING = 'ShoppingList';

// Bump this when the schema/migrations change so the six-hour init cache is
// invalidated automatically.
var SCHEMA_VERSION = 5;
var SCHEMA_CACHE_KEY = 'party_split_schema_v' + SCHEMA_VERSION;
var PARTY_CACHE_PREFIX = 'party_details_v2_';
var PARTY_CACHE_TTL_SECONDS = 30;
var USER_AUTH_PREFIX = 'user_auth_';
var USER_DATA_PREFIX = 'user_data_';
var USER_AUTH_TTL_SECONDS = 1800; // 30 minutes auth session cache

var BATCHABLE_ACTIONS = {
  addExpense: true,
  updateExpense: true,
  deleteExpense: true,
  updatePartyTitle: true,
  setTransferStatus: true,
  leaveParty: true,
  updateUserProfile: true,
  addShoppingItem: true,
  updateShoppingItem: true,
  deleteShoppingItem: true
};

function getCachedAuth(userId, token) {
  if (!userId || !token) return null;
  try {
    var cache = CacheService.getScriptCache();
    var rawUser = cache.get(USER_AUTH_PREFIX + userId + '_' + token);
    if (rawUser) {
      return JSON.parse(rawUser);
    }
  } catch (err) {
    // Ignore cache lookup errors
  }
  return null;
}

function setCachedAuth(userId, token, user) {
  if (!userId || !token || !user) return;
  try {
    var cache = CacheService.getScriptCache();
    cache.put(USER_AUTH_PREFIX + userId + '_' + token, JSON.stringify(user), USER_AUTH_TTL_SECONDS);
  } catch (err) {
    // Ignore cache write errors
  }
}

function invalidateCachedAuth(userId, token) {
  if (!userId) return;
  try {
    var cache = CacheService.getScriptCache();
    if (token) {
      cache.remove(USER_AUTH_PREFIX + userId + '_' + token);
    }
    cache.remove(USER_AUTH_PREFIX + userId);
    cache.remove(USER_DATA_PREFIX + userId);
  } catch (err) {
    // Ignore cache remove errors
  }
}

/**
 * Initializes sheets and appends new columns to existing sheets without
 * touching existing data. Older deployments had Users[bankName, paymentUrl]
 * and PartyMembers without a per-room bank; both are migrated in place. The
 * legacy payment URL column is kept only so old rows are not shifted; the app
 * never reads or writes it.
 */
function initDatabaseIfNeeded(ss) {
  // This used to run on every action, reading headers from all five sheets.
  // Schema checks are only needed on a cold cache (6h) or after a version bump.
  var cache = CacheService.getScriptCache();
  if (cache.get(SCHEMA_CACHE_KEY) === 'ready') return;

  var schemas = {};
  schemas[SHEET_USERS] = [
    'id', 'name', 'phone', 'bank', 'legacyPaymentUrl', 'updatedAt',
    'passwordHash', 'passwordSalt', 'sessionToken', 'createdAt'
  ];
  schemas[SHEET_PARTIES] = ['id', 'code', 'title', 'createdBy', 'createdAt'];
  schemas[SHEET_MEMBERS] = ['partyId', 'userId', 'joinedAt', 'bank'];
  schemas[SHEET_EXPENSES] = [
    'id', 'partyId', 'title', 'amount', 'paidById', 'sharedUserIds',
    'createdAt', 'category'
  ];
  schemas[SHEET_STATUSES] = [
    'partyId', 'transferId', 'fromUserId', 'toUserId', 'amount',
    'isPaid', 'updatedBy', 'updatedAt'
  ];
  schemas[SHEET_SHOPPING] = [
    'id', 'partyId', 'title', 'estimatedAmount', 'assignedUserId',
    'isBought', 'boughtById', 'actualAmount', 'convertedExpenseId',
    'category', 'createdAt'
  ];

  for (var name in schemas) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(schemas[name]);
      sheet.getRange(1, 1, 1, schemas[name].length).setFontWeight('bold').setBackground('#E2E8F0');
      sheet.setFrozenRows(1);
      continue;
    }

    var headers = schemas[name];
    var lastColumn = sheet.getLastColumn();
    if (lastColumn === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E2E8F0');
      sheet.setFrozenRows(1);
      continue;
    }
    if (lastColumn < headers.length) {
      var missing = headers.slice(lastColumn);
      var targetRange = sheet.getRange(1, lastColumn + 1, 1, missing.length);
      targetRange.setValues([missing]);
      targetRange.setFontWeight('bold').setBackground('#E2E8F0');
    }

    // Rename the legacy Users column. Its data (bank label) stays in place.
    if (name === SHEET_USERS && lastColumn >= 4) {
      var headerRow = sheet.getRange(1, 1, 1, Math.min(lastColumn, 5)).getValues()[0];
      var legacyHeader = (headerRow[3] || '').toString();
      if (legacyHeader === 'bankName') {
        sheet.getRange(1, 4).setValue('bank');
      }
      if (lastColumn >= 5) {
        var legacyUrlHeader = (headerRow[4] || '').toString();
        if (legacyUrlHeader === 'paymentUrl') {
          sheet.getRange(1, 5).setValue('legacyPaymentUrl');
        }
      }
    }
  }

  cache.put(SCHEMA_CACHE_KEY, 'ready', 21600);
}

/** Reads only the columns a feature needs, starting from row 2. */
function readSheetRows(sheet, columns) {
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  var colsToRead = Math.min(columns, lastCol);
  return sheet.getRange(2, 1, lastRow - 1, colsToRead).getValues();
}

/** Finds one row by an exact value in one column without loading the sheet. */
function findRowByColumnValue(sheet, column, value, columns) {
  var needle = (value || '').toString();
  if (!sheet || !needle) return null;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var lastCol = sheet.getLastColumn();
  if (column > lastCol) return null;

  var match = sheet
    .getRange(2, column, lastRow - 1, 1)
    .createTextFinder(needle)
    .matchEntireCell(true)
    .findNext();
  if (!match) return null;

  var colsToRead = Math.min(columns, lastCol);
  return {
    rowIndex: match.getRow(),
    row: sheet.getRange(match.getRow(), 1, 1, colsToRead).getValues()[0]
  };
}

function partyCacheKey(partyId) {
  return PARTY_CACHE_PREFIX + (partyId || '').toString();
}

function readPartyCache(partyId) {
  try {
    var raw = CacheService.getScriptCache().get(partyCacheKey(partyId));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function writePartyCache(partyId, payload) {
  if (!partyId || !payload || !payload.success) return;
  try {
    var str = JSON.stringify(payload);
    if (str.length < 100000) {
      CacheService.getScriptCache().put(
        partyCacheKey(partyId),
        str,
        PARTY_CACHE_TTL_SECONDS
      );
    }
  } catch (err) {
    // Cache is an optimization; never fail a request because it is unavailable.
  }
}

function invalidatePartyCache(partyId) {
  if (!partyId) return;
  try {
    CacheService.getScriptCache().remove(partyCacheKey(partyId));
  } catch (err) {
    // Ignore cache errors.
  }
}

function generateRoomCode(ss) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var prefixes = ['PUB', 'BAR', 'VIBE', 'CHILL', 'BEER', 'FOOD', 'GO'];
  var prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  var suffix = '';
  for (var i = 0; i < 3; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  var code = prefix + suffix;

  var partySheet = ss.getSheetByName(SHEET_PARTIES);
  if (!partySheet) return code;
  var lastRow = partySheet.getLastRow();
  if (lastRow < 2) return code;
  var codes = partySheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (var r = 0; r < codes.length; r++) {
    if ((codes[r][0] || '').toString().toUpperCase() === code) {
      return generateRoomCode(ss);
    }
  }
  return code;
}

function doGet(e) {
  var params = e ? e.parameter : {};
  if (params.action) {
    return handleApiAction(params.action, params);
  }
  return jsonResponse({
    status: 'online',
    service: 'PartySplit Google Apps Script Web App',
    apiVersion: API_VERSION,
    capabilities: ['batch', 'partyCache'],
    timestamp: new Date().toISOString(),
    message: 'Backend активен и готов к обработке запросов тусовок!'
  });
}

function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var action = payload.action;
    if (!action) {
      return errorResponse('Параметр "action" не передан в запросе');
    }

    return handleApiAction(action, payload);
  } catch (err) {
    return errorResponse('Ошибка выполнения запроса: ' + err.toString());
  }
}

function handleApiAction(action, data) {
  // Health probes must be fast and must not touch the spreadsheet, otherwise
  // every "Проверить подключение" spends the script lock and a quota unit.
  if (action === 'version' || action === 'ping') {
    return jsonResponse({
      success: true,
      apiVersion: API_VERSION,
      capabilities: ['batch', 'partyCache'],
      message: 'Подключение к Google Sheets успешно!'
    });
  }

  // Version check for in-app APK updater
  if (action === 'getLatestVersion' || action === 'checkUpdate') {
    return jsonResponse({
      success: true,
      apiVersion: API_VERSION,
      latestVersion: '1.0.5',
      apkUrl: 'https://drive.google.com/uc?export=download&id=1Xj-OHVMDlsZKlZfOqkJPza-RSejNJH4M',
      googleDriveFileId: '1Xj-OHVMDlsZKlZfOqkJPza-RSejNJH4M',
      releaseNotes: 'Исправление синхронизации и багов верстки',
      minSupportedVersion: '1.0.0',
      publishedAt: '2026-10-22',
      fileSizeMb: 42
    });
  }

  // READ-ONLY ACTIONS: getPartyDetails does not acquire the exclusive script lock!
  // This completely eliminates lock contention and allows non-blocking background polling.
  if (action === 'getPartyDetails') {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      initDatabaseIfNeeded(ss);
      return getPartyDetails(ss, data);
    } catch (err) {
      return errorResponse(err.toString());
    }
  }

  // MUTATING ACTIONS: acquire script lock to serialize writes
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return errorResponse('Сервер перегружен, повторите попытку через пару секунд');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    initDatabaseIfNeeded(ss);
    return dispatchApiAction(ss, action, data);
  } catch (err) {
    return errorResponse(err.toString());
  } finally {
    lock.releaseLock();
  }
}

function dispatchApiAction(ss, action, data) {
  switch (action) {
    case 'registerUser':
      return registerUser(ss, data);
    case 'loginUser':
      return loginUser(ss, data);
    case 'updateUserProfile':
      return updateUserProfile(ss, data);

    case 'createParty':
      return createParty(ss, data);
    case 'joinParty':
      return joinParty(ss, data);
    case 'getPartyDetails':
      return getPartyDetails(ss, data);
    case 'leaveParty':
      return leaveParty(ss, data);

    case 'addExpense':
      return addExpense(ss, data);
    case 'updateExpense':
      return updateExpense(ss, data);
    case 'deleteExpense':
      return deleteExpense(ss, data);
    case 'updatePartyTitle':
      return updatePartyTitle(ss, data);
    case 'setTransferStatus':
      return setTransferStatus(ss, data);

    case 'addShoppingItem':
      return addShoppingItem(ss, data);
    case 'updateShoppingItem':
      return updateShoppingItem(ss, data);
    case 'deleteShoppingItem':
      return deleteShoppingItem(ss, data);

    case 'batch':
      return executeBatch(ss, data);

    default:
      return errorResponse('Неизвестное действие (action): ' + action);
  }
}

/**
 * Executes several independent write actions under one script lock and one
 * HTTP request. The client queue uses this to avoid 5-8 Apps Script round
 * trips for a short burst of edits.
 */
function executeBatch(ss, data) {
  var operations = data && Array.isArray(data.operations) ? data.operations : [];
  if (operations.length === 0) {
    return errorResponse('Нет операций для пакетной обработки');
  }
  if (operations.length > 12) {
    return errorResponse('Слишком много операций в одном запросе');
  }

  var results = [];
  var affectedParties = {};

  for (var i = 0; i < operations.length; i++) {
    var operation = operations[i] || {};
    var action = (operation.action || '').toString();
    if (!BATCHABLE_ACTIONS[action]) {
      results.push({
        success: false,
        error: 'Действие не поддерживается в пакете: ' + action
      });
      continue;
    }

    try {
      var opData = operation.data || {};
      if (opData.partyId) {
        affectedParties[opData.partyId] = true;
      }
      var output = dispatchApiAction(ss, action, opData);
      var content = output && output.getContent ? output.getContent() : '';
      var parsed = null;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        parsed = null;
      }
      results.push(parsed || {
        success: false,
        error: 'Некорректный ответ операции: ' + action
      });
    } catch (err) {
      results.push({ success: false, error: err.toString() });
    }
  }

  for (var pid in affectedParties) {
    invalidatePartyCache(pid);
  }

  return jsonResponse({
    success: true,
    apiVersion: API_VERSION,
    results: results
  });
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function normalizePhone(value) {
  var digits = (value === null || value === undefined ? '' : value)
    .toString()
    .replace(/\D/g, '');
  if (digits.length === 11 && (digits.charAt(0) === '8' || digits.charAt(0) === '7')) {
    return '7' + digits.substring(1);
  }
  if (digits.length === 10) {
    return '7' + digits;
  }
  return digits;
}

function normalizeBank(value) {
  var bank = (value || '').toString().trim();
  if (!bank || bank.toLowerCase() === 'sbp') return 'Сбербанк';
  return bank;
}

function isValidPhone(phone) {
  return /^7\d{10}$/.test(phone);
}

function hashPassword(password, salt) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + ':' + password,
    Utilities.Charset.UTF_8
  );
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var value = digest[i];
    if (value < 0) value += 256;
    var part = value.toString(16);
    hex += part.length === 1 ? '0' + part : part;
  }
  return hex;
}

function findUserRowById(ss, userId) {
  var sheet = ss.getSheetByName(SHEET_USERS);
  var found = findRowByColumnValue(sheet, 1, userId, 10);
  return found ? { sheet: sheet, rowIndex: found.rowIndex, row: found.row } : null;
}

function findUserRowByPhone(ss, phone) {
  var sheet = ss.getSheetByName(SHEET_USERS);
  var rows = readSheetRows(sheet, 9);
  for (var r = 0; r < rows.length; r++) {
    if (normalizePhone(rows[r][2]) === phone) {
      return { sheet: sheet, rowIndex: r + 2, row: rows[r] };
    }
  }
  return null;
}

function publicUser(row) {
  return {
    id: (row[0] || '').toString(),
    name: (row[1] || 'Участник').toString(),
    phone: (row[2] || '').toString(),
    bank: normalizeBank(row[3]),
    avatarUrl: (row[4] || '').toString() || undefined
  };
}

function authenticate(ss, data) {
  var userId = (data.userId || '').toString();
  var token = (data.token || '').toString();
  if (!userId || !token) {
    return { error: 'Требуется авторизация. Войдите в аккаунт.' };
  }

  var cachedUser = getCachedAuth(userId, token);
  if (cachedUser) {
    return {
      user: cachedUser,
      fromCache: true
    };
  }

  var found = findUserRowById(ss, userId);
  if (!found) {
    return { error: 'Пользователь не найден. Войдите в аккаунт заново.' };
  }

  var storedTokenRaw = (found.row[8] || '').toString();
  var storedTokens = storedTokenRaw
    ? storedTokenRaw.split(',').map(function (t) { return t.trim(); }).filter(Boolean)
    : [];
  if (storedTokens.length === 0 || storedTokens.indexOf(token) === -1) {
    return { error: 'Сессия истекла. Войдите в аккаунт заново.' };
  }

  var user = publicUser(found.row);
  setCachedAuth(userId, token, user);

  return {
    user: user,
    row: found.row,
    rowIndex: found.rowIndex
  };
}

// ---------------------------------------------------------------------------
// Auth actions
// ---------------------------------------------------------------------------

function registerUser(ss, data) {
  var name = (data.name || '').toString().trim();
  var password = (data.password || '').toString();
  var phone = normalizePhone(data.phone);
  var bank = normalizeBank(data.bank);

  if (name.length < 2) return errorResponse('Укажите имя (минимум 2 символа)');
  if (password.length < 4) return errorResponse('Пароль должен быть не короче 4 символов');
  if (!isValidPhone(phone)) return errorResponse('Введите корректный номер телефона');

  var existing = findUserRowByPhone(ss, phone);
  var now = new Date().toISOString();
  var token = Utilities.getUuid();
  var salt = Utilities.getUuid();
  var passwordHash = hashPassword(password, salt);

  if (existing) {
    var existingHash = (existing.row[6] || '').toString();
    if (existingHash) {
      return errorResponse('Пользователь с таким телефоном уже зарегистрирован. Войдите в аккаунт.');
    }

    // A legacy profile row (created before auth) can claim its phone once.
    existing.sheet.getRange(existing.rowIndex, 2, 1, 3).setValues([[name, phone, bank]]);
    existing.sheet.getRange(existing.rowIndex, 6).setValue(now);
    existing.sheet.getRange(existing.rowIndex, 7, 1, 4).setValues([
      [passwordHash, salt, token, now]
    ]);

    var regUser = { id: (existing.row[0] || '').toString(), name: name, phone: phone, bank: bank };
    setCachedAuth(regUser.id, token, regUser);

    return jsonResponse({
      success: true,
      user: regUser,
      token: token
    });
  }

  var userId = 'user_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000000);
  var usersSheet = ss.getSheetByName(SHEET_USERS);
  usersSheet.appendRow([
    userId, name, phone, bank, '', now, passwordHash, salt, token, now
  ]);

  var newUser = { id: userId, name: name, phone: phone, bank: bank };
  setCachedAuth(userId, token, newUser);

  return jsonResponse({
    success: true,
    user: newUser,
    token: token
  });
}

function loginUser(ss, data) {
  var phone = normalizePhone(data.phone);
  var password = (data.password || '').toString();
  if (!isValidPhone(phone) || !password) {
    return errorResponse('Введите телефон и пароль');
  }

  var found = findUserRowByPhone(ss, phone);
  if (!found) {
    return errorResponse('Неверный телефон или пароль');
  }

  var storedHash = (found.row[6] || '').toString();
  var salt = (found.row[7] || '').toString();
  if (!storedHash) {
    return errorResponse('Профиль ещё не завершён. Зарегистрируйтесь с этим телефоном.');
  }
  if (hashPassword(password, salt) !== storedHash) {
    return errorResponse('Неверный телефон или пароль');
  }

  var token = Utilities.getUuid();
  var now = new Date().toISOString();
  var existingTokensRaw = (found.row[8] || '').toString();
  var tokens = existingTokensRaw
    ? existingTokensRaw.split(',').map(function (t) { return t.trim(); }).filter(Boolean)
    : [];
  tokens.push(token);
  if (tokens.length > 10) {
    tokens = tokens.slice(tokens.length - 10);
  }
  found.sheet.getRange(found.rowIndex, 9).setValue(tokens.join(','));
  found.sheet.getRange(found.rowIndex, 6).setValue(now);

  var loggedUser = publicUser(found.row);
  setCachedAuth(loggedUser.id, token, loggedUser);

  return jsonResponse({
    success: true,
    user: loggedUser,
    token: token
  });
}

function updateUserProfile(ss, data) {
  var auth = authenticate(ss, data);
  if (auth.error) return errorResponse(auth.error);

  var name = (data.name || '').toString().trim();
  var phone = normalizePhone(data.phone);
  var bank = normalizeBank(data.bank);
  var newPassword = (data.newPassword || '').toString();

  if (name.length < 2) return errorResponse('Укажите имя (минимум 2 символа)');
  if (!isValidPhone(phone)) return errorResponse('Введите корректный номер телефона');

  // Look up user's exact row in Users sheet to guarantee a valid rowIndex
  var rowIndex = auth.rowIndex;
  if (!rowIndex) {
    var found = findUserRowById(ss, auth.user.id);
    if (!found) {
      return errorResponse('Пользователь не найден. Войдите в аккаунт заново.');
    }
    rowIndex = found.rowIndex;
  }

  // If phone changed, verify it is not already taken by another user
  var currentPhone = normalizePhone(auth.user.phone);
  if (phone !== currentPhone) {
    var other = findUserRowByPhone(ss, phone);
    if (other && other.rowIndex !== rowIndex) {
      return errorResponse('Этот телефон уже используется другим пользователем');
    }
  }

  if (newPassword && newPassword.length < 4) {
    return errorResponse('Новый пароль должен быть не короче 4 символов');
  }

  var now = new Date().toISOString();
  var sheet = ss.getSheetByName(SHEET_USERS);
  sheet.getRange(rowIndex, 2, 1, 3).setValues([[name, phone, bank]]);
  if (data.avatarUrl !== undefined) {
    sheet.getRange(rowIndex, 5).setValue((data.avatarUrl || '').toString());
  }
  sheet.getRange(rowIndex, 6).setValue(now);

  if (newPassword) {
    var salt = Utilities.getUuid();
    var hash = hashPassword(newPassword, salt);
    sheet.getRange(rowIndex, 7, 1, 2).setValues([[hash, salt]]);
  }

  // Update user's bank in PartyMembers if partyId provided
  var partyId = (data.partyId || '').toString();
  if (partyId) {
    try {
      var membersSheet = ss.getSheetByName(SHEET_MEMBERS);
      var rows = readSheetRows(membersSheet, 4);
      for (var r = 0; r < rows.length; r++) {
        if ((rows[r][0] || '').toString() === partyId &&
            (rows[r][1] || '').toString() === auth.user.id) {
          membersSheet.getRange(r + 2, 4).setValue(bank);
          break;
        }
      }
    } catch (e) {
      // Non-critical if party update fails
    }
  }

  // Invalidate cache for all rooms the user is a member of so other users see the new avatar immediately
  try {
    var allMembersSheet = ss.getSheetByName(SHEET_MEMBERS);
    var allMemberRows = readSheetRows(allMembersSheet, 2);
    for (var m = 0; m < allMemberRows.length; m++) {
      if ((allMemberRows[m][1] || '').toString() === auth.user.id) {
        invalidatePartyCache((allMemberRows[m][0] || '').toString());
      }
    }
  } catch (e) {
    // Non-critical if cache invalidation fails
  }
  if (partyId) {
    invalidatePartyCache(partyId);
  }

  var updatedUserData = {
    id: auth.user.id,
    name: name,
    phone: phone,
    bank: bank,
    avatarUrl: data.avatarUrl !== undefined ? ((data.avatarUrl || '').toString() || undefined) : auth.user.avatarUrl
  };
  setCachedAuth(auth.user.id, (data.token || '').toString(), updatedUserData);

  return jsonResponse({
    success: true,
    user: updatedUserData
  });
}

// ---------------------------------------------------------------------------
// Party helpers
// ---------------------------------------------------------------------------

function findPartyRow(ss, data) {
  var partyId = (data.partyId || data.roomId || '').toString();
  var code = (data.code || data.roomCode || '').toString().toUpperCase().trim();
  var sheet = ss.getSheetByName(SHEET_PARTIES);

  var found = null;
  if (partyId) {
    found = findRowByColumnValue(sheet, 1, partyId, 5);
  }
  if (!found && code) {
    found = findRowByColumnValue(sheet, 2, code, 5);
  }
  if (!found) return null;

  var row = found.row;
  return {
    id: (row[0] || '').toString(),
    code: (row[1] || '').toString(),
    title: (row[2] || 'Тусовка').toString(),
    createdBy: (row[3] || '').toString(),
    createdAt: (row[4] || '').toString(),
    rowIndex: found.rowIndex
  };
}

/**
 * One read of PartyMembers for a room. The previous implementation re-read
 * the whole sheet once per participant via getMemberBank().
 */
function getPartyMemberData(ss, partyId) {
  var rows = readSheetRows(ss.getSheetByName(SHEET_MEMBERS), 4);
  var ids = [];
  var bankByUserId = {};

  for (var r = 0; r < rows.length; r++) {
    if ((rows[r][0] || '').toString() !== partyId) continue;
    var id = (rows[r][1] || '').toString();
    if (!id) continue;
    if (ids.indexOf(id) === -1) ids.push(id);
    bankByUserId[id] = normalizeBank(rows[r][3]);
  }

  return { ids: ids, bankByUserId: bankByUserId };
}

function getPartyMemberIds(ss, partyId) {
  return getPartyMemberData(ss, partyId).ids;
}

function isPartyMember(ss, partyId, userId) {
  return getPartyMemberIds(ss, partyId).indexOf(userId) !== -1;
}

function buildPartyDetailsPayload(ss, party, memberData) {
  if (!party) return { success: false, error: 'Тусовка не найдена' };

  var members = memberData || getPartyMemberData(ss, party.id);
  var userRows = readSheetRows(ss.getSheetByName(SHEET_USERS), 5);
  var usersMap = {};
  for (var u = 0; u < userRows.length; u++) {
    var uid = (userRows[u][0] || '').toString();
    if (!uid) continue;
    usersMap[uid] = {
      id: uid,
      name: (userRows[u][1] || 'Участник').toString(),
      phone: (userRows[u][2] || '').toString(),
      bank: normalizeBank(userRows[u][3]),
      avatarUrl: (userRows[u][4] || '').toString() || undefined
    };
  }

  var participants = [];
  for (var i = 0; i < members.ids.length; i++) {
    var mid = members.ids[i];
    var base = usersMap[mid] || {
      id: mid,
      name: 'Участник',
      phone: '',
      bank: 'Сбербанк'
    };
    participants.push({
      id: base.id,
      name: base.name,
      phone: base.phone,
      bank: members.bankByUserId[mid] || base.bank,
      avatarUrl: base.avatarUrl
    });
  }

  var expRows = readSheetRows(ss.getSheetByName(SHEET_EXPENSES), 8);
  var expenses = [];
  for (var e = 0; e < expRows.length; e++) {
    if ((expRows[e][1] || '').toString() !== party.id) continue;
    var sharedUserIds = [];
    try {
      sharedUserIds = JSON.parse(expRows[e][5]);
    } catch (err) {
      sharedUserIds = [];
    }
    if (!Array.isArray(sharedUserIds)) sharedUserIds = [];
    sharedUserIds = sharedUserIds
      .map(function (id) { return (id || '').toString(); })
      .filter(function (id) { return id.length > 0; });

    expenses.push({
      id: (expRows[e][0] || '').toString(),
      partyId: party.id,
      title: (expRows[e][2] || 'Расход').toString(),
      amount: Number(expRows[e][3]) || 0,
      paidById: (expRows[e][4] || '').toString(),
      sharedUserIds: sharedUserIds,
      createdAt: (expRows[e][6] || '').toString(),
      category: (expRows[e][7] || '').toString()
    });
  }

  var statusRows = readSheetRows(ss.getSheetByName(SHEET_STATUSES), 8);
  var paymentStatuses = [];
  for (var s = 0; s < statusRows.length; s++) {
    if ((statusRows[s][0] || '').toString() !== party.id) continue;
    paymentStatuses.push({
      transferId: (statusRows[s][1] || '').toString(),
      fromUserId: (statusRows[s][2] || '').toString(),
      toUserId: (statusRows[s][3] || '').toString(),
      amount: Number(statusRows[s][4]) || 0,
      isPaid: statusRows[s][5] === true ||
        (statusRows[s][5] || '').toString().toLowerCase() === 'true',
      updatedAt: (statusRows[s][7] || '').toString()
    });
  }

  var shoppingSheet = getOrCreateShoppingSheet(ss);
  var shopRows = readSheetRows(shoppingSheet, 11);
  var shoppingList = [];
  for (var sh = 0; sh < shopRows.length; sh++) {
    if ((shopRows[sh][1] || '').toString() !== party.id) continue;
    var estAmt = Number(shopRows[sh][3]);
    var actAmt = Number(shopRows[sh][7]);
    shoppingList.push({
      id: (shopRows[sh][0] || '').toString(),
      partyId: party.id,
      title: (shopRows[sh][2] || '').toString(),
      estimatedAmount: !isNaN(estAmt) && estAmt > 0 ? estAmt : undefined,
      assignedUserId: (shopRows[sh][4] || '').toString() || undefined,
      isBought: shopRows[sh][5] === true ||
        (shopRows[sh][5] || '').toString().toLowerCase() === 'true',
      boughtById: (shopRows[sh][6] || '').toString() || undefined,
      actualAmount: !isNaN(actAmt) && actAmt > 0 ? actAmt : undefined,
      convertedExpenseId: (shopRows[sh][8] || '').toString() || undefined,
      category: (shopRows[sh][9] || '').toString() || undefined,
      createdAt: (shopRows[sh][10] || '').toString()
    });
  }

  return {
    success: true,
    apiVersion: API_VERSION,
    party: {
      id: party.id,
      code: party.code,
      title: party.title,
      createdBy: party.createdBy,
      createdAt: party.createdAt
    },
    participants: participants,
    expenses: expenses,
    paymentStatuses: paymentStatuses,
    shoppingList: shoppingList
  };
}

function requireMember(ss, data, partyId) {
  var auth = authenticate(ss, data);
  if (auth.error) return { error: auth.error };

  var memberData = getPartyMemberData(ss, partyId);
  if (memberData.ids.indexOf(auth.user.id) === -1) {
    return { error: 'Вы не участник этой комнаты' };
  }

  return {
    user: auth.user,
    row: auth.row,
    rowIndex: auth.rowIndex,
    memberData: memberData
  };
}

function getPartyDetails(ss, data) {
  var partyId = (data.partyId || '').toString();

  // Fast path: if partyId is known, check party cache before doing sheet lookups
  if (partyId) {
    var cached = readPartyCache(partyId);
    if (cached && cached.party) {
      var auth = authenticate(ss, data);
      if (auth.error) return errorResponse(auth.error);
      var isMember = false;
      if (Array.isArray(cached.participants)) {
        for (var p = 0; p < cached.participants.length; p++) {
          if (cached.participants[p].id === auth.user.id) {
            isMember = true;
            break;
          }
        }
      }
      if (isMember) {
        return jsonResponse(cached);
      }
    }
  }

  var party = findPartyRow(ss, data);
  if (!party) return errorResponse('Тусовка не найдена');
  var auth = requireMember(ss, data, party.id);
  if (auth.error) return errorResponse(auth.error);

  var cached = readPartyCache(party.id);
  if (cached) return jsonResponse(cached);

  var payload = buildPartyDetailsPayload(ss, party, auth.memberData);
  writePartyCache(party.id, payload);
  return jsonResponse(payload);
}

// ---------------------------------------------------------------------------
// Party actions
// ---------------------------------------------------------------------------

function createParty(ss, data) {
  var auth = authenticate(ss, data);
  if (auth.error) return errorResponse(auth.error);

  var title = (data.title || 'Новая тусовка').toString().trim() || 'Новая тусовка';
  var bank = normalizeBank(data.bank || auth.user.bank);
  var partyId = 'party_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
  var code = generateRoomCode(ss);
  var now = new Date().toISOString();

  ss.getSheetByName(SHEET_PARTIES).appendRow([
    partyId, code, title, auth.user.id, now
  ]);
  ss.getSheetByName(SHEET_MEMBERS).appendRow([
    partyId, auth.user.id, now, bank
  ]);

  var party = {
    id: partyId,
    code: code,
    title: title,
    createdBy: auth.user.id,
    createdAt: now
  };
  var payload = buildPartyDetailsPayload(ss, party);
  writePartyCache(partyId, payload);
  return jsonResponse(payload);
}

function joinParty(ss, data) {
  var auth = authenticate(ss, data);
  if (auth.error) return errorResponse(auth.error);

  var rawCode = (data.code || '').toString().toUpperCase().trim();
  if (!rawCode) return errorResponse('Укажите код комнаты');

  var party = findPartyRow(ss, { code: rawCode });
  if (!party) {
    return errorResponse('Тусовка с кодом "' + rawCode + '" не найдена. Проверьте код!');
  }

  var bank = normalizeBank(data.bank || auth.user.bank);
  var membersSheet = ss.getSheetByName(SHEET_MEMBERS);
  var rows = readSheetRows(membersSheet, 4);
  var memberRowIndex = -1;
  for (var r = 0; r < rows.length; r++) {
    if ((rows[r][0] || '').toString() === party.id &&
        (rows[r][1] || '').toString() === auth.user.id) {
      memberRowIndex = r + 2;
      break;
    }
  }

  if (memberRowIndex > 0) {
    // Re-entering a room confirms its bank for this gathering.
    membersSheet.getRange(memberRowIndex, 4).setValue(bank);
  } else {
    membersSheet.appendRow([party.id, auth.user.id, new Date().toISOString(), bank]);
  }

  var payload = buildPartyDetailsPayload(ss, party);
  writePartyCache(party.id, payload);
  return jsonResponse(payload);
}

function leaveParty(ss, data) {
  var party = findPartyRow(ss, data);
  if (!party) return errorResponse('Тусовка не найдена');

  // Leaving must be idempotent: the client may retry after a lost response.
  var auth = authenticate(ss, data);
  if (auth.error) return errorResponse(auth.error);
  var memberData = getPartyMemberData(ss, party.id);
  if (memberData.ids.indexOf(auth.user.id) === -1) {
    invalidatePartyCache(party.id);
    return jsonResponse({ success: true, alreadyLeft: true });
  }

  var membersSheet = ss.getSheetByName(SHEET_MEMBERS);
  var memberRows = readSheetRows(membersSheet, 4);
  for (var r = memberRows.length - 1; r >= 0; r--) {
    if ((memberRows[r][0] || '').toString() === party.id &&
        (memberRows[r][1] || '').toString() === auth.user.id) {
      membersSheet.deleteRow(r + 2);
    }
  }

  var remainingIds = memberData.ids.filter(function (id) {
    return id !== auth.user.id;
  });
  var expensesSheet = ss.getSheetByName(SHEET_EXPENSES);
  var expRows = readSheetRows(expensesSheet, 8);
  var updates = [];
  var minRow = 0;
  var maxRow = 0;

  for (var e = 0; e < expRows.length; e++) {
    if ((expRows[e][1] || '').toString() !== party.id) continue;

    var shared = [];
    try {
      shared = JSON.parse(expRows[e][5]);
    } catch (err) {
      shared = [];
    }
    if (!Array.isArray(shared)) shared = [];
    var newShared = shared
      .map(function (id) { return (id || '').toString(); })
      .filter(function (id) { return id && id !== auth.user.id; });

    var paidById = (expRows[e][4] || '').toString();
    if (paidById === auth.user.id && remainingIds.length > 0) {
      paidById = remainingIds[0];
    }

    var rowNumber = e + 2;
    updates.push({
      row: rowNumber,
      values: [paidById, JSON.stringify(newShared)]
    });
    if (!minRow || rowNumber < minRow) minRow = rowNumber;
    if (rowNumber > maxRow) maxRow = rowNumber;
  }

  // All affected expense rows are written in one contiguous setValues call
  // instead of one setValues per row inside the loop.
  if (updates.length > 0) {
    var width = 2;
    var block = expensesSheet.getRange(minRow, 5, maxRow - minRow + 1, width).getValues();
    for (var u = 0; u < updates.length; u++) {
      block[updates[u].row - minRow] = updates[u].values;
    }
    expensesSheet.getRange(minRow, 5, maxRow - minRow + 1, width).setValues(block);
  }

  invalidatePartyCache(party.id);
  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------------------
// Expense actions
// ---------------------------------------------------------------------------

function validateExpenseMembers(memberIds, paidById, sharedUserIds) {
  if (memberIds.indexOf(paidById) === -1) {
    return 'Плательщик не является участником комнаты';
  }
  for (var i = 0; i < sharedUserIds.length; i++) {
    if (memberIds.indexOf(sharedUserIds[i]) === -1) {
      return 'Один из выбранных участников не состоит в комнате';
    }
  }
  return null;
}

function addExpense(ss, data) {
  var partyId = (data.partyId || '').toString();
  var title = (data.title || 'Расход').toString().trim() || 'Расход';
  var amount = Number(data.amount);
  var paidById = (data.paidById || '').toString();
  var sharedUserIds = Array.isArray(data.sharedUserIds) ? data.sharedUserIds : [];
  var category = (data.category || '').toString().trim();

  if (!partyId || !title || isNaN(amount) || amount <= 0 || !paidById) {
    return errorResponse('Некорректные данные расхода (partyId, title, amount > 0, paidById)');
  }
  var party = findPartyRow(ss, { partyId: partyId });
  if (!party) return errorResponse('Тусовка не найдена');

  var auth = requireMember(ss, data, party.id);
  if (auth.error) return errorResponse(auth.error);

  sharedUserIds = sharedUserIds
    .map(function (id) { return (id || '').toString(); })
    .filter(function (id) { return id.length > 0; });
  if (sharedUserIds.length === 0) {
    return errorResponse('Выберите хотя бы одного участника расхода');
  }

  var memberError = validateExpenseMembers(
    auth.memberData.ids,
    paidById,
    sharedUserIds
  );
  if (memberError) return errorResponse(memberError);

  var expId = (data.id || '').toString().trim();
  var expensesSheet = ss.getSheetByName(SHEET_EXPENSES);

  // The id makes addExpense idempotent, which is essential for safe retries
  // when a queue request succeeds on the server but the response is lost.
  var existing = expId
    ? findRowByColumnValue(expensesSheet, 1, expId, 8)
    : null;
  if (existing) {
    if ((existing.row[1] || '').toString() !== partyId) {
      return errorResponse('Расход с таким id уже существует в другой комнате');
    }
    var existingShared = [];
    try {
      existingShared = JSON.parse(existing.row[5]);
    } catch (err) {
      existingShared = [];
    }
    if (!Array.isArray(existingShared)) existingShared = [];

    return jsonResponse({
      success: true,
      expense: {
        id: expId,
        partyId: (existing.row[1] || '').toString(),
        title: (existing.row[2] || 'Расход').toString(),
        amount: Number(existing.row[3]) || 0,
        paidById: (existing.row[4] || '').toString(),
        sharedUserIds: existingShared.map(function (item) {
          return (item || '').toString();
        }),
        createdAt: (existing.row[6] || '').toString(),
        category: (existing.row[7] || '').toString()
      }
    });
  }

  if (!expId) {
    expId = 'exp_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
  }

  var now = new Date().toISOString();
  var sharedJson = JSON.stringify(sharedUserIds);
  expensesSheet.appendRow([
    expId, partyId, title, amount, paidById, sharedJson, now, category
  ]);
  invalidatePartyCache(party.id);

  return jsonResponse({
    success: true,
    expense: {
      id: expId,
      partyId: partyId,
      title: title,
      amount: amount,
      paidById: paidById,
      sharedUserIds: sharedUserIds,
      createdAt: now,
      category: category
    }
  });
}

function updateExpense(ss, data) {
  var expenseId = (data.expenseId || '').toString();
  if (!expenseId) return errorResponse('Укажите expenseId расхода');

  var expensesSheet = ss.getSheetByName(SHEET_EXPENSES);
  var existing = findRowByColumnValue(expensesSheet, 1, expenseId, 8);
  if (!existing) return errorResponse('Расход не найден в таблице');

  var partyId = (data.partyId || '').toString() ||
    (existing.row[1] || '').toString();
  var actualPartyId = (existing.row[1] || '').toString();
  if (partyId && partyId !== actualPartyId) {
    return errorResponse('Расход принадлежит другой комнате');
  }
  partyId = actualPartyId;

  var party = findPartyRow(ss, { partyId: partyId });
  if (!party) return errorResponse('Тусовка не найдена');
  var auth = requireMember(ss, data, party.id);
  if (auth.error) return errorResponse(auth.error);

  var title = (data.title || '').toString().trim();
  var amount = Number(data.amount);
  var paidById = (data.paidById || '').toString();
  var sharedUserIds = Array.isArray(data.sharedUserIds) ? data.sharedUserIds : [];
  var category = (data.category || '').toString().trim();

  if (!title || isNaN(amount) || amount <= 0 || !paidById) {
    return errorResponse('Некорректные данные расхода (title, amount > 0, paidById)');
  }

  sharedUserIds = sharedUserIds
    .map(function (id) { return (id || '').toString(); })
    .filter(function (id) { return id.length > 0; });
  if (sharedUserIds.length === 0) {
    return errorResponse('Выберите хотя бы одного участника расхода');
  }

  var memberError = validateExpenseMembers(
    auth.memberData.ids,
    paidById,
    sharedUserIds
  );
  if (memberError) return errorResponse(memberError);

  var createdAt = (existing.row[6] || '').toString();
  expensesSheet
    .getRange(existing.rowIndex, 3, 1, 6)
    .setValues([[
      title,
      amount,
      paidById,
      JSON.stringify(sharedUserIds),
      createdAt,
      category
    ]]);
  invalidatePartyCache(party.id);

  return jsonResponse({
    success: true,
    expense: {
      id: expenseId,
      partyId: partyId,
      title: title,
      amount: amount,
      paidById: paidById,
      sharedUserIds: sharedUserIds,
      createdAt: createdAt,
      category: category
    }
  });
}

function deleteExpense(ss, data) {
  var expenseId = (data.expenseId || '').toString();
  if (!expenseId) return errorResponse('Укажите expenseId расхода');

  var expensesSheet = ss.getSheetByName(SHEET_EXPENSES);
  var existing = findRowByColumnValue(expensesSheet, 1, expenseId, 8);

  // Idempotent: a retried delete after a lost response succeeds.
  if (!existing) return jsonResponse({ success: true });

  var partyId = (data.partyId || '').toString() ||
    (existing.row[1] || '').toString();
  var actualPartyId = (existing.row[1] || '').toString();
  if (partyId && partyId !== actualPartyId) {
    return errorResponse('Расход принадлежит другой комнате');
  }
  partyId = actualPartyId;

  var party = findPartyRow(ss, { partyId: partyId });
  if (!party) return errorResponse('Тусовка не найдена');
  var auth = requireMember(ss, data, party.id);
  if (auth.error) return errorResponse(auth.error);

  expensesSheet.deleteRow(existing.rowIndex);
  invalidatePartyCache(party.id);
  return jsonResponse({ success: true });
}

function updatePartyTitle(ss, data) {
  var party = findPartyRow(ss, data);
  if (!party) return errorResponse('Тусовка не найдена');
  var auth = requireMember(ss, data, party.id);
  if (auth.error) return errorResponse(auth.error);

  var title = (data.title || '').toString().trim();
  if (!title) return errorResponse('Укажите новое название');
  ss.getSheetByName(SHEET_PARTIES).getRange(party.rowIndex, 3).setValue(title);
  invalidatePartyCache(party.id);
  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------------------
// Realtime payment status
// ---------------------------------------------------------------------------

function setTransferStatus(ss, data) {
  var party = findPartyRow(ss, data);
  if (!party) return errorResponse('Тусовка не найдена');
  var auth = requireMember(ss, data, party.id);
  if (auth.error) return errorResponse(auth.error);

  var fromUserId = (data.fromUserId || data.userId || '').toString();
  var toUserId = (data.toUserId || '').toString();
  var transferId = (data.transferId || '').toString();
  if (!transferId && fromUserId && toUserId) {
    transferId = 'transfer_' + fromUserId + '_' + toUserId;
  }
  var amount = Number(data.amount);
  var isPaid = data.isPaid === true || data.isPaid === 'true' || data.isPaid === 1;

  if (!transferId || !fromUserId || !toUserId || isNaN(amount) || amount <= 0) {
    return errorResponse('Некорректные данные статуса перевода');
  }

  var memberIds = auth.memberData.ids;
  if (memberIds.indexOf(fromUserId) === -1 || memberIds.indexOf(toUserId) === -1) {
    return errorResponse('Участники перевода не состоят в комнате');
  }

  var sheet = ss.getSheetByName(SHEET_STATUSES);
  var rows = readSheetRows(sheet, 8);
  var rowIndex = -1;
  for (var r = 0; r < rows.length; r++) {
    if ((rows[r][0] || '').toString() === party.id) {
      var rowTid = (rows[r][1] || '').toString();
      var rowFrom = (rows[r][2] || '').toString();
      var rowTo = (rows[r][3] || '').toString();
      if (rowTid === transferId || (rowFrom === fromUserId && rowTo === toUserId)) {
        rowIndex = r + 2;
        break;
      }
    }
  }

  var now = new Date().toISOString();
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 2, 1, 7).setValues([[
      transferId, fromUserId, toUserId, amount, isPaid, auth.user.id, now
    ]]);
  } else {
    sheet.appendRow([
      party.id, transferId, fromUserId, toUserId, amount, isPaid, auth.user.id, now
    ]);
  }
  invalidatePartyCache(party.id);

  return jsonResponse({
    success: true,
    status: {
      transferId: transferId,
      fromUserId: fromUserId,
      toUserId: toUserId,
      amount: amount,
      isPaid: isPaid,
      updatedAt: now
    }
  });
}

// ---------------------------------------------------------------------------
// Shopping List actions
// ---------------------------------------------------------------------------

function getOrCreateShoppingSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_SHOPPING);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SHOPPING);
    sheet.appendRow([
      'id', 'partyId', 'title', 'estimatedAmount', 'assignedUserId',
      'isBought', 'boughtById', 'actualAmount', 'convertedExpenseId',
      'category', 'createdAt'
    ]);
    sheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#E2E8F0');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function addShoppingItem(ss, data) {
  var party = findPartyRow(ss, data);
  if (!party) return errorResponse('Тусовка не найдена');
  var auth = requireMember(ss, data, party.id);
  if (auth.error) return errorResponse(auth.error);

  var title = (data.title || '').toString().trim();
  if (!title) return errorResponse('Укажите название покупки');
  var id = (data.id || '').toString() || ('shop_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000));
  var estimatedAmount = Number(data.estimatedAmount) || 0;
  var assignedUserId = (data.assignedUserId || '').toString();
  var isBought = data.isBought === true || data.isBought === 'true';
  var boughtById = (data.boughtById || '').toString();
  var actualAmount = Number(data.actualAmount) || 0;
  var convertedExpenseId = (data.convertedExpenseId || '').toString();
  var category = (data.category || '').toString();
  var createdAt = (data.createdAt || '').toString() || new Date().toISOString();

  var sheet = getOrCreateShoppingSheet(ss);
  var existing = findRowByColumnValue(sheet, 1, id, 11);

  if (existing && (existing.row[1] || '').toString() === party.id) {
    sheet.getRange(existing.rowIndex, 3, 1, 8).setValues([[
      title, estimatedAmount || '', assignedUserId, isBought, boughtById,
      actualAmount || '', convertedExpenseId, category
    ]]);
  } else {
    sheet.appendRow([
      id, party.id, title, estimatedAmount || '', assignedUserId,
      isBought, boughtById, actualAmount || '', convertedExpenseId,
      category, createdAt
    ]);
  }
  invalidatePartyCache(party.id);

  return jsonResponse({
    success: true,
    item: {
      id: id,
      partyId: party.id,
      title: title,
      estimatedAmount: estimatedAmount || undefined,
      assignedUserId: assignedUserId || undefined,
      isBought: isBought,
      boughtById: boughtById || undefined,
      actualAmount: actualAmount || undefined,
      convertedExpenseId: convertedExpenseId || undefined,
      category: category || undefined,
      createdAt: createdAt
    }
  });
}

function updateShoppingItem(ss, data) {
  var itemId = (data.id || data.itemId || '').toString();
  if (!itemId) return errorResponse('Укажите id покупки');

  var sheet = getOrCreateShoppingSheet(ss);
  var existing = findRowByColumnValue(sheet, 1, itemId, 11);

  var partyId = existing ? (existing.row[1] || '').toString() : (data.partyId || data.roomId || '').toString();
  var party = findPartyRow(ss, { partyId: partyId });
  if (!party) return errorResponse('Тусовка не найдена');
  var auth = requireMember(ss, data, party.id);
  if (auth.error) return errorResponse(auth.error);

  var title = data.title !== undefined ? (data.title || '').toString().trim() : (existing ? existing.row[2] : 'Покупка');
  var estimatedAmount = data.estimatedAmount !== undefined ? (Number(data.estimatedAmount) || '') : (existing ? existing.row[3] : '');
  var assignedUserId = data.assignedUserId !== undefined ? (data.assignedUserId || '').toString() : (existing ? existing.row[4] : '');
  var isBought = data.isBought !== undefined ? (data.isBought === true || data.isBought === 'true') : (existing ? existing.row[5] : false);
  var boughtById = data.boughtById !== undefined ? (data.boughtById || '').toString() : (existing ? existing.row[6] : '');
  var actualAmount = data.actualAmount !== undefined ? (Number(data.actualAmount) || '') : (existing ? existing.row[7] : '');
  var convertedExpenseId = data.convertedExpenseId !== undefined ? (data.convertedExpenseId || '').toString() : (existing ? existing.row[8] : '');
  var category = data.category !== undefined ? (data.category || '').toString() : (existing ? existing.row[9] : '');

  if (existing) {
    sheet.getRange(existing.rowIndex, 3, 1, 8).setValues([[
      title, estimatedAmount, assignedUserId, isBought, boughtById, actualAmount, convertedExpenseId, category
    ]]);
  } else {
    var createdAt = new Date().toISOString();
    sheet.appendRow([
      itemId, party.id, title, estimatedAmount, assignedUserId,
      isBought, boughtById, actualAmount, convertedExpenseId,
      category, createdAt
    ]);
  }
  invalidatePartyCache(party.id);

  return jsonResponse({ success: true });
}

function deleteShoppingItem(ss, data) {
  var itemId = (data.id || data.itemId || '').toString();
  if (!itemId) return errorResponse('Укажите id покупки');

  var sheet = ss.getSheetByName(SHEET_SHOPPING);
  var existing = findRowByColumnValue(sheet, 1, itemId, 11);
  if (!existing) return jsonResponse({ success: true });

  var partyId = (existing.row[1] || '').toString();
  var party = findPartyRow(ss, { partyId: partyId });
  if (!party) return errorResponse('Тусовка не найдена');
  var auth = requireMember(ss, data, party.id);
  if (auth.error) return errorResponse(auth.error);

  sheet.deleteRow(existing.rowIndex);
  invalidatePartyCache(party.id);
  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return jsonResponse({
    success: false,
    error: msg
  });
}
