const SHEET_NAME = 'short_codes';
const HEADER = ['created_at', 'id', 'payload_json'];
const ID_LENGTH = 7;
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function doGet(e) {
  return handleRequest_(e, null);
}

function doPost(e) {
  var body = null;

  if (e && e.postData && e.postData.contents) {
    try {
      body = JSON.parse(e.postData.contents);
    } catch (error) {
      body = null;
    }
  }

  return handleRequest_(e, body);
}

function handleRequest_(e, body) {
  var params = (e && e.parameter) || {};
  var action = String(params.action || (body && body.action) || '').toLowerCase();
  var callback = sanitizeCallback_(params.callback || params.cb || '');

  try {
    if (action === 'create') {
      var payload = extractPayload_(params, body);
      var shortId = createShortCode_(payload);
      return buildOutput_({ ok: true, id: shortId }, callback);
    }

    if (action === 'resolve') {
      var id = String(params.id || (body && body.id) || '').trim();
      if (!id) {
        return buildOutput_({ ok: false, error: 'Missing id' }, callback);
      }

      var payloadById = findPayloadById_(id);
      if (!payloadById) {
        return buildOutput_({ ok: false, error: 'ID not found' }, callback);
      }

      return buildOutput_({ ok: true, id: id, payload: payloadById }, callback);
    }

    return buildOutput_({ ok: false, error: 'Unknown action' }, callback);
  } catch (error) {
    return buildOutput_({ ok: false, error: error.message || 'Unexpected error' }, callback);
  }
}

function extractPayload_(params, body) {
  var candidates = [];

  if (body && body.payload != null) {
    candidates.push(body.payload);
  }

  if (body && body.d) {
    candidates.push(decodeBase64UrlToString_(String(body.d)));
  }

  if (body && body.data) {
    candidates.push(body.data);
  }

  if (params.payload != null) {
    candidates.push(params.payload);
  }

  if (params.d) {
    candidates.push(decodeBase64UrlToString_(String(params.d)));
  }

  if (params.data) {
    candidates.push(params.data);
  }

  for (var i = 0; i < candidates.length; i += 1) {
    var candidate = candidates[i];
    if (candidate == null) {
      continue;
    }

    try {
      return parseAndNormalizePayload_(candidate);
    } catch (error) {
      // Try next candidate format.
    }
  }

  throw new Error('Invalid payload');
}

function parseAndNormalizePayload_(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return normalizePayload_(input);
  }

  var text = String(input || '').trim();
  if (!text) {
    throw new Error('Empty payload');
  }

  try {
    return normalizePayload_(JSON.parse(text));
  } catch (error) {
    // Continue to decode base64url.
  }

  var decodedText = decodeBase64UrlToString_(text);
  return normalizePayload_(JSON.parse(decodedText));
}

function normalizePayload_(source) {
  var aliases = {
    t: 't',
    title: 't',
    sn: 'sn',
    'store-name': 'sn',
    storeName: 'sn',
    ph: 'ph',
    phone: 'ph',
    'phone-number': 'ph',
    at: 'at',
    address: 'at',
    addressText: 'at',
    au: 'au',
    'store-link': 'au',
    addressUrl: 'au',
    sr: 'sr',
    serial: 'sr',
    pt: 'pt',
    'promo-btn': 'pt',
    promoText: 'pt',
    pu: 'pu',
    'promo-link': 'pu',
    promoUrl: 'pu'
  };

  var normalized = {};
  var keys = Object.keys(source);

  for (var i = 0; i < keys.length; i += 1) {
    var rawKey = keys[i];
    var mappedKey = aliases[rawKey];
    if (!mappedKey) {
      continue;
    }

    var rawValue = source[rawKey];
    if (rawValue == null) {
      continue;
    }

    var value = String(rawValue).trim();
    if (!value) {
      continue;
    }

    if (value.length > 2000) {
      throw new Error('Payload field too long: ' + mappedKey);
    }

    normalized[mappedKey] = value;
  }

  if (!Object.keys(normalized).length) {
    throw new Error('Payload has no supported fields');
  }

  return normalized;
}

function createShortCode_(payload) {
  var sheet = getSheet_();

  for (var attempt = 0; attempt < 20; attempt += 1) {
    var shortId = generateId_();

    if (!shortCodeExists_(sheet, shortId)) {
      sheet.appendRow([new Date(), shortId, JSON.stringify(payload)]);
      return shortId;
    }
  }

  throw new Error('Failed to generate unique short id');
}

function findPayloadById_(id) {
  var sheet = getSheet_();
  var finder = sheet
    .getRange('B:B')
    .createTextFinder(String(id))
    .matchEntireCell(true)
    .findNext();

  if (!finder) {
    return null;
  }

  var row = finder.getRow();
  var payloadText = String(sheet.getRange(row, 3).getValue() || '');
  if (!payloadText) {
    return null;
  }

  try {
    return JSON.parse(payloadText);
  } catch (error) {
    return null;
  }
}

function shortCodeExists_(sheet, id) {
  return !!sheet
    .getRange('B:B')
    .createTextFinder(String(id))
    .matchEntireCell(true)
    .findNext();
}

function generateId_() {
  var id = '';

  for (var i = 0; i < ID_LENGTH; i += 1) {
    var randomIndex = Math.floor(Math.random() * ID_ALPHABET.length);
    id += ID_ALPHABET.charAt(randomIndex);
  }

  return id;
}

function getSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER);
  }

  return sheet;
}

function decodeBase64UrlToString_(base64UrlValue) {
  var value = String(base64UrlValue || '').trim();
  if (!value) {
    throw new Error('Empty base64url text');
  }

  var paddingCount = (4 - (value.length % 4)) % 4;
  var padded = value + new Array(paddingCount + 1).join('=');
  var bytes = Utilities.base64DecodeWebSafe(padded);
  return Utilities.newBlob(bytes).getDataAsString('UTF-8');
}

function sanitizeCallback_(name) {
  var callback = String(name || '').trim();
  var validPattern = /^[A-Za-z_$][0-9A-Za-z_$.]*$/;

  if (!callback || !validPattern.test(callback)) {
    return '';
  }

  return callback;
}

function buildOutput_(payload, callback) {
  var text = JSON.stringify(payload);

  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}
