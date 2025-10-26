# WeChat Integration - Technical Documentation

## 📋 **Обзор системы**

WeChat интеграция позволяет пользователям привязывать свои WeChat аккаунты к системе для упрощенного входа и управления профилем.

---

## 🗄️ **База данных (MSSQL)**

### **Схема `wechat`**

#### **Таблица `wechat.bindings`**
```sql
CREATE TABLE wechat.bindings (
    id INT PRIMARY KEY IDENTITY(1,1),
    user_id INT NOT NULL,
    wechat_openid NVARCHAR(100) NOT NULL,
    wechat_unionid NVARCHAR(100),
    nickname NVARCHAR(100),
    avatar_url NVARCHAR(500),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES Users.Users(UserID)
);
```

**Поля:**
- `id` - Уникальный идентификатор привязки
- `user_id` - ID пользователя в системе (FK к Users.Users)
- `wechat_openid` - WeChat OpenID пользователя
- `wechat_unionid` - WeChat UnionID (опционально)
- `nickname` - Никнейм пользователя в WeChat
- `avatar_url` - URL аватара пользователя
- `is_active` - Активна ли привязка
- `created_at` - Дата создания
- `updated_at` - Дата обновления

#### **Таблица `wechat.qr_sessions`**
```sql
CREATE TABLE wechat.qr_sessions (
    id INT PRIMARY KEY IDENTITY(1,1),
    session_id NVARCHAR(100) UNIQUE NOT NULL,
    user_id INT,
    qr_code_data NVARCHAR(MAX),
    status NVARCHAR(20) DEFAULT 'pending',
    expires_at DATETIME2,
    created_at DATETIME2 DEFAULT GETDATE()
);
```

**Поля:**
- `id` - Уникальный идентификатор сессии
- `session_id` - UUID сессии QR-кода
- `user_id` - ID пользователя (опционально)
- `qr_code_data` - Base64 данные QR-кода
- `status` - Статус сессии (pending, scanned, confirmed, expired)
- `expires_at` - Время истечения сессии
- `created_at` - Дата создания

### **Индексы**
```sql
CREATE INDEX IX_wechat_bindings_user_id ON wechat.bindings(user_id);
CREATE INDEX IX_wechat_bindings_openid ON wechat.bindings(wechat_openid);
CREATE INDEX IX_wechat_qr_sessions_session_id ON wechat.qr_sessions(session_id);
CREATE INDEX IX_wechat_qr_sessions_user_id ON wechat.qr_sessions(user_id);
```

---

## 🔧 **Backend (Python/Flask)**

### **Структура файлов**
```
Back/WeChat/
├── __init__.py
├── api/
│   ├── __init__.py
│   └── wechat_api.py          # API endpoints
├── service/
│   ├── __init__.py
│   └── wechat_service.py       # Бизнес-логика
├── models/
│   ├── __init__.py
│   ├── wechat_binding.py       # Модель привязки
│   └── qr_session.py           # Модель сессии
├── wechat_config.py            # Конфигурация
└── WECHAT_INTEGRATION_DOCS.md  # Документация
```

### **API Endpoints**

#### **POST /api/wechat/generate-qr**
Генерация QR-кода для привязки WeChat аккаунта.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "uuid-string",
    "qr_code_data": "base64-encoded-image",
    "expires_at": "2025-10-24T20:30:00Z"
  }
}
```

#### **GET /api/wechat/status/{session_id}**
Проверка статуса QR-сессии.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "uuid-string",
    "user_id": 106,
    "qr_code_data": "base64-encoded-image",
    "status": "pending|scanned|confirmed|expired",
    "expires_at": "2025-10-24T20:30:00Z",
    "created_at": "2025-10-24T20:27:00Z"
  }
}
```

#### **POST /api/wechat/bind**
Привязка WeChat аккаунта к пользователю.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "openid": "wechat_openid",
  "unionid": "wechat_unionid",
  "nickname": "user_nickname",
  "headimgurl": "avatar_url"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 106,
    "wechat_openid": "wechat_openid",
    "wechat_unionid": "wechat_unionid",
    "nickname": "user_nickname",
    "avatar_url": "avatar_url",
    "is_active": true,
    "created_at": "2025-10-24T20:30:00Z",
    "updated_at": "2025-10-24T20:30:00Z"
  }
}
```

#### **DELETE /api/wechat/unbind**
Отвязка WeChat аккаунта от пользователя.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "WeChat account unbound successfully"
}
```

#### **GET /api/wechat/binding**
Получение информации о привязке WeChat.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 106,
    "wechat_openid": "wechat_openid",
    "wechat_unionid": "wechat_unionid",
    "nickname": "user_nickname",
    "avatar_url": "avatar_url",
    "is_active": true,
    "created_at": "2025-10-24T20:30:00Z",
    "updated_at": "2025-10-24T20:30:00Z"
  }
}
```

#### **GET /api/wechat/callback**
Callback endpoint для WeChat OAuth (будущая реализация).

**Query Parameters:**
- `code` - Authorization code от WeChat
- `state` - State parameter для безопасности

### **Модели данных**

#### **WeChatBinding**
```python
@dataclass
class WeChatBinding:
    id: Optional[int] = None
    user_id: int = None
    wechat_openid: str = None
    wechat_unionid: Optional[str] = None
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
```

#### **QRSession**
```python
@dataclass
class QRSession:
    id: Optional[int] = None
    session_id: str = None
    user_id: Optional[int] = None
    qr_code_data: Optional[str] = None
    status: str = 'pending'
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
```

### **Конфигурация**

#### **wechat_config.py**
```python
WECHAT_CONFIG = {
    'APP_ID': 'your_wechat_app_id',
    'APP_SECRET': 'your_wechat_app_secret',
    'REDIRECT_URI': 'https://yourdomain.com/api/wechat/callback',
    'QR_SESSION_TIMEOUT': 300  # 5 минут
}
```

#### **Environment Variables (.env)**
```env
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret
WECHAT_REDIRECT_URI=https://yourdomain.com/api/wechat/callback
WECHAT_QR_TIMEOUT=300
```

---

## 🎨 **Frontend (React/TypeScript)**

### **Структура файлов**
```
Front/big-statistics-dashboard/src/
├── components/
│   └── WeChat/
│       ├── WeChatQRGenerator.tsx    # Генерация QR-кода
│       ├── WeChatStatus.tsx         # Статус привязки
│       └── WeChatSettings.tsx       # Главный компонент
├── hooks/
│   ├── useWeChatQR.ts              # Хук для QR-кодов
│   └── useWeChatBinding.ts          # Хук для привязки
└── pages/
    └── UserPage/
        └── UserPage.tsx            # Интеграция WeChat
```

### **Компоненты**

#### **WeChatSettings**
Главный компонент для управления WeChat интеграцией.

**Props:** Нет

**Функциональность:**
- Отображение статуса привязки
- Генерация QR-кода для привязки
- Управление привязкой/отвязкой

#### **WeChatQRGenerator**
Компонент для генерации и отображения QR-кода.

**Props:**
```typescript
interface WeChatQRGeneratorProps {
  onQRGenerated?: (qrData: string) => void;
  onStatusChange?: (status: string) => void;
}
```

**Функциональность:**
- Генерация QR-кода
- Отображение статуса сканирования
- Автоматическое обновление статуса

#### **WeChatStatus**
Компонент для отображения статуса привязки WeChat.

**Props:**
```typescript
interface WeChatStatusProps {
  onUnbind?: () => void;
}
```

**Функциональность:**
- Отображение информации о привязке
- Кнопка отвязки аккаунта

### **Хуки**

#### **useWeChatQR**
Хук для работы с QR-кодами.

**Возвращает:**
```typescript
{
  qrSession: QRSession | null;
  qrStatus: QRStatus | null;
  loading: boolean;
  error: string | null;
  generateQR: () => Promise<QRSession>;
  checkQRStatus: (sessionId: string) => Promise<QRStatus>;
}
```

#### **useWeChatBinding**
Хук для управления привязкой WeChat.

**Возвращает:**
```typescript
{
  binding: WeChatBinding | null;
  loading: boolean;
  error: string | null;
  getBinding: () => Promise<WeChatBinding>;
  bindWeChat: (data: WeChatData) => Promise<WeChatBinding>;
  unbindWeChat: () => Promise<boolean>;
}
```

### **Интерфейсы**

#### **WeChatBinding**
```typescript
interface WeChatBinding {
  id: number;
  user_id: number;
  wechat_openid: string;
  wechat_unionid?: string;
  nickname?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

#### **QRSession**
```typescript
interface QRSession {
  session_id: string;
  qr_code_data: string;
  expires_at: string;
}
```

#### **QRStatus**
```typescript
interface QRStatus {
  session_id: string;
  user_id: number;
  qr_code_data: string;
  status: 'pending' | 'scanned' | 'confirmed' | 'expired';
  expires_at: string;
  created_at: string;
}
```

---

## 🚀 **Установка и настройка**

### **1. Backend зависимости**
```bash
pip install qrcode==7.4.2
```

### **2. Создание таблиц БД**
Выполнить SQL скрипты для создания схемы `wechat` и таблиц.

### **3. Конфигурация**
Добавить переменные окружения в `.env` файл:
```env
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret
WECHAT_REDIRECT_URI=https://yourdomain.com/api/wechat/callback
WECHAT_QR_TIMEOUT=300
```

### **4. Регистрация Blueprint**
В `Run_Server.py`:
```python
from Back.WeChat.api.wechat_api import wechat_bp
app.register_blueprint(wechat_bp)
```

---

## 🔄 **Workflow привязки**

### **Текущий процесс (демо)**
1. Пользователь нажимает "Начать привязку"
2. Генерируется QR-код с session_id
3. Пользователь сканирует QR-код
4. Статус обновляется на "confirmed"
5. Создается запись в `wechat.bindings`

### **Будущий процесс (реальный)**
1. Пользователь нажимает "Начать привязку"
2. Генерируется QR-код с WeChat OAuth URL
3. Пользователь сканирует QR-код в WeChat
4. WeChat перенаправляет на callback URL
5. Получаем данные пользователя от WeChat
6. Создается запись в `wechat.bindings`

---

## 🛠️ **Разработка**

### **Что реализовано**
- ✅ Структура БД
- ✅ Backend API
- ✅ Frontend компоненты
- ✅ Демо-функциональность

### **Что нужно доработать**
- ❌ Реальная интеграция с WeChat OAuth
- ❌ Обработка callback от WeChat
- ❌ Получение данных пользователя
- ❌ Обработка ошибок WeChat API

### **Следующие шаги**
1. Зарегистрировать WeChat Website App
2. Получить реальные APP_ID и APP_SECRET
3. Реализовать OAuth flow
4. Добавить обработку callback
5. Протестировать с реальным WeChat

---

## 📝 **Примечания**

- Все endpoints требуют JWT аутентификации
- QR-коды истекают через 5 минут
- Привязка WeChat не влияет на основную аутентификацию
- Пользователь может иметь только одну активную привязку WeChat
- WeChat аккаунт может быть привязан только к одному пользователю

---

**Версия документации:** 1.0  
**Дата создания:** 2025-10-24  
**Статус:** Демо-версия готова, требуется реальная интеграция с WeChat
