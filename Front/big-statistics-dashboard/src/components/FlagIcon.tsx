import React from "react";

type Market =
  | "Russia"
  | "CIS"
  | "Eastern Europe"
  | "OEM"
  | "Direct Sales"
  | "TC"
  | "Не указан"
  | string;

// Универсальная рамка 16x16, чтобы всё выглядело одинаково.
// Внутрь кладём "контент" иконки как <g />.
const IconFrame = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 16 16"
    role="img"
    aria-label={label}
    style={{ flexShrink: 0 }}
  >
    {/* Фон и рамка иконки */}
    <rect
      x={0.5}
      y={0.5}
      width={15}
      height={15}
      rx={2}
      fill="#ffffff"
      stroke="#CBD5E1" // нейтрально-серый бордер (tailwind slate-300)
      strokeWidth={1}
    />
    {children}
  </svg>
);

// Флаг России: три горизонтальные полосы
const RussiaFlag = () => (
  <IconFrame label="Russia">
    {/* сам флаг вписываем в прямоугольник 14x10 внутри рамки */}
    <g transform="translate(1 3)">
      {/* белая полоса */}
      <rect x={0} y={0} width={14} height={10} fill="#ffffff" />
      {/* синяя полоса */}
      <rect x={0} y={3.33} width={14} height={3.34} fill="#0039a6" />
      {/* красная полоса */}
      <rect x={0} y={6.66} width={14} height={3.34} fill="#d52b1e" />
      {/* контур флага */}
      <rect
        x={0}
        y={0}
        width={14}
        height={10}
        fill="none"
        stroke="#0f172a"
        strokeWidth={0.5}
        rx={1}
      />
    </g>
  </IconFrame>
);

// Флаг СНГ (CIS): синий фон + эмблема
const CISFlag = () => (
  <IconFrame label="CIS">
    <g transform="translate(1 3)">
      {/* фон флага */}
      <rect x={0} y={0} width={14} height={10} fill="#0073cf" rx={1} />
      {/* жёлтый круг в центре */}
      <circle cx={7} cy={5} r={1.4} fill="#ffcc00" />
      {/* белая стилизованная "лапка" СНГ */}
      <path
        d="
          M7 2
          C5.5 2,4.5 3,4.5 4
          C4.5 5,5.5 6,7 6
          C8.5 6,9.5 5,9.5 4
          C9.5 3,8.5 2,7 2
          Z
        "
        fill="none"
        stroke="#ffffff"
        strokeWidth={0.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* контур флага */}
      <rect
        x={0}
        y={0}
        width={14}
        height={10}
        fill="none"
        stroke="#0f172a"
        strokeWidth={0.5}
        rx={1}
      />
    </g>
  </IconFrame>
);

// Eastern Europe: условно "ЕС" — тёмно-синий фон + звёзды по кругу.
const EasternEuropeFlag = () => {
  // координаты 12 точек по кругу
  const stars = Array.from({ length: 12 }).map((_, i) => {
    const angle = (i / 12) * 2 * Math.PI;
    const cx = 7 + Math.cos(angle) * 3.2;
    const cy = 5 + Math.sin(angle) * 3.2;
    return <circle key={i} cx={cx} cy={cy} r={0.5} fill="#FFD700" />;
  });

  return (
    <IconFrame label="Eastern Europe">
      <g transform="translate(1 3)">
        <rect x={0} y={0} width={14} height={10} fill="#003399" rx={1} />
        {stars}
        {/* контур */}
        <rect
          x={0}
          y={0}
          width={14}
          height={10}
          fill="none"
          stroke="#0f172a"
          strokeWidth={0.5}
          rx={1}
        />
      </g>
    </IconFrame>
  );
};

// OEM: сделаем иконку документа/контракта в сером, без текста
const OEMIcon = () => (
  <IconFrame label="OEM">
    <g>
      {/* серый "документ" по центру */}
      <rect
        x={4}
        y={4}
        width={8}
        height={8}
        rx={1}
        fill="#6B7280"
        stroke="#374151"
        strokeWidth={0.7}
      />
      {/* две белые линии внутри документа */}
      <rect x={5.5} y={6} width={5} height={1} fill="#ffffff" />
      <rect x={5.5} y={8} width={5} height={1} fill="#ffffff" />
      {/* "отверстие под шильдик" сверху документа */}
      <circle cx={8} cy={4} r={1} fill="#6B7280" stroke="#374151" strokeWidth={0.7} />
    </g>
  </IconFrame>
);

// Direct Sales: логотип "big>"
const DirectSalesIcon = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 16 16"
    role="img"
    aria-label="big>"
    style={{ flexShrink: 0, display: "block" }}
  >
    {/* Группа чуть смещена внутрь, чтобы текст не прилипал к верхнему/левому краю */}
    <g transform="translate(1 2)">
      {/* "big" чёрным */}
      <text
        x={0}
        y={9} // базовая линия текста; подбираем визуально
        fontFamily="Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        fontSize={7}
        fontWeight={500}
        fill="#000000"
      >
        big
      </text>

      {/* синяя стрелка ">" чуть крупнее и толще визуально */}
      <text
        x={11} // сдвигаем вправо
        y={9}
        fontFamily="Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        fontSize={7}
        fontWeight={600}
        fill="#0094ff"
      >
        {`>`}
      </text>
    </g>
  </svg>
);

// TC: условно "quality/star badge"
// Белый контур звезды на синем круге.
const TCIcon = () => (
  <IconFrame label="TC">
    <g>
      {/* синий круг */}
      <circle
        cx={8}
        cy={8}
        r={5.5}
        fill="#3B82F6"
        stroke="#1E40AF"
        strokeWidth={0.7}
      />
      {/* звезда */}
      <path
        d="
          M8 4.5
          L9.2 6.9
          L11.9 7.1
          L9.9 8.8
          L10.5 11.3
          L8 10.1
          L5.5 11.3
          L6.1 8.8
          L4.1 7.1
          L6.8 6.9
          Z
        "
        fill="#ffffff"
      />
    </g>
  </IconFrame>
);

// Не указан: оранжевый бейдж с вопросом.
const NotSpecifiedIcon = () => (
  <IconFrame label="Не указан">
    <g>
      {/* оранжевый круг */}
      <circle
        cx={8}
        cy={8}
        r={5.5}
        fill="#F59E0B"
        stroke="#C2410C"
        strokeWidth={0.7}
      />
      {/* вопросительный знак */}
      <path
        d="
          M8 5
          C8 4,6.8 4,6.8 5
          C6.8 5.7,7.5 5.8,7.9 6
          C8.5 6.3,8.9 6.6,8.9 7.3
          C8.9 8.2,8.2 8.6,7.5 8.6
          L7.5 9.4
          L8.5 9.4
          L8.5 8.9
          C9.6 8.6,10.1 7.8,10.1 7
          C10.1 5.5,8.9 5,8 5
          Z
        "
        fill="#ffffff"
      />
      {/* точка вопроса */}
      <circle cx={8} cy={10.5} r={0.7} fill="#ffffff" />
    </g>
  </IconFrame>
);

// fallback: зелёный глобус, без эмодзи-текста
const DefaultIcon = ({ label }: { label: string }) => (
  <IconFrame label={label}>
    {/* зелёный круг */}
    <circle
      cx={8}
      cy={8}
      r={5.5}
      fill="#4ADE80"
      stroke="#16A34A"
      strokeWidth={0.7}
    />
    {/* упрощённый меридиан/параллели */}
    <circle cx={8} cy={8} r={3.5} fill="none" stroke="#ffffff" strokeWidth={0.6} />
    <path
      d="M8 4.5 L8 11.5 M4.5 8 L11.5 8"
      stroke="#ffffff"
      strokeWidth={0.6}
      strokeLinecap="round"
    />
  </IconFrame>
);

export const FlagIcon = ({ market }: { market: Market }) => {
  switch (market) {
    case "Russia":
      return <RussiaFlag />;
    case "CIS":
      return <CISFlag />;
    case "Eastern Europe":
      return <EasternEuropeFlag />;
    case "OEM":
      return <OEMIcon />;
    case "Direct Sales":
      return <DirectSalesIcon />;
    case "TC":
      return <TCIcon />;
    case "Не указан":
      return <NotSpecifiedIcon />;
    default:
      return <DefaultIcon label={market || "Unknown"} />;
  }
};
