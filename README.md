# RTSP to WebRTC Bridge Project

Система для передачи видео из RTSP-камеры в браузер через WebRTC.

## Структура проекта

```
.
├── infra/secrets/          # Конфигурационные файлы
│   ├── .env.turn          # TURN server credentials
│   └── .env.rtsp          # Camera credentials
├── services/
│   └── webrtc-bridge/     # Node.js WebRTC bridge сервис
└── webapp/                # Angular клиент
```

## Установка и запуск

### 1. WebRTC Bridge Service

```bash
cd services/webrtc-bridge
npm install
npm run dev
```

Сервис запустится на `http://localhost:8085`

### 2. Angular Client

```bash
cd webapp
npm install
npm start
```

Клиент откроется на `http://localhost:4200`

## Конфигурация

### infra/secrets/.env.turn
```env
TURN_URLS=turn:turn.example.com:3478
TURN_USER=username
TURN_PASS=password
```

### infra/secrets/.env.rtsp
```env
CAMERA_URL=rtsp://192.168.0.138:554
CAMERA_USER=admin
CAMERA_PASS=admin
```

## Использование

1. Запустите bridge-сервис
2. Запустите Angular клиент
3. Откройте браузер на `http://localhost:4200`
4. Введите RTSP URL камеры (по умолчанию: `rtsp://192.168.0.138:554`)
5. Нажмите "Connect"

## Требования

- Node.js 18+ (для bridge-сервиса)
- Node.js 20+ (для Angular клиента)
- FFmpeg (устанавливается автоматически в Docker)

## Docker

Для запуска bridge-сервиса в Docker:

```bash
cd services/webrtc-bridge
docker build -t webrtc-bridge .
docker run -p 8085:8085 \
  --env-file ../../infra/secrets/.env.turn \
  --env-file ../../infra/secrets/.env.rtsp \
  webrtc-bridge
```

## Troubleshooting

### RTSP поток не подключается
- Проверьте IP камеры: `ping 192.168.0.138`
- Проверьте порт RTSP: `nmap -p 554 192.168.0.138`
- Проверьте RTSP URL в VLC: Media → Open Network Stream

### WebRTC не работает
- Проверьте, что bridge-сервис запущен: `curl http://localhost:8085/health`
- Проверьте консоль браузера на ошибки
- Убедитесь, что CORS включён в bridge-сервисе
