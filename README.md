# RTSP to WebRTC System

Система для передачи видео из RTSP-камеры в браузер через WebRTC с поддержкой TURN серверов.

## Архитектура

```
Browser (Angular :4200) ↔ TURN Servers (coturn :3478, :3479) ↔ API App (Docker :7100) ↔ RTSP Camera
                                                                      ↓
                                                              WebRTC API (aiortc)
```

## Компоненты

- **API App** - FastAPI приложение в Docker с WebRTC эндпоинтами
- **WebRTC API** - Python aiortc для обработки RTSP → WebRTC (внутри API App)
- **Angular WebApp** - браузерный клиент (Publisher/Subscriber/Admin)
- **Coturn** - два TURN сервера (TURN1, TURN2) для NAT traversal
- **aiortc** - Python WebRTC библиотека с автоматической конвертацией H265→H264

## Быстрый старт

### Установка зависимостей

```bash
make install
```

### Запуск всех сервисов

```bash
make start
```

Откроется:
- **WebApp**: http://localhost:4200 (Angular фронтенд)
- **API App**: http://localhost:7100 (FastAPI + WebRTC API)
- **TURN1**: turn:localhost:3478 (user: webrtc, pass: webrtc)
- **TURN2**: turn:localhost:3479 (user: test, pass: test)

### Остановка всех сервисов

```bash
make stop
```

## Доступные команды

```bash
make help         # Показать все команды
make install      # Установить зависимости webapp
make start        # Запустить все сервисы (API App + TURN + WebApp)
make stop         # Остановить все сервисы

make apiapp-up    # Запустить API App (Docker)
make apiapp-down  # Остановить API App (Docker)
make webapp       # Запустить Angular webapp
make coturn-up    # Запустить TURN серверы (Docker)
make coturn-down  # Остановить TURN серверы (Docker)

make logs         # Показать логи всех сервисов
make clean        # Удалить node_modules и build артефакты
```

## API Endpoints

### WebRTC API (http://localhost:7100/api/v1/webrtc/)

- `GET /ice-config` - Получить TURN конфигурацию
- `PUT /turn-config` - Обновить TURN конфигурацию (Admin)
- `GET /turn-config` - Получить текущую TURN конфигурацию
- `POST /publisher/offer` - Publisher endpoint (Browser offer → Server answer)
- `POST /subscriber/offer` - Subscriber endpoint (Browser offer → Server answer)
- `GET /webrtc/health` - Health check WebRTC

### Core API (http://localhost:7100/api/v1/)

- `GET /` - Root endpoint
- `GET /health` - Health check
- `GET /version` - Version info
- `GET /core/*` - Core endpoints (files, CRUD)

## Структура проекта

```
.
├── Makefile                          # Команды для управления проектом
├── docker-compose.yml                # TURN серверы (coturn1, coturn2)
├── docker-compose.local.yaml         # API App (FastAPI + WebRTC)
├── .env.local.example                # ENV для локальной разработки
├── apiapp/                           # API App (Docker)
│   ├── Dockerfile                    # Dockerfile для продакшена
│   ├── Dockerfile.local              # Dockerfile для разработки
│   └── server/
│       ├── main.py                   # Точка входа FastAPI
│       ├── requirements.txt          # Python зависимости (server level)
│       └── app/
│           ├── api.py                # FastAPI app + роутеры
│           ├── requirements.txt      # Python зависимости (app level)
│           └── routes/
│               ├── webrtc.py         # WebRTC роуты (TURN + Publisher/Subscriber)
│               ├── core.py           # Core роуты
│               ├── health.py         # Health check
│               └── version.py        # Version info
├── webapp/                           # Angular frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/                # Admin - переключение TURN серверов
│   │   │   ├── publisher/            # Publisher - отправка видео с веб-камеры
│   │   │   └── subscriber/           # Subscriber - просмотр RTSP камеры
│   │   └── environments/
│   │       └── environment.ts        # WEBRTC_API_URL = http://localhost:8086
│   └── package.json
├── infra/
│   └── coturn/                       # TURN серверы конфигурация
│       ├── Dockerfile
│       └── config/
│           ├── entrypoint.sh
│           └── turnserver.conf.tmpl
└── services/
    └── webrtc-api/                   # Старая локальная версия (не используется)
```

## Использование

### Admin - Переключение TURN серверов

1. Откройте http://localhost:4200
2. Перейдите на вкладку **Admin**
3. Выберите TURN сервер из выпадающего списка:
   - **TURN1 (coturn1)** - turn:localhost:3478 (webrtc/webrtc)
   - **TURN2 (coturn2)** - turn:localhost:3479 (test/test)
4. Или введите параметры вручную в поля URLs, Username, Credential
5. Нажмите **Save Configuration**
6. Конфигурация применится ко всем Publisher/Subscriber

### Publisher - Отправка видео с веб-камеры

1. Откройте http://localhost:4200
2. Перейдите на вкладку **Publisher**
3. Введите RTSP path (например: `camera` или `rtsp://192.168.0.138:554/live/ch0`)
4. Нажмите **Create Offer** (запросит доступ к камере/микрофону)
5. Скопируйте JSON из поля "Offer (copy this)"
6. Отправьте Offer на сервер для получения Answer
7. Вставьте Answer в поле "Answer (paste here)"
8. Нажмите **Set Answer**
9. Соединение установлено ✓

**Пример curl для получения Answer:**
```bash
curl -X POST http://localhost:7100/api/v1/webrtc/publisher/offer?path=camera \
  -H "Content-Type: application/json" \
  -d '{"type":"offer","sdp":"<PASTE_OFFER_SDP_HERE>"}'
```

### Subscriber - Просмотр RTSP камеры

1. Откройте http://localhost:4200 (можно в другой вкладке/браузере)
2. Перейдите на вкладку **Subscriber**
3. Нажмите **Create Offer**
4. Скопируйте JSON из поля "Offer (copy this)"
5. Отправьте Offer на bridge: `POST http://localhost:7100/api/v1/webrtc/subscriber/offer`
6. Получите Answer от сервера
7. Вставьте Answer в поле "Answer (paste here)"
8. Нажмите **Set Answer**
9. Видео с RTSP камеры появится в видео-плеере ✓

**Пример curl для получения Answer:**
```bash
curl -X POST http://localhost:7100/api/v1/webrtc/subscriber/offer \
  -H "Content-Type: application/json" \
  -d '{"type":"offer","sdp":"<PASTE_OFFER_SDP_HERE>"}'
```

## Конфигурация

### TURN серверы

Конфигурация в `infra/coturn/config/turnserver.conf.tmpl`:
```
listening-port=${COTURN_PORT}
tls-listening-port=${COTURN_TLS_PORT}
min-port=${COTURN_MIN_PORT}
max-port=${COTURN_MAX_PORT}
user=${COTURN_USER}:${COTURN_PASS}
realm=${COTURN_REALM}
```

Переменные задаются в `docker-compose.yml`:
- **TURN1**: порт 3478, user webrtc/webrtc, порты 49160-49200
- **TURN2**: порт 3479, user test/test, порты 49201-49240

### RTSP камера

Указывается в Publisher через параметр `path`:
```
POST /api/v1/webrtc/publisher/offer?path=rtsp://192.168.0.138:554/live/ch0
```

Или короткий путь (по умолчанию):
```
POST /api/v1/webrtc/publisher/offer?path=camera
```

## Требования

- Docker & Docker Compose
- Node.js 18+
- Python 3.11+ (для API App в Docker)
- Make

## Troubleshooting

### Видео не показывается

```bash
# Проверить все сервисы
make stop && make start

# Проверить логи API App
docker compose --env-file .env.local.example -f docker-compose.local.yaml logs -f

# Проверить логи в браузере (F12 → Console)
# Должны быть "typ relay" ICE candidates
```

### RTSP камера недоступна

```bash
# Проверить подключение к камере через FFmpeg
ffmpeg -i rtsp://user:pass@192.168.0.138:554/live/ch0 -f null -

# Проверить в VLC: Media → Open Network Stream
```

### TURN серверы не работают

```bash
# Проверить что coturn запущен
docker ps | grep coturn

# Проверить порты
sudo lsof -i:3478
sudo lsof -i:3479

# Перезапустить TURN серверы
make coturn-down && make coturn-up
```

### API App не запускается

```bash
# Пересобрать Docker образ
docker compose --env-file .env.local.example -f docker-compose.local.yaml build --no-cache

# Проверить логи
docker compose --env-file .env.local.example -f docker-compose.local.yaml logs -f

# Проверить что порт 7100 свободен
lsof -i:7100
```

---

## Локальная сборка API App (Docker)

### Сборка:

```bash
docker compose --env-file .env.local.example -f docker-compose.local.yaml build
```

### Запуск:

```bash
docker compose --env-file .env.local.example -f docker-compose.local.yaml up
```

Доступ к API: http://localhost:7100/

#### WebRTC эндпоинты:

- `GET /api/v1/webrtc/ice-config` - Получить TURN конфигурацию
- `PUT /api/v1/webrtc/turn-config` - Обновить TURN конфигурацию
- `GET /api/v1/webrtc/turn-config` - Получить текущую TURN конфигурацию
- `POST /api/v1/webrtc/publisher/offer` - Publisher endpoint (Browser offer → Server answer)
- `POST /api/v1/webrtc/subscriber/offer` - Subscriber endpoint (Browser offer → Server answer)
- `GET /api/v1/webrtc/webrtc/health` - Health check для WebRTC

### Остановка:

```bash
docker compose --env-file .env.local.example -f docker-compose.local.yaml down
```

---

## Разработка

### Запуск отдельных компонентов

```bash
# Только API App (Docker)
make apiapp-up

# Только WebApp (Angular)
make webapp

# Только TURN серверы
make coturn-up
```

### Логи

```bash
# API App логи
docker compose --env-file .env.local.example -f docker-compose.local.yaml logs -f

# TURN серверы логи
docker compose -f docker-compose.yml logs -f coturn1 coturn2

# WebApp логи
# Выводятся в stdout при запуске make webapp
```

---

## Лицензия

MIT
