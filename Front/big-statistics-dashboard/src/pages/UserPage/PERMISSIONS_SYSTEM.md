# 📚 Система прав пользователей - Документация

## 📖 Содержание

1. [Общий обзор](#общий-обзор)
2. [Архитектура базы данных](#архитектура-базы-данных)
3. [Backend API](#backend-api)
4. [Frontend реализация](#frontend-реализация)
5. [Логика проверки прав](#логика-проверки-прав)
6. [Примеры использования](#примеры-использования)
7. [Расширение системы](#расширение-системы)
8. [Рекомендации для будущего развития](#рекомендации-для-будущего-развития)

---

## 🎯 Общий обзор

### Текущая реализация

Система прав построена на **принципе минимальных привилегий** с явным разрешением доступа:

- **По умолчанию**: Все пользователи видят все обычные страницы, но **НЕ могут** редактировать данные
- **Скрытые страницы**: Требуют явного права `CanView = 1`
- **Редактирование**: Требует явного права `CanEdit = 1`
- **Администраторы**: Имеют полный доступ ко всему (`IsAdmin = 1`)

### Типы прав

| Тип права | Назначение | Пример |
|-----------|-----------|--------|
| `CanView` | Право на просмотр скрытой страницы | Доступ к странице KPI |
| `CanEdit` | Право на изменение данных на странице | Добавление потерь времени в Production |
| `IsAdmin` | Полный доступ ко всему (глобальное право) | Управление пользователями |

---

## 🗄️ Архитектура базы данных

### Схема `Users`

```
Users (схема)
├── Users                    (Таблица пользователей)
├── Pages                    (Справочник страниц, требующих права)
├── UserPagePermissions      (Права пользователей на страницы)
├── UserReports              (Пользовательские отчеты - РЕАЛИЗОВАНО ✅)
└── AuditLog                 (Логирование действий пользователей - РЕАЛИЗОВАНО ✅)
```

### Таблица `Users.Users`

Основная таблица пользователей.

```sql
CREATE TABLE Users.Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(50) UNIQUE NOT NULL,
    Password NVARCHAR(100) NOT NULL,        -- Пароль БЕЗ хеша
    FullName NVARCHAR(100),
    Email NVARCHAR(100),
    IsAdmin BIT DEFAULT 0,                  -- Глобальное право администратора
    IsActive BIT DEFAULT 1,                 -- Активен/деактивирован
    CreatedAt DATETIME DEFAULT GETDATE(),
    LastLogin DATETIME NULL
);
```

**Поля:**
- `IsAdmin` - если `1`, пользователь имеет **ВСЕ** права автоматически
- `IsActive` - если `0`, пользователь не может войти в систему

---

### Таблица `Users.Pages`

Справочник страниц, **требующих специальных прав**.

> ⚠️ **ВАЖНО**: В эту таблицу вносятся **ТОЛЬКО** страницы, которые требуют специальных прав. Обычные страницы (home, plan, tv и т.д.) **НЕ вносятся**.

```sql
CREATE TABLE Users.Pages (
    PageID INT IDENTITY(1,1) PRIMARY KEY,
    PageKey NVARCHAR(50) UNIQUE NOT NULL,       -- Уникальный ключ страницы
    PageName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    RequiresViewPermission BIT DEFAULT 0,       -- 1 = скрытая страница
    RequiresEditPermission BIT DEFAULT 0,       -- 1 = есть редактируемые данные
    DisplayOrder INT DEFAULT 0
);
```

**Примеры записей:**

```sql
-- Скрытая страница (требует право на просмотр)
INSERT INTO Users.Pages (PageKey, PageName, RequiresViewPermission, RequiresEditPermission) 
VALUES ('kpi', N'KPI', 1, 0);

-- Страница с правом на редактирование (РЕАЛИЗОВАНО)
INSERT INTO Users.Pages (PageKey, PageName, RequiresViewPermission, RequiresEditPermission) 
VALUES ('orders_orderlog_edit', N'Orders - Order Log (Edit Standard Reports)', 0, 1);
```

**Логика полей:**
- `RequiresViewPermission = 1` → Страница **скрытая**, нужно право `CanView = 1` чтобы видеть
- `RequiresEditPermission = 1` → На странице есть функции редактирования, нужно право `CanEdit = 1`

---

### Таблица `Users.UserPagePermissions`

Права конкретного пользователя на конкретную страницу.

```sql
CREATE TABLE Users.UserPagePermissions (
    PermissionID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    PageKey NVARCHAR(50) NOT NULL,
    CanView BIT DEFAULT 0,                      -- 1 = может видеть скрытую страницу
    CanEdit BIT DEFAULT 0,                      -- 1 = может редактировать данные
    FOREIGN KEY (UserID) REFERENCES Users.Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (PageKey) REFERENCES Users.Pages(PageKey),
    UNIQUE (UserID, PageKey)
);
```

**Примеры записей:**

```sql
-- GM может видеть KPI
INSERT INTO Users.UserPagePermissions (UserID, PageKey, CanView, CanEdit) 
VALUES (2, 'kpi', 1, 0);

-- Umar может видеть KPI
INSERT INTO Users.UserPagePermissions (UserID, PageKey, CanView, CanEdit) 
VALUES (3, 'kpi', 1, 0);

-- В будущем: GM может редактировать Production
-- INSERT INTO Users.UserPagePermissions (UserID, PageKey, CanView, CanEdit) 
-- VALUES (2, 'production', 0, 1);
```

---

### Таблица `Users.AuditLog`

Логирование всех действий пользователей.

```sql
CREATE TABLE Users.AuditLog (
    LogID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    ActionType NVARCHAR(50) NOT NULL,  -- 'login', 'logout', 'session_start', 'page_view', 'data_edit'
    PageKey NVARCHAR(100),             -- Страница где произошло действие
    ActionDetails NVARCHAR(MAX),       -- JSON с деталями (опционально)
    IPAddress NVARCHAR(50),            -- IP адрес пользователя
    UserAgent NVARCHAR(500),           -- Браузер и ОС
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (UserID) REFERENCES Users.Users(UserID) ON DELETE CASCADE
);
```

**Примеры записей:**

```sql
-- Вход с паролем
INSERT INTO Users.AuditLog (UserID, ActionType, IPAddress)
VALUES (2, 'login', '192.168.1.100');

-- Открытие приложения с сохраненным токеном
INSERT INTO Users.AuditLog (UserID, ActionType, IPAddress)
VALUES (2, 'session_start', '192.168.1.100');

-- Посещение страницы
INSERT INTO Users.AuditLog (UserID, ActionType, PageKey, IPAddress)
VALUES (2, 'page_view', 'production', '192.168.1.100');

-- Выход
INSERT INTO Users.AuditLog (UserID, ActionType, IPAddress)
VALUES (2, 'logout', '192.168.1.100');
```

**Защита от дублирования:**
- `session_start` - не создается если есть запись < 30 секунд
- `page_view` - не создается если посещение ЭТОЙ ЖЕ страницы < 30 секунд

---

## 🔧 Backend API

### Структура файлов

```
Back/Users/
├── api/
│   ├── auth_api.py          # Авторизация и логирование
│   ├── users_api.py         # Управление профилем
│   └── admin_api.py         # Админ-панель (управление пользователями, статистика)
├── service/
│   ├── auth_service.py      # Логика авторизации и проверки прав
│   ├── users_service.py     # Работа с профилями пользователей
│   ├── avatar_service.py    # Работа с аватарками
│   └── audit_service.py     # Логирование и статистика (НОВОЕ ✅)
└── middleware/
    └── (планируется)        # Middleware для защиты API
```

---

### API Endpoints

#### 1. Авторизация

**POST `/api/auth/login`**

Авторизация пользователя.

```python
# Request
{
    "username": "GM",
    "password": "123"
}

# Response
{
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIs...",  # JWT токен
    "user": {
        "user_id": 2,
        "username": "GM",
        "full_name": "GM User",
        "email": null,
        "is_admin": false
    },
    "permissions": [
        {
            "page_key": "kpi",
            "can_view": true,
            "can_edit": false
        }
    ]
}
```

---

**GET `/api/auth/me`**

Получение текущего пользователя (проверка токена).

```python
# Headers
Authorization: Bearer <token>

# Response
{
    "success": true,
    "user": {
        "user_id": 2,
        "username": "GM",
        "is_admin": false
    },
    "permissions": [...]
}
```

---

**POST `/api/auth/check-permission`**

Проверка конкретного права пользователя.

```python
# Headers
Authorization: Bearer <token>

# Request
{
    "page_key": "kpi",
    "permission_type": "view"  # или "edit"
}

# Response
{
    "success": true,
    "has_permission": true
}
```

---

#### 2. Управление профилем

**GET `/api/users/profile`**

Получение данных профиля.

**PUT `/api/users/profile`**

Обновление профиля (имя, пароль).

```python
# Request
{
    "full_name": "Новое Имя",  # опционально
    "password": "новый_пароль"  # опционально
}
```

---

### Логика проверки прав (Backend)

Файл: `Back/Users/service/auth_service.py`

```python
def check_page_permission(user_id: int, page_key: str, permission_type: str = 'view') -> bool:
    """
    Проверяет право пользователя на страницу.
    
    Логика:
    1. Если IsAdmin = 1 → return True (админ может всё)
    2. Проверяем есть ли страница в справочнике Users.Pages
       - НЕТ → return True (обычная страница, доступ для всех)
       - ДА → смотрим дальше
    3. Если страница требует права (RequiresViewPermission = 1 или RequiresEditPermission = 1):
       - Ищем запись в Users.UserPagePermissions
       - НЕТ записи → return False (нет доступа)
       - ЕСТЬ запись → проверяем CanView/CanEdit
    """
    # ... код см. в файле
```

**Пример SQL запроса:**

```sql
-- Проверка: это админ?
SELECT IsAdmin FROM Users.Users WHERE UserID = ?

-- Проверка: страница есть в справочнике?
SELECT RequiresViewPermission, RequiresEditPermission
FROM Users.Pages
WHERE PageKey = ?

-- Если страница требует права, проверяем:
SELECT CanView, CanEdit
FROM Users.UserPagePermissions
WHERE UserID = ? AND PageKey = ?
```

---

## ⚛️ Frontend реализация

### Структура файлов

```
Front/src/
├── context/
│   └── AuthContext.tsx              # Управление состоянием авторизации
├── components/
│   ├── RequirePermission.tsx        # HOC для защиты маршрутов
│   └── requirePermissionTranslation.json
└── pages/
    └── UserPage/
        └── UserPage.tsx             # Страница профиля
```

---

### AuthContext

Файл: `Front/src/context/AuthContext.tsx`

**Что хранит:**
- `user` - данные пользователя (user_id, username, full_name, is_admin)
- `permissions` - массив прав `[{page_key, can_view, can_edit}, ...]`
- `token` - JWT токен
- `isLoading` - статус загрузки данных
- `isAuthenticated` - авторизован ли пользователь

**Методы:**
- `login(username, password)` - авторизация
- `logout()` - выход
- `hasPermission(pageKey, permissionType)` - проверка права

---

### Функция `hasPermission()`

Файл: `Front/src/context/AuthContext.tsx`

```typescript
const hasPermission = (pageKey: string, permissionType: 'view' | 'edit' = 'view'): boolean => {
  // 1. Админ → всё разрешено
  if (user?.is_admin) {
    return true;
  }

  // 2. Список скрытых страниц (требующих специальных прав)
  const restrictedPages = ['kpi'];  // ⚠️ Обновлять при добавлении новых скрытых страниц

  // 3. Ищем право для данной страницы
  const permission = permissions.find(p => p.page_key === pageKey);

  // 4. Если страница в списке скрытых
  if (restrictedPages.includes(pageKey)) {
    if (!permission) return false;  // Нет записи = нет доступа
    return permissionType === 'view' ? permission.can_view : permission.can_edit;
  }

  // 5. Для обычных страниц
  if (!permission) return true;  // Нет записи = доступ разрешен
  return permissionType === 'view' ? permission.can_view : permission.can_edit;
};
```

> ⚠️ **ВАЖНО**: Список `restrictedPages` должен **синхронизироваться** с таблицей `Users.Pages` (страницы где `RequiresViewPermission = 1`).

---

### Компонент `RequirePermission`

Файл: `Front/src/components/RequirePermission.tsx`

HOC (Higher-Order Component) для защиты маршрутов.

**Использование в App.tsx:**

```tsx
<Route 
  path="/kpi" 
  element={
    <RequireAuth>
      <RequirePermission pageKey="kpi" permissionType="view">
        <KPI />
      </RequirePermission>
    </RequireAuth>
  } 
/>
```

**Логика работы:**

1. Показывает спиннер загрузки пока `isLoading = true`
2. Если не авторизован → редирект на `/login`
3. Проверяет `hasPermission(pageKey, permissionType)`
   - `false` → показывает страницу "403 Доступ запрещён"
   - `true` → рендерит `children` (саму страницу)

---

### Sidebar - скрытие пунктов меню

Файл: `Front/src/components/Sidebar/Sidebar.tsx`

Пункты меню скрываются на основе проверки прав:

```tsx
{/* Показываем KPI только если у пользователя есть право */}
{user?.is_admin || permissions.some(p => p.page_key === 'kpi' && p.can_view) ? (
  <Link to="/kpi" className="block">
    <SidebarIcon icon={<LineChart />} label={t('kpi')} ... />
  </Link>
) : null}
```

---

## 🔍 Логика проверки прав (Пошагово)

### Сценарий 1: Пользователь Aikerim заходит на `/kpi`

**Дано:**
- UserID: 4
- IsAdmin: 0 (обычный пользователь)
- Нет записи в `Users.UserPagePermissions` для `kpi`

**Backend (при логине):**
1. Проверяем логин/пароль ✅
2. Загружаем права из `Users.UserPagePermissions` → пустой массив `[]`
3. Возвращаем токен + пустой массив permissions

**Frontend (при переходе на `/kpi`):**
1. `RequirePermission` вызывает `hasPermission('kpi', 'view')`
2. `is_admin = false` → идем дальше
3. `'kpi'` в списке `restrictedPages` → это скрытая страница
4. Ищем `permission` с `page_key = 'kpi'` → **НЕТ**
5. **Результат: `return false`** → Показываем "403 Доступ запрещён"

**Sidebar:**
- Условие: `user?.is_admin || permissions.some(p => p.page_key === 'kpi' && p.can_view)`
- `false || false` → **Пункт меню KPI скрыт**

---

### Сценарий 2: Пользователь GM заходит на `/kpi`

**Дано:**
- UserID: 2
- IsAdmin: 0
- **Есть запись**: `(UserID=2, PageKey='kpi', CanView=1, CanEdit=0)`

**Backend (при логине):**
1. Проверяем логин/пароль ✅
2. Загружаем права → `[{page_key: 'kpi', can_view: true, can_edit: false}]`
3. Возвращаем токен + массив permissions

**Frontend (при переходе на `/kpi`):**
1. `hasPermission('kpi', 'view')`
2. `is_admin = false` → идем дальше
3. `'kpi'` в списке `restrictedPages` → скрытая страница
4. Ищем `permission` → **ЕСТЬ**: `{page_key: 'kpi', can_view: true}`
5. **Результат: `return true`** → Показываем страницу KPI

**Sidebar:**
- Условие: `permissions.some(p => p.page_key === 'kpi' && p.can_view)`
- `true` → **Пункт меню KPI виден**

---

### Сценарий 3: Администратор заходит на `/kpi`

**Дано:**
- UserID: 1
- **IsAdmin: 1**
- Нет записи в `Users.UserPagePermissions`

**Frontend (при переходе на `/kpi`):**
1. `hasPermission('kpi', 'view')`
2. `user?.is_admin = true` → **СРАЗУ return true**
3. **Результат:** Показываем страницу KPI

**Sidebar:**
- Условие: `user?.is_admin || ...`
- `true` → **Пункт меню KPI виден**

---

## 📝 Примеры использования

### Добавление новой скрытой страницы

**Задача:** Сделать страницу "Финансы" скрытой (требует право на просмотр).

#### 1. Backend (SQL)

```sql
-- Добавляем страницу в справочник
INSERT INTO Users.Pages (PageKey, PageName, RequiresViewPermission, RequiresEditPermission, DisplayOrder)
VALUES ('finance', N'Финансы', 1, 0, 7);

-- Даем право GM на просмотр
INSERT INTO Users.UserPagePermissions (UserID, PageKey, CanView, CanEdit)
VALUES (2, 'finance', 1, 0);
```

#### 2. Frontend (AuthContext.tsx)

```tsx
// Обновляем список скрытых страниц
const restrictedPages = ['kpi', 'finance'];  // ← добавили 'finance'
```

#### 3. Frontend (App.tsx)

```tsx
<Route 
  path="/finance" 
  element={
    <RequireAuth>
      <RequirePermission pageKey="finance" permissionType="view">
        <FinancePage />
      </RequirePermission>
    </RequireAuth>
  } 
/>
```

#### 4. Frontend (Sidebar.tsx)

```tsx
{user?.is_admin || permissions.some(p => p.page_key === 'finance' && p.can_view) ? (
  <Link to="/finance" className="block">
    <SidebarIcon icon={<DollarSign />} label={t('finance')} ... />
  </Link>
) : null}
```

---

### Добавление права на редактирование

**Задача:** Дать GM право редактировать данные на странице Production.

✅ **РЕАЛИЗОВАНО!** Production полностью защищена системой прав.

#### Реальная реализация:

**1. Backend (SQL)**

```sql
-- Добавляем страницу Working Calendar в справочник
INSERT INTO Users.Pages (PageKey, PageName, Description, RequiresEditPermission)
VALUES ('production_working_calendar_edit', 
        N'Production - Working Calendar (Edit)',
        N'Permission to create/edit/delete working schedules',
        1);

-- Добавляем права на Time Loss (полные)
INSERT INTO Users.Pages (PageKey, PageName, Description, RequiresEditPermission)
VALUES ('production_timeloss_edit',
        N'Production - Time Loss (Full Edit)',
        N'Full access: create, edit all fields, delete',
        1);

-- Добавляем права на Time Loss (ограниченные)
INSERT INTO Users.Pages (PageKey, PageName, Description, RequiresEditPermission)
VALUES ('production_timeloss_limited_edit',
        N'Production - Time Loss (Limited Edit)',
        N'Limited: edit only ActionPlan, Responsible, CompletedDate',
        1);

-- Даем право GM на полное редактирование Time Loss
INSERT INTO Users.UserPagePermissions (UserID, PageKey, CanView, CanEdit)
VALUES (2, 'production_timeloss_edit', 0, 1);
```

**2. Frontend (компоненты Production)**

```tsx
// TimeLoss.tsx
import { useAuth } from '../../../../context/AuthContext';

const TimeLoss: React.FC = () => {
  const { hasPermission } = useAuth();
  
  const canEditFull = hasPermission('production_timeloss_edit', 'edit');
  const canEditLimited = hasPermission('production_timeloss_limited_edit', 'edit');
  
  return (
    <Table 
      canEditFull={canEditFull}
      canEditLimited={canEditLimited}
    />
  );
};

// TimeLossTable.tsx
const columns = [
  { 
    field: 'OnlyDate', 
    editable: (p) => canEditFull && editMode  // Только Full Edit
  },
  { 
    field: 'ActionPlan', 
    editable: (p) => (canEditFull || canEditLimited) && editMode  // Full или Limited
  },
  // ...
];

// Кнопки
{canEditFull && <button onClick={addRow}>Add Row</button>}
{(canEditFull || canEditLimited) && <EditModeToggle />}
{canEditFull && <button onClick={deleteMode}>Delete</button>}
```

**3. Результат:**

Теперь есть **3 уровня доступа** к Time Loss:
- **Viewer** - только просмотр
- **Limited Editor** - редактирование 3 полей (ActionPlan, Responsible, CompletedDate)
- **Full Editor** - полный доступ (создание, редактирование всех полей, удаление)

---

## 🚀 Расширение системы

### Текущие ограничения

1. ✅ **Работает:** Скрытие целых страниц
2. ✅ **Работает:** Проверка прав на редактирование данных
3. ✅ **Работает:** Многоуровневые права (Viewer, Limited, Full для Time Loss)
4. ✅ **Работает:** Логирование действий пользователей
5. ✅ **Работает:** Статистика активности и популярности страниц
6. ❌ **Не работает:** Частичный доступ к данным на странице (например, видеть только свой отдел)
7. ❌ **Не работает:** Частичное редактирование (например, редактировать только свои записи)
8. ❌ **Не работает:** Защита Backend API endpoints через middleware

---

### Сценарии для будущего развития

#### Сценарий 1: Частичный доступ к данным

**Пример:** Пользователь видит страницу Production, но только данные своего цеха.

**Возможные подходы:**

##### Подход A: Фильтрация на уровне API

**Backend:**

```sql
-- Добавить поле в UserPagePermissions
ALTER TABLE Users.UserPagePermissions
ADD FilterCriteria NVARCHAR(MAX);  -- JSON с критериями фильтрации

-- Пример записи
UPDATE Users.UserPagePermissions
SET FilterCriteria = '{"WorkShopName_CH": ["装配车间"]}'
WHERE UserID = 4 AND PageKey = 'production';
```

**Изменения в API:**

```python
def get_production_data(user_id, filters=None):
    # Загружаем критерии фильтрации для пользователя
    user_filters = get_user_filter_criteria(user_id, 'production')
    
    sql = "SELECT * FROM Views_For_Plan.DailyPlan_CustomWS WHERE 1=1"
    
    # Применяем пользовательские фильтры
    if user_filters:
        for field, values in user_filters.items():
            sql += f" AND {field} IN ({', '.join(['?'] * len(values))})"
    
    # Применяем обычные фильтры из запроса
    ...
```

---

##### Подход B: Роли с предустановленными правами

**Backend:**

```sql
-- Создать таблицу ролей
CREATE TABLE Users.Roles (
    RoleID INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500)
);

-- Связать роли с правами
CREATE TABLE Users.RolePermissions (
    RoleID INT,
    PageKey NVARCHAR(50),
    CanView BIT,
    CanEdit BIT,
    FilterCriteria NVARCHAR(MAX),
    FOREIGN KEY (RoleID) REFERENCES Users.Roles(RoleID)
);

-- Назначить роль пользователю
CREATE TABLE Users.UserRoles (
    UserID INT,
    RoleID INT,
    FOREIGN KEY (UserID) REFERENCES Users.Users(UserID),
    FOREIGN KEY (RoleID) REFERENCES Users.Roles(RoleID)
);
```

**Примеры ролей:**
- "Менеджер цеха сборки" → Видит только сборочный цех, может редактировать графики
- "Наблюдатель производства" → Видит все цеха, не может редактировать
- "Аналитик" → Видит все, включая финансы, не может редактировать

---

#### Сценарий 2: Частичное редактирование

**Пример:** Пользователь может редактировать только записи, которые он сам создал.

**Возможные подходы:**

##### Добавить поле CreatedBy

```sql
-- Добавить в таблицы с данными
ALTER TABLE Production.TimeLoss_Entries
ADD CreatedBy INT,
    FOREIGN KEY (CreatedBy) REFERENCES Users.Users(UserID);
```

**Backend API:**

```python
@require_permission('production', 'edit')
def update_timeloss_entry(entry_id, user_id):
    # Проверяем: это запись пользователя?
    entry = get_entry(entry_id)
    
    if not user.is_admin and entry.CreatedBy != user_id:
        raise PermissionError("Вы можете редактировать только свои записи")
    
    # Обновляем запись
    ...
```

---

#### Сценарий 3: Защита Backend API

**Текущее состояние:** API endpoints **НЕ защищены** проверкой прав.

**Планируется:**

##### Создать middleware/декораторы

Файл: `Back/Users/middleware/auth_middleware.py`

```python
from functools import wraps
from flask import request, jsonify
from ..service.auth_service import verify_jwt_token, check_page_permission

def require_auth(f):
    """Требует наличия валидного JWT токена"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Не авторизован"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({"error": "Невалидный токен"}), 401
        
        # Добавляем данные пользователя в request
        request.user = user_data
        return f(*args, **kwargs)
    
    return decorated_function


def require_permission(page_key, permission_type='view'):
    """Требует конкретного права"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(request, 'user'):
                return jsonify({"error": "Не авторизован"}), 401
            
            user_id = request.user['user_id']
            
            # Проверяем право
            has_perm = check_page_permission(user_id, page_key, permission_type)
            
            if not has_perm:
                return jsonify({"error": "Нет прав доступа"}), 403
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator
```

**Использование:**

```python
from Back.Users.middleware.auth_middleware import require_auth, require_permission

# Только авторизованные пользователи
@bp.route("/api/production/data", methods=["GET"])
@require_auth
def get_production_data():
    user = request.user
    ...

# Требует право на редактирование Production
@bp.route("/api/timeloss/entry", methods=["POST"])
@require_auth
@require_permission('production', 'edit')
def create_timeloss_entry():
    user = request.user
    ...
```

---

## 📌 Рекомендации для будущего развития

### 1. Синхронизация Frontend и Backend

⚠️ **Проблема:** Список `restrictedPages` в `AuthContext.tsx` должен синхронизироваться с БД.

**Решение:**

#### Вариант A: API endpoint для получения списка

```python
@bp.route("/api/auth/restricted-pages", methods=["GET"])
def get_restricted_pages():
    """Возвращает список страниц требующих права"""
    sql = """
        SELECT PageKey 
        FROM Users.Pages 
        WHERE RequiresViewPermission = 1
    """
    # ...
    return jsonify({"restricted_pages": ["kpi", "finance", ...]})
```

```tsx
// В AuthContext при инициализации
useEffect(() => {
  fetch('/api/auth/restricted-pages')
    .then(res => res.json())
    .then(data => setRestrictedPages(data.restricted_pages));
}, []);
```

#### Вариант B: Добавить в ответ /login

```python
@bp.route("/api/auth/login", methods=["POST"])
def login():
    # ...
    return jsonify({
        "user": {...},
        "permissions": [...],
        "restricted_pages": ["kpi", "finance", ...]  # ← добавить
    })
```

---

### 2. Типизация permissions на Frontend

**Создать TypeScript типы:**

```tsx
// src/types/permissions.ts

export type PageKey = 'kpi' | 'finance' | 'production' | 'orders' | ...;

export type PermissionType = 'view' | 'edit';

export interface Permission {
  page_key: PageKey;
  can_view: boolean;
  can_edit: boolean;
}

export interface User {
  user_id: number;
  username: string;
  full_name: string;
  email: string | null;
  is_admin: boolean;
}
```

**Использовать в AuthContext:**

```tsx
import { User, Permission, PageKey, PermissionType } from '../types/permissions';

interface AuthContextType {
  user: User | null;
  permissions: Permission[];
  hasPermission: (pageKey: PageKey, permissionType?: PermissionType) => boolean;
  // ...
}
```

---

### 3. Логирование проверок прав

**Backend:** Логировать все проверки прав и отказы.

```python
def check_page_permission(user_id, page_key, permission_type='view'):
    result = ...  # проверка
    
    # Логируем
    log_permission_check(
        user_id=user_id,
        page_key=page_key,
        permission_type=permission_type,
        result=result,
        timestamp=datetime.now()
    )
    
    return result
```

**Таблица для логов:**

```sql
CREATE TABLE Users.PermissionLogs (
    LogID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT,
    PageKey NVARCHAR(50),
    PermissionType NVARCHAR(10),
    Result BIT,
    CheckedAt DATETIME DEFAULT GETDATE()
);
```

---

### 4. Кеширование прав

**Frontend:** Кешировать результаты `hasPermission()` чтобы не вычислять каждый раз.

```tsx
const [permissionCache, setPermissionCache] = useState<Map<string, boolean>>(new Map());

const hasPermission = useCallback((pageKey: string, permissionType: 'view' | 'edit' = 'view'): boolean => {
  const cacheKey = `${pageKey}:${permissionType}`;
  
  // Проверяем кеш
  if (permissionCache.has(cacheKey)) {
    return permissionCache.get(cacheKey)!;
  }
  
  // Вычисляем
  const result = ... // логика проверки
  
  // Сохраняем в кеш
  setPermissionCache(prev => new Map(prev).set(cacheKey, result));
  
  return result;
}, [user, permissions, permissionCache]);
```

---

### 5. Unit тесты для проверки прав

**Backend (Python):**

```python
# tests/test_permissions.py

def test_admin_has_all_permissions():
    """Админ должен иметь все права"""
    result = check_page_permission(
        user_id=1,  # admin
        page_key='kpi',
        permission_type='view'
    )
    assert result == True

def test_user_without_permission_denied():
    """Пользователь без права не должен видеть скрытую страницу"""
    result = check_page_permission(
        user_id=4,  # Aikerim без прав на kpi
        page_key='kpi',
        permission_type='view'
    )
    assert result == False
```

**Frontend (TypeScript):**

```tsx
// __tests__/hasPermission.test.ts

import { renderHook } from '@testing-library/react-hooks';
import { useAuth } from '../context/AuthContext';

test('admin has all permissions', () => {
  const { result } = renderHook(() => useAuth(), {
    wrapper: ({ children }) => (
      <AuthProvider initialUser={{ is_admin: true, ... }}>
        {children}
      </AuthProvider>
    )
  });
  
  expect(result.current.hasPermission('kpi', 'view')).toBe(true);
});
```

---

## 📊 СИСТЕМА ЛОГИРОВАНИЯ И СТАТИСТИКИ

### Обзор

Реализована полная система аудита действий пользователей с автоматическим логированием и развернутой статистикой.

---

### Что логируется

| ActionType | Когда | Защита от дублей |
|------------|-------|------------------|
| `login` | Вход с паролем | Нет |
| `session_start` | Открытие с сохраненным токеном | < 30 секунд |
| `logout` | Выход из системы | Нет |
| `page_view` | Посещение страницы | < 30 сек для одной страницы |

---

### Backend API для логирования

**Файл:** `Back/Users/service/audit_service.py`

```python
def log_action(user_id, action_type, page_key=None, ip_address=None):
    """
    Универсальная функция логирования действий
    Автоматическая защита от дублирования
    """
    
def get_system_statistics():
    """
    Общая статистика системы:
    - Всего пользователей
    - Администраторов
    - Активных/неактивных
    - Новых за 7 дней
    - Онлайн сегодня
    - Топ-5 активных пользователей
    - Популярные страницы
    """
    
def get_user_statistics(user_id):
    """
    Статистика конкретного пользователя:
    - Общее количество входов
    - Последний вход
    - Самая посещаемая страница
    - Всего действий
    """
```

**API Endpoints:**

```python
# Логирование
POST /api/auth/session-start       # Начало сессии
POST /api/auth/log-page-view        # Посещение страницы

# Статистика
GET /api/admin/statistics           # Общая статистика
GET /api/admin/users/{id}/statistics # Статистика пользователя
GET /api/admin/users/{id}/activity   # Лог активности
```

---

### Frontend реализация

#### Автоматическое логирование

**AuthContext (`Front/src/context/AuthContext.tsx`):**
- При инициализации с существующим токеном → `session_start`
- При logout → `logout`

**usePageView (`Front/src/hooks/usePageView.ts`):**
Хук для логирования посещения страниц
```typescript
// Использование в компонентах:
const Production = () => {
  usePageView('production');
  // ...
};
```

**Страницы с логированием:**
- `home` - Главная
- `plan` - Планирование  
- `production` - Производство
- `orders` - Заказы
- `admin` - Администрирование
- `profile` - Профиль
- `kpi` - KPI (через RequirePermission)

---

### Админ-панель - Статистика

**Вкладка "Statistics" в `/admin`:**

**1. Панель метрик (6 карточек):**
- Total Users
- Administrators  
- Active
- Inactive
- New (7 days)
- Online Today

**2. Most Active Users (Last 7 Days):**
Таблица топ-5 пользователей с прогресс-барами активности

**3. Most Popular Pages (Last 30 Days):**
График популярности страниц с визуализацией

**4. All Users Activity:**
Детальная таблица всех пользователей:
- Username
- Full Name
- Status (Active/Inactive)
- Role (Admin/User)
- Last Login (с индикатором онлайн 🟢)
- Total Logins

---

### Карточка пользователя

В админ-панели при выборе пользователя показывается:
```
Администратор системы
@admin • Last login: 13.10.2025 14:30 • 52 logins
```

---

## 🎓 Заключение

### ✅ Что реализовано и работает:

#### Система авторизации и прав:
✅ JWT авторизация с токенами (24 часа)  
✅ Базовая система прав (просмотр скрытых страниц)  
✅ Проверка прав на Frontend и Backend  
✅ Роль администратора (IsAdmin)  
✅ Защита маршрутов через RequirePermission  

#### Управление пользователями:
✅ Страница профиля (/profile)  
✅ Изменение имени и пароля  
✅ Загрузка аватарок (PNG/JPG/GIF/WEBP → PNG 200x200, валидация, автоудаление старых)  
✅ Админка (/admin) для управления пользователями и правами  
✅ Назначение/снятие прав администратора  
✅ Смена паролей пользователей (администратором)  
✅ Поиск пользователей по Username  
✅ Группировка прав по категориям с аккордеонами  
✅ Компактный дизайн админ-панели  

#### Система пользовательских отчетов:
✅ Таблица Users.UserReports (SelectedFields, Filters, Grouping)  
✅ Backend API: `/api/orders/reports/*` (CRUD, execute)  
✅ Report Manager - модальное окно управления отчетами  
✅ Стандартные отчеты (видят все, редактируют админы/те у кого есть право)  
✅ Личные отчеты (видит только создатель)  
✅ Выбор полей с drag and drop сортировкой  
✅ Фильтры (множественные для одного поля, 12 операторов)  
✅ Группировки (GROUP BY + SUM/COUNT/AVG/MIN/MAX)  
✅ AG Grid таблица с оптимизацией для 10,000+ строк  
✅ Копирование диапазонов (Ctrl+C) с правильным форматом для Excel  

#### Текущие страницы с правами:
✅ **kpi** - скрытая страница (RequiresViewPermission=1)  
✅ **orders_orderlog_edit** - право редактировать стандартные отчеты (RequiresEditPermission=1)  
✅ **production_working_calendar_edit** - создание/редактирование графиков работы (RequiresEditPermission=1)  
✅ **production_timeloss_edit** - полные права на Time Loss (создание, редактирование всех полей, удаление)  
✅ **production_timeloss_limited_edit** - ограниченные права на Time Loss (редактирование только ActionPlan, Responsible, CompletedDate)

#### Логирование и статистика:
✅ Таблица Users.AuditLog для логирования всех действий  
✅ Автоматическое логирование: login, logout, session_start, page_view  
✅ Backend сервис audit_service.py с функциями статистики  
✅ API endpoints для получения статистики  
✅ Вкладка "Statistics" в админ-панели  
✅ Панель метрик (6 карточек с ключевыми показателями)  
✅ Топ активных пользователей за 7 дней  
✅ Популярные страницы за 30 дней  
✅ Детальная таблица активности всех пользователей  
✅ Защита от дублирования записей (30 секунд)

---

### 🔜 Что можно добавить в будущем:

#### Безопасность:
🔜 Защита всех Backend API через middleware `@require_auth`  
🔜 Хеширование паролей (bcrypt) вместо plain text  
🔜 Логирование действий пользователей (Users.AuditLog)  
🔜 2FA (двухфакторная аутентификация)  

#### Расширение прав:
🔜 Частичный доступ к данным (фильтрация по цехам/отделам/рынкам)  
🔜 Права на конкретные действия (add/edit/delete отдельно)  
🔜 Временные права (с датой истечения)  
🔜 Роли с предустановленными правами (вместо индивидуальных прав)  

#### Отчеты:
🔜 Расшаривание отчетов между пользователями  
🔜 Scheduled reports (автоматическая отправка по email)  
🔜 Экспорт отчетов в PDF  
🔜 Графики и визуализации в отчетах  

#### Тестирование:
🔜 Unit тесты для проверки прав  
🔜 Integration тесты для API  
🔜 E2E тесты для критичных сценариев  

---

### 📝 Принципы при расширении:

1. **Не ломайте текущую логику** - добавляйте новые поля/таблицы, не меняйте существующие
2. **Синхронизируйте Frontend и Backend** - список `restrictedPages` в AuthContext должен браться из API
3. **Тестируйте** - добавляйте тесты для новой логики прав
4. **Логируйте** - все проверки прав и изменения должны логироваться
5. **Документируйте** - обновляйте этот файл при добавлении новой логики
6. **Безопасность first** - всегда проверяйте права на Backend, Frontend проверка - только для UX

---

## 📊 Текущая статистика реализации:

### База данных:
- 5 таблиц в схеме Users ✅
- 105+ пользователей (2 admin, 4 реальных, 100+ тестовых) ✅
- 5 страниц с правами ✅

### Backend API:
- 30+ endpoints ✅
- Авторизация, профиль, админка, отчеты, статистика ✅
- Логирование всех действий пользователей ✅

### Frontend:
- 8+ новых страниц/компонентов ✅
- AuthContext, RequirePermission, usePageView ✅
- Report Manager (920 строк) ✅
- AdminPage с вкладками Users & Statistics ✅
- Переводы (en/zh/ru) ✅

### Production права:
- Working Calendar - полная защита ✅
- Time Loss - 3 уровня доступа (Viewer, Limited, Full) ✅
- Daily Plan-Fact - только просмотр ✅
- Order Tails - только просмотр ✅

---

**Последнее обновление:** 2025-10-13  
**Версия системы:** 3.0 (добавлены права Production, логирование, статистика)  
**Автор:** AI Assistant  

---

## 📊 СИСТЕМА ПОЛЬЗОВАТЕЛЬСКИХ ОТЧЕТОВ

### Обзор

Реализована полноценная система кастомных отчетов из VIEW `Orders.Orders_1C_Svod` с поддержкой:
- Выбора полей
- Фильтрации данных
- Группировок с агрегатными функциями
- Разграничения доступа (стандартные vs личные отчеты)

---

### Таблица `Users.UserReports`

```sql
CREATE TABLE Users.UserReports (
    ReportID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    ReportName NVARCHAR(100) NOT NULL,
    SourceTable NVARCHAR(100) NOT NULL,     -- 'Orders.Orders_1C_Svod'
    SelectedFields NVARCHAR(MAX),           -- JSON: ["Order_No", "Market", ...]
    Filters NVARCHAR(MAX),                  -- JSON: [{field, operator, value}, ...]
    Grouping NVARCHAR(MAX),                 -- JSON: {group_by: [...], aggregates: [...]}
    IsTemplate BIT DEFAULT 0,               -- 1 = стандартный (видят все)
    IsEditable BIT DEFAULT 1,               -- 1 = можно редактировать
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME,
    FOREIGN KEY (UserID) REFERENCES Users.Users(UserID) ON DELETE CASCADE
);
```

---

### Структура данных отчета

#### Пример отчета в БД:

```json
{
  "ReportID": 5,
  "ReportName": "Russia Orders > 1000",
  "SourceTable": "Orders.Orders_1C_Svod",
  "SelectedFields": ["Order_No", "Market", "Total_Order_QTY", "LargeGroup"],
  "Filters": [
    {"field": "Market", "operator": "equals", "value": "Russia"},
    {"field": "Total_Order_QTY", "operator": "greater_than", "value": "1000"}
  ],
  "Grouping": {
    "group_by": ["Market", "LargeGroup"],
    "aggregates": [
      {"field": "Total_Order_QTY", "function": "SUM", "alias": "Total_QTY"},
      {"field": "*", "function": "COUNT", "alias": "Order_Count"}
    ]
  }
}
```

#### SQL запрос который генерируется:

```sql
SELECT 
    [Market], 
    [LargeGroup],
    SUM([Total_Order_QTY]) AS [Total_QTY],
    COUNT(*) AS [Order_Count]
FROM Orders.Orders_1C_Svod
WHERE [Market] = N'Russia'
  AND [Total_Order_QTY] > 1000
GROUP BY [Market], [LargeGroup]
```

---

### Операторы фильтрации

| Оператор | SQL | Пример |
|----------|-----|--------|
| `equals` | `=` | Market = "China" |
| `not_equals` | `!=` | Market != "China" |
| `greater_than` | `>` | Total_Order_QTY > 100 |
| `less_than` | `<` | Total_Order_QTY < 1000 |
| `greater_or_equal` | `>=` | Total_Order_QTY >= 100 |
| `less_or_equal` | `<=` | Total_Order_QTY <= 1000 |
| `contains` | `LIKE '%value%'` | Order_No содержит "IZTT" |
| `not_contains` | `NOT LIKE '%value%'` | Order_No не содержит "R2360" |
| `starts_with` | `LIKE 'value%'` | Order_No начинается с "CSA-" |
| `ends_with` | `LIKE '%value'` | Order_No заканчивается на "试产单" |
| `is_null` | `IS NULL` | Comment пусто |
| `is_not_null` | `IS NOT NULL` | Comment не пусто |

---

### Агрегатные функции

| Функция | Описание | Пример |
|---------|----------|--------|
| `SUM` | Сумма значений | SUM(Total_Order_QTY) AS Total_Quantity |
| `COUNT` | Количество строк | COUNT(*) AS Order_Count |
| `AVG` | Среднее значение | AVG(Total_Order_QTY) AS Avg_Quantity |
| `MIN` | Минимум | MIN(Total_Order_QTY) AS Min_Quantity |
| `MAX` | Максимум | MAX(Total_Order_QTY) AS Max_Quantity |

---

### Backend API для отчетов

**Базовый URL:** `/api/orders/reports/`

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/list` | Список отчетов (стандартные + личные) |
| POST | `/create` | Создать личный отчет |
| GET | `/{id}` | Получить один отчет |
| PUT | `/{id}` | Обновить отчет |
| DELETE | `/{id}` | Удалить отчет |
| POST | `/{id}/execute` | Выполнить отчет (получить данные) |
| GET | `/fields` | Список доступных полей из VIEW |

---

### Frontend компоненты

#### Report Manager (`ReportManager.tsx`)
Модальное окно управления отчетами с 3 вкладками:
- **📋 Fields** - выбор и сортировка полей (drag and drop)
- **🔍 Filters** - настройка фильтров
- **📊 Grouping** - настройка группировок и агрегатов

#### OrdersLogTable (`OrdersLogTable.tsx`)
AG Grid таблица с оптимизациями:
- Виртуальный скроллинг (10,000+ строк)
- Выделение диапазонов
- Копирование в Excel (Ctrl+C)
- Форматирование чисел (с пробелом визуально, без пробела при копировании)
- Форматирование дат (DD.MM.YYYY)
- Status Bar с агрегацией (Sum, Avg, Count)

---

### Логика прав на отчеты

#### Стандартные отчеты (IsTemplate=1):
- **Просмотр:** Все пользователи ✅
- **Редактирование:** 
  - Администраторы (IsAdmin=1) ✅
  - Пользователи с правом `orders_orderlog_edit` (CanEdit=1) ✅
- **Удаление:** Только администраторы ✅

#### Личные отчеты (IsTemplate=0):
- **Просмотр:** Только создатель ✅
- **Редактирование:** Только создатель ✅
- **Удаление:** Только создатель ✅

---

### Примеры создания отчетов

#### Пример 1: Простой отчет

**Задача:** Показать все заказы для России

```json
{
  "report_name": "Russia Orders",
  "selected_fields": ["Order_No", "Market", "Total_Order_QTY"],
  "filters": [
    {"field": "Market", "operator": "equals", "value": "Russia"}
  ],
  "grouping": null
}
```

**SQL:**
```sql
SELECT [Order_No], [Market], [Total_Order_QTY]
FROM Orders.Orders_1C_Svod
WHERE [Market] = N'Russia'
```

---

#### Пример 2: Отчет с группировкой

**Задача:** Сумма заказов по группам продукции для России

```json
{
  "report_name": "Russia by Product Group",
  "selected_fields": ["LargeGroup", "Total_Order_QTY"],
  "filters": [
    {"field": "Market", "operator": "equals", "value": "Russia"}
  ],
  "grouping": {
    "group_by": ["LargeGroup"],
    "aggregates": [
      {"field": "Total_Order_QTY", "function": "SUM", "alias": "Total_QTY"},
      {"field": "*", "function": "COUNT", "alias": "Order_Count"}
    ]
  }
}
```

**SQL:**
```sql
SELECT 
    [LargeGroup],
    SUM([Total_Order_QTY]) AS [Total_QTY],
    COUNT(*) AS [Order_Count]
FROM Orders.Orders_1C_Svod
WHERE [Market] = N'Russia'
GROUP BY [LargeGroup]
```

---

#### Пример 3: Сложный отчет с множественными фильтрами

**Задача:** Заказы IZTT но не R2360, количество > 100

```json
{
  "report_name": "IZTT Orders (filtered)",
  "selected_fields": ["Order_No", "Total_Order_QTY", "Market"],
  "filters": [
    {"field": "Order_No", "operator": "contains", "value": "IZTT"},
    {"field": "Order_No", "operator": "not_contains", "value": "R2360"},
    {"field": "Total_Order_QTY", "operator": "greater_than", "value": "100"}
  ],
  "grouping": null
}
```

**SQL:**
```sql
SELECT [Order_No], [Total_Order_QTY], [Market]
FROM Orders.Orders_1C_Svod
WHERE [Order_No] LIKE N'%IZTT%'
  AND [Order_No] NOT LIKE N'%R2360%'
  AND [Total_Order_QTY] > 100
```

---

**Последнее обновление документации:** 2025-10-13  
**Версия системы:** 3.0 - Production Rights, Audit Log, Statistics Dashboard

## 🆕 Изменения в версии 3.0 (2025-10-13):

### Система прав Production:
- ✅ Working Calendar - защита создания/редактирования графиков
- ✅ Time Loss - 3 уровня доступа (Viewer, Limited, Full)
- ✅ Защита кнопок и полей ввода на основе прав

### Логирование и аудит:
- ✅ Таблица Users.AuditLog для всех действий
- ✅ Автоматическое логирование: login, logout, session_start, page_view
- ✅ Защита от дублирования (30 секунд)
- ✅ Сохранение IP адреса и User Agent

### Статистика:
- ✅ Вкладка Statistics в админ-панели
- ✅ 6 метрик (Total, Admins, Active, Inactive, New, Online)
- ✅ Топ активных пользователей (7 дней)
- ✅ Популярные страницы (30 дней)
- ✅ Детальная таблица активности всех пользователей
- ✅ Индикатор "онлайн сегодня" 🟢

### Улучшения админ-панели:
- ✅ Смена паролей пользователей
- ✅ Поиск пользователей (для работы с 100+ пользователями)
- ✅ Группировка прав по категориям (Production, Orders, KPI)
- ✅ Компактный дизайн правой панели
- ✅ Отображение статистики пользователя (last login, total logins)  

