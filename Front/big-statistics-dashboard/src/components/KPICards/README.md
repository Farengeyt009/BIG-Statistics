# KPI Cards Components

## MetricCard

Универсальный компонент для отображения KPI метрик с изменением в процентах.

### Использование

```tsx
import { MetricCard } from '../../components/KPICards';

<MetricCard
  label="Month. Plan"
  value="50%"
  changePercent={1}
  isPositiveMetric={true}
/>
```

### Props

| Prop | Тип | Обязательный | Описание |
|------|-----|--------------|----------|
| `label` | `string` | ✅ | Заголовок метрики |
| `value` | `string` | ✅ | Значение метрики (например, "50%", "6.22k") |
| `rawValue` | `number` | ❌ | Числовое значение для всплывающей подсказки |
| `changePercent` | `number` | ✅ | Процент изменения (-10, 0, 5) |
| `isPositiveMetric` | `boolean` | ❌ | `true` если рост = хорошо (по умолчанию: `true`) |

### Особенности

- ✅ **Цветовая индикация**: Зеленый (хорошо), красный (плохо), оранжевый (без изменений)
- ✅ **Стрелки направления**: Показывают рост/падение/стабильность
- ✅ **Адаптивный дизайн**: Минимальная ширина 150px
- ✅ **Tooltip**: Показывает точное значение при наведении
- ✅ **Типизация**: Полная поддержка TypeScript

### Примеры

```tsx
// Положительная метрика (рост = хорошо)
<MetricCard
  label="Sales"
  value="6.22k"
  changePercent={15}
  isPositiveMetric={true}
/>

// Отрицательная метрика (падение = хорошо)
<MetricCard
  label="Time Loss"
  value="15%"
  changePercent={-5}
  isPositiveMetric={false}
/>

// Без изменений
<MetricCard
  label="Rework"
  value="0"
  changePercent={0}
/>
```

### Стили

Компонент использует Tailwind CSS классы:
- `text-green-700/bg-green-100` - для положительных изменений
- `text-red-700/bg-red-100` - для отрицательных изменений  
- `text-orange-600/bg-orange-100` - для нулевых изменений 