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
const SHORT_CODE_ID_KEYS = ['id', 'sid'];
const SHORT_CODE_API_QUERY_KEYS = ['api', 'api-url', 'endpoint'];
const SHORT_CODE_API_STORAGE_KEY = 'inline-copycat-short-code-api';
const SHORT_ID_LOADING_CLASS = 'is-short-id-loading';
const DEFAULT_SHORT_CODE_API_B64 = 'aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4NFJLWXhWLW95NHlZWFM1YmNzblNrYXppNlU2NU1BcFNObUc0ckZvUVFxS0R2MXBCSEdtV1hMdFdMekZKWkx4bG9ZQS9leGVj';

const queryParams = new URLSearchParams(window.location.search);

const decodeBase64Ascii = (value) => {
  if (!value) {
    return '';
  }

  try {
    return atob(value);
  } catch {
    return '';
  }
};

const toggleShortIdLoading = (isLoading, text) => {
  const root = document.documentElement;
  const textElement = document.querySelector('#shortIdLoaderText');

  if (isLoading) {
    root.classList.add(SHORT_ID_LOADING_CLASS);
    if (textElement && text) {
      textElement.textContent = text;
    }
    return;
  }

  root.classList.remove(SHORT_ID_LOADING_CLASS);
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

const normalizeApiUrl = (value) => {
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
    const normalized = normalizeApiUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

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

  const storedValue = getFromLocalStorage(SHORT_CODE_API_STORAGE_KEY);
  const fromStorage = pickFirstValidApiUrl(storedValue);
  if (fromStorage) {
    return fromStorage;
  }

  const fromDefault = pickFirstValidApiUrl(decodeBase64Ascii(DEFAULT_SHORT_CODE_API_B64));
  if (fromDefault) {
    return fromDefault;
  }

  return '';
};

let configuredApiUrl = readConfiguredApiUrl();
if (configuredApiUrl) {
  setToLocalStorage(SHORT_CODE_API_STORAGE_KEY, configuredApiUrl);
}

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

const applyText = (selector, value) => {
  if (!value) {
    return;
  }

  const target = document.querySelector(selector);
  if (target) {
    target.textContent = value;
  }
};

const toSafeHttpUrl = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href;
    }
  } catch {
    return fallback;
  }

  return fallback;
};

const toSafeTelHref = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  const normalized = value.replace(/[^\d+]/g, '');
  if (!normalized) {
    return fallback;
  }

  return `tel:${normalized}`;
};

const toSafeText = (value) => (typeof value === 'string' ? value.trim() : '');

const mapPayloadToValues = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  return {
    title: toSafeText(payload.t || payload.title),
    storeName: toSafeText(payload.sn || payload.storeName || payload['store-name']),
    phone: toSafeText(payload.ph || payload.phone || payload['phone-number']),
    addressText: toSafeText(payload.at || payload.address || payload.addressText),
    addressUrl: toSafeText(payload.au || payload['store-link'] || payload.addressUrl),
    serial: toSafeText(payload.sr || payload.serial),
    promoText: toSafeText(payload.pt || payload['promo-btn'] || payload.promoText),
    promoUrl: toSafeText(payload.pu || payload['promo-link'] || payload.promoUrl)
  };
};

const applyDataToPage = (values) => {
  const title = toSafeText(values.title);
  const storeName = toSafeText(values.storeName);
  const phone = toSafeText(values.phone);
  const addressText = toSafeText(values.addressText);
  const addressUrl = toSafeText(values.addressUrl);
  const serial = toSafeText(values.serial);
  const promoText = toSafeText(values.promoText);
  const promoUrl = toSafeText(values.promoUrl);

  if (title) {
    document.title = title;
    applyText('#pageTitle', title);
  }

  applyText('#storeName', storeName);
  applyText('#serialNumber', serial);

  if (phone) {
    const links = document.querySelectorAll('[data-phone-link]');
    const telHref = toSafeTelHref(phone, 'tel:0000000000');

    links.forEach((link) => {
      link.textContent = phone;
      link.setAttribute('href', telHref);
    });
  }

  const addressLink = document.querySelector('#storeAddressLink');
  if (addressLink) {
    if (addressText) {
      addressLink.textContent = addressText;
    }

    if (addressUrl) {
      const safeAddressUrl = toSafeHttpUrl(addressUrl, addressLink.getAttribute('href') || 'https://maps.google.com');
      addressLink.setAttribute('href', safeAddressUrl);
    }
  }

  const promoBtn = document.querySelector('#promoBtn');
  if (promoBtn) {
    if (promoText) {
      promoBtn.textContent = promoText;
    }

    if (promoUrl) {
      const safePromoUrl = toSafeHttpUrl(promoUrl, promoBtn.getAttribute('href') || 'https://inline.app');
      promoBtn.setAttribute('href', safePromoUrl);
    }
  }
};

const renderFromParams = () => {
  const values = {
    title: readParam(PARAM_KEYS.title, SHORT_PARAM_KEYS.title),
    storeName: readParam(PARAM_KEYS.storeName, SHORT_PARAM_KEYS.storeName),
    phone: readParam(PARAM_KEYS.phone, SHORT_PARAM_KEYS.phone),
    addressText: readParam(PARAM_KEYS.addressText, SHORT_PARAM_KEYS.addressText),
    addressUrl: readParam(PARAM_KEYS.addressUrl, SHORT_PARAM_KEYS.addressUrl),
    serial: readParam(PARAM_KEYS.serial, SHORT_PARAM_KEYS.serial),
    promoText: readParam(PARAM_KEYS.promoText, SHORT_PARAM_KEYS.promoText),
    promoUrl: readParam(PARAM_KEYS.promoUrl, SHORT_PARAM_KEYS.promoUrl)
  };

  applyDataToPage(values);
  return values;
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

const resolveShortCode = async (apiUrl, shortId) => {
  const response = await requestJsonp(apiUrl, {
    action: 'resolve',
    id: shortId
  });

  if (!response || response.ok !== true || !response.payload) {
    throw new Error(response?.error || '短碼不存在或已失效。');
  }

  return mapPayloadToValues(response.payload);
};

const resolveShortIdAndRender = async () => {
  const shortId = SHORT_CODE_ID_KEYS
    .map((key) => queryParams.get(key))
    .find((value) => typeof value === 'string' && value.trim());

  if (!shortId) {
    toggleShortIdLoading(false);
    return;
  }

  toggleShortIdLoading(true, '資料載入中，請稍候...');

  if (!configuredApiUrl) {
    configuredApiUrl = readConfiguredApiUrl();
  }

  if (!configuredApiUrl) {
    console.warn('缺少 short-code API URL，無法解析 id 參數。');
    toggleShortIdLoading(false);
    return;
  }

  try {
    const resolvedValues = await resolveShortCode(configuredApiUrl, shortId.trim());
    applyDataToPage(resolvedValues);
  } catch (error) {
    console.error(error);
  } finally {
    toggleShortIdLoading(false);
  }
};

renderFromParams();
resolveShortIdAndRender();

const faqItems = Array.from(document.querySelectorAll('.faq-item'));

faqItems.forEach((item) => {
  const trigger = item.querySelector('.faq-trigger');
  if (!trigger) {
    return;
  }

  trigger.addEventListener('click', () => {
    const isOpen = item.classList.contains('is-open');

    faqItems.forEach((el) => {
      el.classList.remove('is-open');
      const btn = el.querySelector('.faq-trigger');
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    if (!isOpen) {
      item.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });
});
