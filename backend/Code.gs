/**
 * =========================================================================================
 * PARTY SPLIT — GOOGLE APPS SCRIPT WEB APP BACKEND (Google Sheets)
 * =========================================================================================
 *
 * Полноценный облачный бэкенд для совместного разделения расходов (Split Bill)
 * на Google Таблицах + Google Apps Script Web App.
 *
 * СТРУКТУРА ТАБЛИЦ (автоматически создаются при первом запуске):
 * 1. Users:        [id, name, phone, bankName, paymentUrl, updatedAt]
 * 2. Parties:      [id, code, title, createdBy, createdAt]
 * 3. PartyMembers: [partyId, userId, joinedAt]
 * 4. Expenses:     [id, partyId, title, amount, paidById, sharedUserIds, createdAt, category]
 *
 * ИНСТРУКЦИЯ ПО РАЗВЁРТЫВАНИЮ (ПОШАГОВО):
 * 1. Откройте Google Диск (drive.google.com) и создайте новую Google Таблицу (Google Sheets).
 * 2. Назовите её, например: "PartySplit Database".
 * 3. В верхнем меню выберите: "Расширения" (Extensions) -> "Apps Script".
 * 4. Удалите шаблонный код в файле Code.gs и вставьте весь этот скрипт целиком.
 * 5. Нажмите иконку дискеты "Сохранить" (Ctrl+S / Cmd+S).
 * 6. Нажмите синюю кнопку в правом верхнем углу: "Развернуть" (Deploy) -> "Новое развертывание" (New deployment).
 * 7. В появившемся окне нажмите на шестерёнку слева от "Выберите тип" -> выберите "Веб-приложение" (Web app).
 * 8. Настройте параметры доступа ОБЯЗАТЕЛЬНО:
 *    - Описание: "PartySplit Production API"
 *    - Выполнять от имени: "Меня" (Me - your_email@gmail.com)
 *    - У кого есть доступ: "Все" (Anyone)  <--- КРИТИЧЕСКИ ВАЖНО, чтобы приложение подключалось без логина!
 * 9. Нажмите "Развернуть" (Deploy), при запросе разрешений предоставьте доступ вашему Google Аккаунту.
 * 10. Скопируйте полученный "URL веб-приложения" (Web app URL, заканчивается на /exec).
 * 11. Вставьте этот URL в мобильном приложении на вкладке «Профиль и Настройки» в поле "URL Google Apps Script".
 * =========================================================================================
 */

// Константы имён листов
var SHEET_USERS = 'Users';
var SHEET_PARTIES = 'Parties';
var SHEET_MEMBERS = 'PartyMembers';
var SHEET_EXPENSES = 'Expenses';

/**
 * Инициализация структуры листов и заголовков при их отсутствии
 */
function initDatabaseIfNeeded(ss) {
  var sheets = {
    Users: ['id', 'name', 'phone', 'bankName', 'paymentUrl', 'updatedAt'],
    Parties: ['id', 'code', 'title', 'createdBy', 'createdAt'],
    PartyMembers: ['partyId', 'userId', 'joinedAt'],
    Expenses: ['id', 'partyId', 'title', 'amount', 'paidById', 'sharedUserIds', 'createdAt', 'category']
  };

  for (var name in sheets) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(sheets[name]);
      sheet.getRange(1, 1, 1, sheets[name].length).setFontWeight('bold').setBackground('#E2E8F0');
      sheet.setFrozenRows(1);
      continue;
    }

    // Миграция: добавляем новые колонки (например, category) к уже
    // существующим таблицам, не трогая данные.
    var headers = sheets[name];
    var lastColumn = sheet.getLastColumn();
    if (lastColumn > 0 && lastColumn < headers.length) {
      var missing = headers.slice(lastColumn);
      var targetRange = sheet.getRange(1, lastColumn + 1, 1, missing.length);
      targetRange.setValues([missing]);
      targetRange.setFontWeight('bold').setBackground('#E2E8F0');
    }
  }
}

/**
 * Генерация короткого 6-значного кода комнаты (например, "PUB777", "BAR404")
 */
function generateRoomCode(ss) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var prefixes = ['PUB', 'BAR', 'VIBE', 'CHILL', 'BEER', 'FOOD', 'GO'];
  var prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  var suffix = '';
  for (var i = 0; i < 3; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  var code = prefix + suffix;

  // Проверка уникальности
  var partySheet = ss.getSheetByName(SHEET_PARTIES);
  if (!partySheet) return code;
  var data = partySheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if ((data[r][1] || '').toString().toUpperCase() === code) {
      return generateRoomCode(ss); // Рекурсивный повтор при совпадении
    }
  }
  return code;
}

/**
 * Обработка GET-запросов (ping / тестовые запросы)
 */
function doGet(e) {
  var params = e ? e.parameter : {};
  if (params.action) {
    return handleApiAction(params.action, params);
  }
  return jsonResponse({
    status: 'online',
    service: 'PartySplit Google Apps Script Web App',
    timestamp: new Date().toISOString(),
    message: 'Backend активен и готов к обработке запросов тусовок!'
  });
}

/**
 * Обработка POST-запросов от мобильного приложения
 */
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

/**
 * Маршрутизатор действий API
 */
function handleApiAction(action, data) {
  var lock = LockService.getScriptLock();
  try {
    // Блокировка на 30 сек для безопасной конкурентной записи в таблицы
    lock.waitLock(30000);
  } catch (e) {
    return errorResponse('Сервер перегружен, повторите попытку через пару секунд');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    initDatabaseIfNeeded(ss);

    switch (action) {
      case 'ping':
        return jsonResponse({ success: true, message: 'Подключение к Google Sheets успешно!' });

      case 'registerOrUpdateUser':
        return registerOrUpdateUser(ss, data);

      case 'createParty':
        return createParty(ss, data);

      case 'joinParty':
        return joinParty(ss, data);

      case 'getPartyDetails':
        return getPartyDetails(ss, data);

      case 'addExpense':
        return addExpense(ss, data);

      case 'syncPartyMembers':
        return syncPartyMembers(ss, data);

      case 'removePartyMember':
        return removePartyMember(ss, data);

      case 'updateExpense':
        return updateExpense(ss, data);

      case 'deleteExpense':
        return deleteExpense(ss, data);

      case 'updatePartyTitle':
        return updatePartyTitle(ss, data);

      default:
        return errorResponse('Неизвестное действие (action): ' + action);
    }
  } catch (err) {
    return errorResponse(err.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * 1. Регистрация или обновление реквизитов участника
 * Вход: { id, name, phone, bankName, paymentUrl }
 */
function registerOrUpdateUser(ss, data) {
  var userId = (data.id || ('user_' + new Date().getTime())).toString();
  var name = (data.name || 'Друг').toString().trim() || 'Друг';
  var phone = (data.phone || '').toString().trim();
  // Legacy column: the client now uses SBP only and does not send a bank.
  var bankName = (data.bankName || 'sbp').toString().toLowerCase().trim();
  var paymentUrl = (data.paymentUrl || '').toString().trim();
  var now = new Date().toISOString();

  var sheet = ss.getSheetByName(SHEET_USERS);
  var values = sheet.getDataRange().getValues();
  var userRowIndex = -1;

  for (var r = 1; r < values.length; r++) {
    if ((values[r][0] || '').toString() === userId) {
      userRowIndex = r + 1;
      break;
    }
  }

  if (userRowIndex > 0) {
    // Обновление существующего
    sheet.getRange(userRowIndex, 2, 1, 5).setValues([[name, phone, bankName, paymentUrl, now]]);
  } else {
    // Создание нового
    sheet.appendRow([userId, name, phone, bankName, paymentUrl, now]);
  }

  return jsonResponse({
    success: true,
    user: {
      id: userId,
      name: name,
      phone: phone,
      bankName: bankName,
      paymentUrl: paymentUrl,
      updatedAt: now
    }
  });
}

/**
 * 2. Создание комнаты тусовки с генерацией 6-значного кода
 * Вход: { title, createdBy (userId), name, phone, bankName, paymentUrl }
 */
function createParty(ss, data) {
  var title = (data.title || 'Новая тусовка').toString().trim();
  var createdBy = (data.createdBy || data.userId || '').toString();
  if (!createdBy) {
    return errorResponse('Укажите createdBy (userId) организатора');
  }

  // Если переданы реквизиты пользователя — обновим в базе
  if (data.name) {
    registerOrUpdateUser(ss, {
      id: createdBy,
      name: data.name,
      phone: data.phone,
      bankName: data.bankName,
      paymentUrl: data.paymentUrl
    });
  }

  var partyId = 'party_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
  var code = generateRoomCode(ss);
  var now = new Date().toISOString();

  // Запись в Parties
  var partiesSheet = ss.getSheetByName(SHEET_PARTIES);
  partiesSheet.appendRow([partyId, code, title, createdBy, now]);

  // Добавление создателя в PartyMembers
  var membersSheet = ss.getSheetByName(SHEET_MEMBERS);
  membersSheet.appendRow([partyId, createdBy, now]);

  return getPartyDetails(ss, { partyId: partyId });
}

/**
 * 3. Вход в существующую тусовку по коду комнаты
 * Вход: { code, userId, name, phone, bankName, paymentUrl }
 */
function joinParty(ss, data) {
  var rawCode = (data.code || '').toString().toUpperCase().trim();
  var userId = (data.userId || '').toString();
  if (!rawCode || !userId) {
    return errorResponse('Укажите code комнаты и userId участника');
  }

  // Обновим реквизиты участника при наличии
  if (data.name) {
    registerOrUpdateUser(ss, {
      id: userId,
      name: data.name,
      phone: data.phone,
      bankName: data.bankName,
      paymentUrl: data.paymentUrl
    });
  }

  // Поиск тусовки по коду
  var partiesSheet = ss.getSheetByName(SHEET_PARTIES);
  var partyData = partiesSheet.getDataRange().getValues();
  var partyId = null;

  for (var r = 1; r < partyData.length; r++) {
    if ((partyData[r][1] || '').toString().toUpperCase() === rawCode) {
      partyId = (partyData[r][0] || '').toString();
      break;
    }
  }

  if (!partyId) {
    return errorResponse('Тусовка с кодом "' + rawCode + '" не найдена. Проверьте правильность кода!');
  }

  // Проверка и добавление в PartyMembers
  var membersSheet = ss.getSheetByName(SHEET_MEMBERS);
  var memberData = membersSheet.getDataRange().getValues();
  var isMember = false;

  for (var m = 1; m < memberData.length; m++) {
    if ((memberData[m][0] || '').toString() === partyId && (memberData[m][1] || '').toString() === userId) {
      isMember = true;
      break;
    }
  }

  if (!isMember) {
    membersSheet.appendRow([partyId, userId, new Date().toISOString()]);
  }

  return getPartyDetails(ss, { partyId: partyId });
}

/**
 * 4. Получение полной информации о тусовке (участники с реквизитами + расходы)
 * Вход: { partyId } ИЛИ { code }
 */
function getPartyDetails(ss, data) {
  var partyId = (data.partyId || '').toString();
  var code = data.code ? data.code.toString().toUpperCase().trim() : null;

  var partiesSheet = ss.getSheetByName(SHEET_PARTIES);
  var partyRows = partiesSheet.getDataRange().getValues();
  var targetParty = null;

  for (var r = 1; r < partyRows.length; r++) {
    var pId = (partyRows[r][0] || '').toString();
    var pCode = (partyRows[r][1] || '').toString().toUpperCase();
    if ((partyId && pId === partyId) || (code && pCode === code)) {
      targetParty = {
        id: pId,
        code: (partyRows[r][1] || '').toString(),
        title: (partyRows[r][2] || 'Тусовка').toString(),
        createdBy: (partyRows[r][3] || '').toString(),
        createdAt: (partyRows[r][4] || '').toString()
      };
      partyId = pId;
      break;
    }
  }

  if (!targetParty) {
    return errorResponse('Тусовка не найдена');
  }

  // 1. Поиск ID участников этой тусовки
  var membersSheet = ss.getSheetByName(SHEET_MEMBERS);
  var memberRows = membersSheet.getDataRange().getValues();
  var memberIds = [];

  for (var m = 1; m < memberRows.length; m++) {
    if ((memberRows[m][0] || '').toString() === partyId) {
      var memberId = (memberRows[m][1] || '').toString();
      if (memberId && memberIds.indexOf(memberId) === -1) {
        memberIds.push(memberId);
      }
    }
  }

  // 2. Получение актуальных профилей участников из таблицы Users
  var usersSheet = ss.getSheetByName(SHEET_USERS);
  var userRows = usersSheet.getDataRange().getValues();
  var usersMap = {};

  for (var u = 1; u < userRows.length; u++) {
    var uId = (userRows[u][0] || '').toString();
    if (!uId) continue;
    usersMap[uId] = {
      id: uId,
      name: (userRows[u][1] || 'Участник').toString(),
      // Always return phone as a string: Sheets may store it as a number.
      phone: (userRows[u][2] || '').toString().trim(),
      bankName: (userRows[u][3] || 'sbp').toString(),
      paymentUrl: (userRows[u][4] || '').toString(),
      updatedAt: (userRows[u][5] || '').toString()
    };
  }

  var participants = [];
  for (var i = 0; i < memberIds.length; i++) {
    var mid = memberIds[i];
    if (usersMap[mid]) {
      participants.push(usersMap[mid]);
    } else {
      participants.push({
        id: mid,
        name: 'Участник',
        phone: '',
        bankName: 'sbp',
        paymentUrl: ''
      });
    }
  }

  // 3. Получение расходов тусовки
  var expensesSheet = ss.getSheetByName(SHEET_EXPENSES);
  var expRows = expensesSheet.getDataRange().getValues();
  var expenses = [];

  for (var e = 1; e < expRows.length; e++) {
    if ((expRows[e][1] || '').toString() === partyId) {
      var sharedUserIds = [];
      try {
        sharedUserIds = JSON.parse(expRows[e][5]);
      } catch (err) {
        sharedUserIds = [];
      }
      if (!Array.isArray(sharedUserIds)) {
        sharedUserIds = [];
      }
      sharedUserIds = sharedUserIds.map(function (id) {
        return (id || '').toString();
      }).filter(function (id) {
        return id.length > 0;
      });

      expenses.push({
        id: (expRows[e][0] || '').toString(),
        partyId: (expRows[e][1] || '').toString(),
        title: (expRows[e][2] || 'Расход').toString(),
        amount: Number(expRows[e][3]) || 0,
        paidById: (expRows[e][4] || '').toString(),
        sharedUserIds: sharedUserIds,
        createdAt: (expRows[e][6] || '').toString(),
        category: (expRows[e][7] || '').toString()
      });
    }
  }

  return jsonResponse({
    success: true,
    party: targetParty,
    participants: participants,
    expenses: expenses
  });
}

/**
 * 5. Добавление новой траты в тусовку
 * Вход: { id (optional client id), partyId, title, amount, paidById, sharedUserIds, category }
 */
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

  // Переиспользуем id, сгенерированный приложением, чтобы редактирование и
  // удаление расхода на любом устройстве попадали в ту же строку таблицы.
  var expId = (data.id || '').toString().trim();

  var expensesSheet = ss.getSheetByName(SHEET_EXPENSES);

  // Идемпотентность: повторная отправка того же id (например, ретрай после
  // обрыва сети) не должна создавать дубликат строки.
  if (expId) {
    var existingRows = expensesSheet.getDataRange().getValues();
    for (var r = 1; r < existingRows.length; r++) {
      if ((existingRows[r][0] || '').toString() === expId) {
        var existingShared = [];
        try {
          existingShared = JSON.parse(existingRows[r][5]);
        } catch (err) {
          existingShared = [];
        }
        if (!Array.isArray(existingShared)) existingShared = [];

        return jsonResponse({
          success: true,
          expense: {
            id: expId,
            partyId: (existingRows[r][1] || '').toString(),
            title: (existingRows[r][2] || 'Расход').toString(),
            amount: Number(existingRows[r][3]) || 0,
            paidById: (existingRows[r][4] || '').toString(),
            sharedUserIds: existingShared.map(function (item) {
              return (item || '').toString();
            }),
            createdAt: (existingRows[r][6] || '').toString(),
            category: (existingRows[r][7] || '').toString()
          }
        });
      }
    }
  }

  if (!expId) {
    expId = 'exp_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
  }

  var now = new Date().toISOString();
  sharedUserIds = sharedUserIds.map(function (id) {
    return (id || '').toString();
  }).filter(function (id) {
    return id.length > 0;
  });
  var sharedJson = JSON.stringify(sharedUserIds);

  expensesSheet.appendRow([expId, partyId, title, amount, paidById, sharedJson, now, category]);

  var newExpense = {
    id: expId,
    partyId: partyId,
    title: title,
    amount: amount,
    paidById: paidById,
    sharedUserIds: sharedUserIds,
    createdAt: now,
    category: category
  };

  return jsonResponse({
    success: true,
    expense: newExpense
  });
}

/**
 * 6. Массовая синхронизация участников комнаты.
 * Вход: { partyId, members: [{ id, name, phone, bankName, paymentUrl }] }
 * Обновляет профили в Users и гарантирует строку в PartyMembers.
 * Возвращает свежие данные тусовки (участники + расходы).
 */
function syncPartyMembers(ss, data) {
  var partyId = (data.partyId || '').toString();
  if (!partyId) {
    return errorResponse('Укажите partyId комнаты');
  }

  var members = Array.isArray(data.members) ? data.members : [];
  if (members.length > 100) {
    members = members.slice(0, 100);
  }

  var partiesSheet = ss.getSheetByName(SHEET_PARTIES);
  var partyRows = partiesSheet.getDataRange().getValues();
  var partyExists = false;
  for (var r = 1; r < partyRows.length; r++) {
    if ((partyRows[r][0] || '').toString() === partyId) {
      partyExists = true;
      break;
    }
  }
  if (!partyExists) {
    return errorResponse('Тусовка не найдена');
  }

  var membersSheet = ss.getSheetByName(SHEET_MEMBERS);
  var memberRows = membersSheet.getDataRange().getValues();
  var now = new Date().toISOString();

  for (var i = 0; i < members.length; i++) {
    var member = members[i] || {};
    var memberId = (member.id || '').toString();
    if (!memberId) continue;

    // Обновляем реквизиты участника в Users.
    registerOrUpdateUser(ss, {
      id: memberId,
      name: member.name,
      phone: member.phone,
      bankName: member.bankName,
      paymentUrl: member.paymentUrl
    });

    // Добавляем в PartyMembers, если ещё не там.
    var isMember = false;
    for (var m = 1; m < memberRows.length; m++) {
      if ((memberRows[m][0] || '').toString() === partyId &&
          (memberRows[m][1] || '').toString() === memberId) {
        isMember = true;
        break;
      }
    }
    if (!isMember) {
      membersSheet.appendRow([partyId, memberId, now]);
      memberRows = membersSheet.getDataRange().getValues();
    }
  }

  return getPartyDetails(ss, { partyId: partyId });
}

/**
 * 7. Удаление участника из комнаты и его долей из расходов.
 * Вход: { partyId, userId }
 */
function removePartyMember(ss, data) {
  var partyId = (data.partyId || '').toString();
  var userId = (data.userId || '').toString();
  if (!partyId || !userId) {
    return errorResponse('Укажите partyId и userId');
  }

  var membersSheet = ss.getSheetByName(SHEET_MEMBERS);
  var memberRows = membersSheet.getDataRange().getValues();

  // Удаляем строки снизу вверх, чтобы не сбить индексы.
  for (var m = memberRows.length - 1; m >= 1; m--) {
    if ((memberRows[m][0] || '').toString() === partyId &&
        (memberRows[m][1] || '').toString() === userId) {
      membersSheet.deleteRow(m + 1);
    }
  }

  // Определяем, кто остался, чтобы переназначить плательщика при необходимости.
  var remainingIds = [];
  var updatedMemberRows = membersSheet.getDataRange().getValues();
  for (var r = 1; r < updatedMemberRows.length; r++) {
    if ((updatedMemberRows[r][0] || '').toString() === partyId) {
      var remainingId = (updatedMemberRows[r][1] || '').toString();
      if (remainingId && remainingIds.indexOf(remainingId) === -1) {
        remainingIds.push(remainingId);
      }
    }
  }

  // Чистим расходы: убираем userId из долей и переназначаем плательщика.
  var expensesSheet = ss.getSheetByName(SHEET_EXPENSES);
  var expRows = expensesSheet.getDataRange().getValues();
  for (var e = expRows.length - 1; e >= 1; e--) {
    if ((expRows[e][1] || '').toString() !== partyId) continue;

    var shared = [];
    try {
      shared = JSON.parse(expRows[e][5]);
    } catch (err) {
      shared = [];
    }
    if (!Array.isArray(shared)) shared = [];

    var newShared = shared
      .map(function (id) { return (id || '').toString(); })
      .filter(function (id) { return id && id !== userId; });

    var paidById = (expRows[e][4] || '').toString();
    if (paidById === userId && remainingIds.length > 0) {
      paidById = remainingIds[0];
    }

    expensesSheet.getRange(e + 1, 5, 1, 2).setValues([[paidById, JSON.stringify(newShared)]]);
  }

  return getPartyDetails(ss, { partyId: partyId });
}

/**
 * 8. Обновление существующего расхода (по id, с любого устройства).
 * Вход: { expenseId, title, amount, paidById, sharedUserIds, category }
 */
function updateExpense(ss, data) {
  var expenseId = (data.expenseId || '').toString();
  if (!expenseId) {
    return errorResponse('Укажите expenseId расхода');
  }

  var title = (data.title || '').toString().trim();
  var amount = Number(data.amount);
  var paidById = (data.paidById || '').toString();
  var sharedUserIds = Array.isArray(data.sharedUserIds) ? data.sharedUserIds : [];
  var category = (data.category || '').toString().trim();

  if (!title || isNaN(amount) || amount <= 0 || !paidById) {
    return errorResponse('Некорректные данные расхода (title, amount > 0, paidById)');
  }

  sharedUserIds = sharedUserIds.map(function (id) {
    return (id || '').toString();
  }).filter(function (id) {
    return id.length > 0;
  });

  var expensesSheet = ss.getSheetByName(SHEET_EXPENSES);
  var expRows = expensesSheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var e = 1; e < expRows.length; e++) {
    if ((expRows[e][0] || '').toString() === expenseId) {
      rowIndex = e + 1;
      break;
    }
  }

  if (rowIndex < 0) {
    return errorResponse('Расход не найден в таблице');
  }

  expensesSheet
    .getRange(rowIndex, 3, 1, 6)
    .setValues([[title, amount, paidById, JSON.stringify(sharedUserIds), (expRows[rowIndex - 1][6] || '').toString(), category]]);

  return jsonResponse({
    success: true,
    expense: {
      id: expenseId,
      partyId: (expRows[rowIndex - 1][1] || '').toString(),
      title: title,
      amount: amount,
      paidById: paidById,
      sharedUserIds: sharedUserIds,
      createdAt: (expRows[rowIndex - 1][6] || '').toString(),
      category: category
    }
  });
}

/**
 * 9. Удаление расхода из таблицы.
 * Вход: { expenseId, partyId (optional) }
 */
function deleteExpense(ss, data) {
  var expenseId = (data.expenseId || '').toString();
  if (!expenseId) {
    return errorResponse('Укажите expenseId расхода');
  }

  var expensesSheet = ss.getSheetByName(SHEET_EXPENSES);
  var expRows = expensesSheet.getDataRange().getValues();

  for (var e = expRows.length - 1; e >= 1; e--) {
    if ((expRows[e][0] || '').toString() === expenseId) {
      expensesSheet.deleteRow(e + 1);
    }
  }

  return jsonResponse({ success: true });
}

/**
 * 10. Переименование тусовки.
 * Вход: { partyId, title }
 */
function updatePartyTitle(ss, data) {
  var partyId = (data.partyId || '').toString();
  var title = (data.title || '').toString().trim();
  if (!partyId || !title) {
    return errorResponse('Укажите partyId и новое название');
  }

  var partiesSheet = ss.getSheetByName(SHEET_PARTIES);
  var partyRows = partiesSheet.getDataRange().getValues();
  for (var r = 1; r < partyRows.length; r++) {
    if ((partyRows[r][0] || '').toString() === partyId) {
      partiesSheet.getRange(r + 1, 3).setValue(title);
      return jsonResponse({ success: true });
    }
  }

  return errorResponse('Тусовка не найдена');
}

/**
 * Вспомогательный хелпер JSON-ответа с правильными заголовками
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Вспомогательный хелпер ошибки
 */
function errorResponse(msg) {
  return jsonResponse({
    success: false,
    error: msg
  });
}
