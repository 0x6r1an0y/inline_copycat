# Google Sheet + Apps Script short code backend

This backend stores payloads in Google Sheet and returns a short id.
The frontend can then use `?id=abc123` and resolve the payload at runtime.

## 1) Create Sheet and Script

1. Create a new Google Sheet.
2. Open `Extensions` -> `Apps Script`.
3. Replace the default code with `Code.gs` from this folder.
4. Save.

## 2) Deploy as Web App

1. Click `Deploy` -> `New deployment`.
2. Type: `Web app`.
3. Execute as: `Me`.
4. Who has access: `Anyone` (or your required audience).
5. Deploy and copy the Web App URL, for example:
   - `https://script.google.com/macros/s/AKfyc.../exec`

## 3) Connect frontend

Set the URL in either one of these places:

1. Preferred (for all users): edit `index.html` meta tag.

```html
<meta name="short-code-api" content="https://script.google.com/macros/s/AKfyc.../exec">
```

2. Or fill `Apps Script Web App URL` in the page generator UI (stored in browser localStorage).

## 4) Frontend usage

1. Open `generator.html`.
2. In `參數產生器`, choose `短碼 id (Google Sheet/App Script)`.
3. Click `產生網址`.
4. You will get a short link like:
  - `https://your-domain/path/?id=Ab3Kx9Q`

## API contract

### Create short code

Request (GET or JSONP):

- `action=create`
- `d=<base64url of JSON payload>`

Response:

```json
{ "ok": true, "id": "Ab3Kx9Q" }
```

### Resolve short code

Request:

- `action=resolve`
- `id=<short id>`

Response:

```json
{
  "ok": true,
  "id": "Ab3Kx9Q",
  "payload": {
    "t": "候位資訊",
    "sn": "店家名稱",
    "ph": "0900-000-000",
    "at": "桃園市中壢區XX路XX號",
    "au": "https://maps.google.com/...",
    "sr": "067",
    "pt": "查看菜單",
    "pu": "https://example.com/menu"
  }
}
```

## Sheet schema

The script auto-creates/uses sheet `short_codes` with columns:

- `created_at`
- `id`
- `payload_json`
