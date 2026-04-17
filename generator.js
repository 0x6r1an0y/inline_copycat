'use strict';

const PARAM_KEYS = Object.freeze({
  title: ['t', 'title'],
  storeName: ['sn', 'store-name'],
  phone: ['ph', 'phone', 'phone-number'],
  addressText: ['at', 'address'],
  addressUrl: ['au', 'store-link'],
  serial: ['sr', 'serial'],
  promoText: ['pt', 'promo-text', 'promo-btn'],
  promoUrl: ['pu', 'promo-link']
});

const SHORT_PARAM_KEYS = Object.freeze({
  title: 't',
  storeName: 'sn',
  phone: 'ph',
  addressText: 'at',
  addressUrl: 'au',
  serial: 'sr',
  promoText: 'pt',
  promoUrl: 'pu'
});

const PACKED_PARAM_KEYS = ['d', 'data', 'payload'];
const SHORT_CODE_API_QUERY_KEYS = ['api', 'api-url', 'endpoint'];
const SHORT_CODE_API_META_SELECTOR = 'meta[name="short-code-api"]';
const SHORT_CODE_API_STORAGE_KEY = 'inline-copycat-short-code-api';

const queryParams = new URLSearchParams(window.location.search);

const encodeBase64Url = (value) => {
  if (!value) {
    return '';
  }

  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const decodeBase64Url = (value) => {
  const normalized = value
    .replace(/\s/g, '+')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const decodeParamValue = (value) => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  try {
    return decodeBase64Url(trimmed);
  } catch {
    return trimmed;
  }
};

const toSafeText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeHttpUrl = (value) => {
  if (!value) {
    return '';
  }

  try {
    const normalized = new URL(value, window.location.href);
    if (normalized.protocol === 'http:' || normalized.protocol === 'https:') {
      return normalized.href;
    }
  } catch {
    return '';
  }

  return '';
};

const normalizeTargetUrl = (value) => {
  if (!value) {
    return '';
  }

  try {
    const normalized = new URL(value, window.location.href);
    normalized.search = '';
    normalized.hash = '';
    return normalized.href;
  } catch {
    return '';
  }
};

const deriveDefaultTargetUrl = () => {
  const current = window.location.href.split('?')[0];
  if (current.endsWith('/generator.html')) {
    return current.slice(0, -'/generator.html'.length) + '/index.html';
  }

  if (current.endsWith('generator.html')) {
    return current.slice(0, -'generator.html'.length) + 'index.html';
  }

  return current;
};

const getFromLocalStorage = (key) => {
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

const setToLocalStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors.
  }
};

const pickFirstValidApiUrl = (...candidates) => {
  for (const candidate of candidates) {
    const normalized = normalizeHttpUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const readConfiguredApiUrl = () => {
  for (const key of SHORT_CODE_API_QUERY_KEYS) {
    const raw = queryParams.get(key);
    if (!raw) {
      continue;
    }

    const fromQuery = pickFirstValidApiUrl(raw, decodeParamValue(raw));
    if (fromQuery) {
      return fromQuery;
    }
  }

  const metaValue = document
    .querySelector(SHORT_CODE_API_META_SELECTOR)
    ?.getAttribute('content')
    ?.trim();

  const fromMeta = pickFirstValidApiUrl(metaValue || '');
  if (fromMeta) {
    return fromMeta;
  }

  const storedValue = getFromLocalStorage(SHORT_CODE_API_STORAGE_KEY);
  const fromStorage = pickFirstValidApiUrl(storedValue);
  if (fromStorage) {
    return fromStorage;
  }

  return '';
};

let configuredApiUrl = readConfiguredApiUrl();
if (configuredApiUrl) {
  setToLocalStorage(SHORT_CODE_API_STORAGE_KEY, configuredApiUrl);
}

const readPackedParams = () => {
  for (const key of PACKED_PARAM_KEYS) {
    const raw = queryParams.get(key);
    if (!raw) {
      continue;
    }

    const decoded = decodeParamValue(raw);

    try {
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
};

const packedParams = readPackedParams();

const readParam = (keys, packedKey) => {
  if (packedParams && packedKey) {
    const packedValue = packedParams[packedKey];
    if (typeof packedValue === 'string' && packedValue.trim()) {
      return packedValue.trim();
    }
  }

  for (const key of keys) {
    const raw = queryParams.get(key);
    if (raw) {
      return decodeParamValue(raw);
    }
  }

  return '';
};

const createPayloadFromValues = (values) => {
  const payload = {};

  Object.entries(SHORT_PARAM_KEYS).forEach(([field, shortKey]) => {
    const value = toSafeText(values[field]);
    if (value) {
      payload[shortKey] = value;
    }
  });

  return payload;
};

const buildShortQuery = (values) => {
  const pairs = [];

  Object.entries(SHORT_PARAM_KEYS).forEach(([field, shortKey]) => {
    const value = values[field];
    if (!value) {
      return;
    }

    const encoded = encodeBase64Url(value);
    if (encoded) {
      pairs.push(`${shortKey}=${encodeURIComponent(encoded)}`);
    }
  });

  return pairs.join('&');
};

const buildPackedQuery = (values) => {
  const payload = createPayloadFromValues(values);

  if (!Object.keys(payload).length) {
    return '';
  }

  const packed = encodeBase64Url(JSON.stringify(payload));
  if (!packed) {
    return '';
  }

  return `d=${encodeURIComponent(packed)}`;
};

const requestJsonp = (apiUrl, params, timeoutMs = 10000) => new Promise((resolve, reject) => {
  const callbackName = `__inlineCopycatJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const script = document.createElement('script');
  const callbackParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      callbackParams.set(key, value);
    }
  });
  callbackParams.set('callback', callbackName);

  let timeoutHandle = null;

  const cleanup = () => {
    delete window[callbackName];
    if (timeoutHandle) {
      window.clearTimeout(timeoutHandle);
    }

    if (script.parentNode) {
      script.parentNode.removeChild(script);
    }
  };

  window[callbackName] = (response) => {
    cleanup();
    resolve(response);
  };

  timeoutHandle = window.setTimeout(() => {
    cleanup();
    reject(new Error('API 請求逾時，請檢查 Apps Script URL。'));
  }, timeoutMs);

  script.async = true;
  script.src = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}${callbackParams.toString()}`;
  script.onerror = () => {
    cleanup();
    reject(new Error('無法連線到 Apps Script API。'));
  };

  document.head.appendChild(script);
});

const createShortCode = async (apiUrl, values) => {
  const payload = createPayloadFromValues(values);
  if (!Object.keys(payload).length) {
    throw new Error('請至少填入一個欄位再建立短碼。');
  }

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const response = await requestJsonp(apiUrl, {
    action: 'create',
    d: encodedPayload
  });

  if (!response || response.ok !== true || !response.id) {
    throw new Error(response?.error || '建立短碼失敗。');
  }

  return String(response.id);
};

const copyText = async (text) => {
  if (!text) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy copy.
  }

  const helper = document.createElement('textarea');
  helper.value = text;
  helper.setAttribute('readonly', '');
  helper.style.position = 'fixed';
  helper.style.left = '-9999px';
  document.body.appendChild(helper);
  helper.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(helper);
  return copied;
};

const initParamGenerator = () => {
  const form = document.querySelector('#paramGeneratorForm');
  if (!form) {
    return;
  }

  const inputMap = {
    targetUrl: document.querySelector('#genTargetUrl'),
    apiUrl: document.querySelector('#genApiUrl'),
    title: document.querySelector('#genTitle'),
    storeName: document.querySelector('#genStoreName'),
    phone: document.querySelector('#genPhone'),
    addressText: document.querySelector('#genAddressText'),
    addressUrl: document.querySelector('#genAddressUrl'),
    serial: document.querySelector('#genSerial'),
    promoText: document.querySelector('#genPromoText'),
    promoUrl: document.querySelector('#genPromoUrl')
  };

  const modeSelect = document.querySelector('#genMode');
  const output = document.querySelector('#genOutput');
  const note = document.querySelector('#genNote');
  const openBtn = document.querySelector('#genOpenBtn');
  const copyBtn = document.querySelector('#genCopyBtn');
  const submitBtn = form.querySelector('button[type="submit"]');

  const paramsFromUrl = {
    title: readParam(PARAM_KEYS.title, SHORT_PARAM_KEYS.title),
    storeName: readParam(PARAM_KEYS.storeName, SHORT_PARAM_KEYS.storeName),
    phone: readParam(PARAM_KEYS.phone, SHORT_PARAM_KEYS.phone),
    addressText: readParam(PARAM_KEYS.addressText, SHORT_PARAM_KEYS.addressText),
    addressUrl: readParam(PARAM_KEYS.addressUrl, SHORT_PARAM_KEYS.addressUrl),
    serial: readParam(PARAM_KEYS.serial, SHORT_PARAM_KEYS.serial),
    promoText: readParam(PARAM_KEYS.promoText, SHORT_PARAM_KEYS.promoText),
    promoUrl: readParam(PARAM_KEYS.promoUrl, SHORT_PARAM_KEYS.promoUrl)
  };

  Object.entries(paramsFromUrl).forEach(([field, value]) => {
    if (inputMap[field] && value) {
      inputMap[field].value = value;
    }
  });

  if (inputMap.targetUrl) {
    inputMap.targetUrl.value = normalizeTargetUrl(inputMap.targetUrl.value) || deriveDefaultTargetUrl();
  }

  if (inputMap.apiUrl) {
    inputMap.apiUrl.value = configuredApiUrl;
  }

  const setNote = (text, status = '') => {
    if (!note) {
      return;
    }

    note.textContent = text;
    note.classList.remove('is-error', 'is-success');

    if (status === 'error') {
      note.classList.add('is-error');
    } else if (status === 'success') {
      note.classList.add('is-success');
    }
  };

  const setOutputUrl = (url) => {
    if (output) {
      output.value = url;
    }

    if (openBtn) {
      openBtn.setAttribute('href', url || '#');
    }
  };

  const getFormValues = () => ({
    title: toSafeText(inputMap.title?.value),
    storeName: toSafeText(inputMap.storeName?.value),
    phone: toSafeText(inputMap.phone?.value),
    addressText: toSafeText(inputMap.addressText?.value),
    addressUrl: toSafeText(inputMap.addressUrl?.value),
    serial: toSafeText(inputMap.serial?.value),
    promoText: toSafeText(inputMap.promoText?.value),
    promoUrl: toSafeText(inputMap.promoUrl?.value)
  });

  const getBaseTargetUrl = () => {
    const target = normalizeTargetUrl(inputMap.targetUrl?.value || '') || deriveDefaultTargetUrl();
    if (inputMap.targetUrl) {
      inputMap.targetUrl.value = target;
    }

    return target;
  };

  const buildUrl = () => {
    const values = getFormValues();
    const mode = modeSelect?.value || 'short';
    const query = mode === 'packed' ? buildPackedQuery(values) : buildShortQuery(values);
    const base = getBaseTargetUrl();
    const url = query ? `${base}?${query}` : base;

    setOutputUrl(url);
    setNote(
      mode === 'packed'
        ? '模式: 單一 d 參數（內容是 Base64URL 的 JSON）'
        : '模式: 短鍵多參數（t/sn/ph...，每個值是 Base64URL）'
    );
  };

  const generateShortIdUrl = async () => {
    const apiUrl = normalizeHttpUrl(inputMap.apiUrl?.value || configuredApiUrl);
    if (!apiUrl) {
      setNote('請先填入有效的 Apps Script Web App URL。', 'error');
      return;
    }

    configuredApiUrl = apiUrl;
    setToLocalStorage(SHORT_CODE_API_STORAGE_KEY, apiUrl);
    const metaTag = document.querySelector(SHORT_CODE_API_META_SELECTOR);
    if (metaTag) {
      metaTag.setAttribute('content', apiUrl);
    }

    const values = getFormValues();
    const base = getBaseTargetUrl();
    const originalText = submitBtn?.textContent || '產生網址';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '產生中...';
    }

    try {
      const shortId = await createShortCode(apiUrl, values);
      const url = `${base}?id=${encodeURIComponent(shortId)}`;
      setOutputUrl(url);
      setNote(`模式: 短碼 id（已建立 ${shortId}）`, 'success');
    } catch (error) {
      setNote(`建立短碼失敗: ${error.message}`, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const mode = modeSelect?.value || 'short';
    if (mode === 'short-id') {
      await generateShortIdUrl();
      return;
    }

    buildUrl();
  });

  modeSelect?.addEventListener('change', () => {
    if ((modeSelect?.value || 'short') === 'short-id') {
      setNote('模式: 短碼 id，按「產生網址」後會寫入 Google Sheet 並回傳短連結。');
      return;
    }

    buildUrl();
  });

  inputMap.apiUrl?.addEventListener('change', () => {
    const normalized = normalizeHttpUrl(inputMap.apiUrl?.value || '');
    if (normalized) {
      configuredApiUrl = normalized;
      setToLocalStorage(SHORT_CODE_API_STORAGE_KEY, normalized);
    }
  });

  inputMap.targetUrl?.addEventListener('change', () => {
    const normalized = normalizeTargetUrl(inputMap.targetUrl?.value || '');
    if (normalized) {
      inputMap.targetUrl.value = normalized;
    }

    if ((modeSelect?.value || 'short') !== 'short-id') {
      buildUrl();
    }
  });

  Object.values(inputMap).forEach((input) => {
    if (input === inputMap.apiUrl || input === inputMap.targetUrl) {
      return;
    }

    input?.addEventListener('input', () => {
      if ((modeSelect?.value || 'short') === 'short-id') {
        return;
      }

      buildUrl();
    });
  });

  copyBtn?.addEventListener('click', async () => {
    const original = copyBtn.textContent;
    const copied = await copyText(output?.value || '');
    copyBtn.textContent = copied ? '已複製' : '複製失敗';

    window.setTimeout(() => {
      copyBtn.textContent = original;
    }, 1200);
  });

  buildUrl();
};

initParamGenerator();
