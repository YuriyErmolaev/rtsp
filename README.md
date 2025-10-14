# RTSP to WebRTC Bridge

Система для передачи видео из RTSP-камеры в браузер через WebRTC с поддержкой TURN сервера.

## Архитектура

```
Browser → WebRTC Bridge (Node.js :8085) → MediaMTX (:8889) → FFmpeg → RTSP Camera
                ↓
         TURN Server (coturn :3478)
```

## Компоненты

- **MediaMTX** - RTSP→WebRTC сервер с H264 encoding
- **WebRTC Bridge** - Node.js API для Offer/Answer signaling
- **Angular WebApp** - браузерный клиент
- **Coturn** - TURN сервер для NAT traversal
- **FFmpeg** - конвертация H265→H264

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
- WebApp: http://localhost:4200
- Bridge API: http://localhost:8085
- MediaMTX: http://localhost:8889

### Остановка всех сервисов

```bash
make stop
```

## Доступные команды

```bash
make help        # Показать все команды
make install     # Установить зависимости
make start       # Запустить все сервисы
make stop        # Остановить все сервисы
make restart     # Перезапустить все сервисы

make mediamtx    # Запустить только MediaMTX
make bridge      # Запустить только WebRTC bridge
make webapp      # Запустить только Angular webapp
make turn        # Запустить TURN сервер (требует sudo)

make logs        # Показать логи всех сервисов
make clean       # Удалить node_modules и build артефакты
```

## Конфигурация

### RTSP камера

`infra/secrets/.env.rtsp`:
```env
CAMERA_URL=rtsp://192.168.0.138:554
CAMERA_USER=Vu5RqXpP
CAMERA_PASS=5K5mjQfVt4HUDsrK
```

### TURN сервер

`infra/secrets/.env.turn`:
```env
TURN_URLS=turn:localhost:3478?transport=udp,turn:localhost:3478?transport=tcp
TURN_USER=webrtc
TURN_PASS=webrtc
```

`infra/turnserver.conf`:
```
listening-port=3478
fingerprint
lt-cred-mech
user=webrtc:webrtc
realm=rtsp-webrtc
external-ip=127.0.0.1
```

### MediaMTX

`infra/mediamtx.yml` - конфигурация путей и RTSP источников:
```yaml
paths:
  camera:
    runOnDemand: ffmpeg -i rtsp://... -c:v libx264 ... -f rtsp rtsp://localhost:8554/camera
```

## Структура проекта

```
.
├── Makefile                    # Команды для управления проектом
├── infra/
│   ├── secrets/
│   │   ├── .env.turn          # TURN credentials
│   │   └── .env.rtsp          # RTSP camera credentials
│   ├── mediamtx               # MediaMTX binary
│   ├── mediamtx.yml           # MediaMTX config
│   └── turnserver.conf        # Coturn config
├── services/
│   └── webrtc-bridge/         # Node.js WebRTC signaling server
│       ├── src/
│       │   └── server.ts      # Express API (Offer/Answer proxy)
│       └── package.json
└── webapp/                    # Angular frontend
    ├── src/
    │   └── app/camera/
    │       ├── camera.component.ts
    │       └── webrtc-client.ts
    └── package.json
```

## Использование

### Режим 1: Автоматическое подключение (Camera)

1. Запустить все сервисы: `make start`
2. Открыть http://localhost:4200
3. Вкладка **Camera**
4. Нажать **Connect**
5. Видео с RTSP камеры появится в браузере

### Режим 2: Ручной Offer/Answer (Publisher/Subscriber)

WebApp предоставляет 3 вкладки:
- **Camera** - автоматическое подключение к RTSP камере
- **Publisher** - отправка видео с веб-камеры (ручной Offer/Answer)
- **Subscriber** - получение видео из RTSP камеры (ручной Offer/Answer)

#### Publisher (отправка видео с веб-камеры):

1. Откройте http://localhost:4200
2. Перейдите на вкладку **Publisher**
3. Нажмите **Create Offer** (запросит доступ к камере/микрофону)
4. Скопируйте JSON из поля "Offer (copy this)"
5. Передайте Offer на сервер/другое устройство для получения Answer
6. Вставьте Answer в поле "Answer (paste here)" на Publisher
7. Нажмите **Set Answer**
8. Соединение установлено, видео с веб-камеры передаётся ✓

#### Subscriber (получение видео из RTSP камеры):

1. Откройте http://localhost:4200 (можно в другой вкладке/браузере)
2. Перейдите на вкладку **Subscriber**
3. Нажмите **Create Offer**
4. Скопируйте JSON из поля "Offer (copy this)"
5. Отправьте Offer на bridge: `POST http://localhost:8085/webrtc/offer?path=camera`
6. Получите Answer от bridge
7. Вставьте Answer в поле "Answer (paste here)" на Subscriber
8. Нажмите **Set Answer**
9. Видео с RTSP камеры появится в видео-плеере ✓

**Пример curl для получения Answer:**
```bash
curl -X POST http://localhost:8085/webrtc/offer?path=camera \
  -H "Content-Type: application/json" \
  -d '{"type":"offer","sdp":"<PASTE_OFFER_SDP_HERE>"}'
```

## API Endpoints

### WebRTC Bridge (:8085)

- `GET /health` - Health check
- `GET /webrtc/ice-config` - Получить ICE configuration (STUN/TURN)
- `POST /webrtc/offer` - Отправить WebRTC Offer, получить Answer

### MediaMTX (:8889)

- `POST /{path}/whep` - WHEP endpoint для WebRTC

## Требования

- Node.js 18+
- FFmpeg
- Coturn (для TURN)
- Make

## Troubleshooting

### Видео не показывается

```bash
# Проверить все сервисы
make stop && make start

# Проверить логи в браузере (F12 → Console)
# Должны быть "typ relay" ICE candidates
```

### RTSP камера недоступна

```bash
# Проверить подключение к камере
ffmpeg -i rtsp://Vu5RqXpP:5K5mjQfVt4HUDsrK@192.168.0.138:554/live/ch0 -f null -

# Проверить VLC: Media → Open Network Stream
```

### TURN не работает

```bash
# Проверить что coturn запущен
sudo lsof -i:3478

# Запустить TURN сервер
make turn
```

## Разработка

### Запуск отдельных компонентов

```bash
# Только MediaMTX
make mediamtx

# Только Bridge
make bridge

# Только WebApp
make webapp
```

### Логи

Логи MediaMTX и Bridge выводятся в stdout. Логи TURN сервера в `/tmp/turnserver.log`.

## Лицензия

MIT
