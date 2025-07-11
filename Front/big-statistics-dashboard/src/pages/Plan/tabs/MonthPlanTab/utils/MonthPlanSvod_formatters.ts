export const dashIfZero = (val: number | string | null | undefined) =>
  !val || Number(val) === 0 ? '–' : val;

export const percentFmt = (val: number | string | null | undefined) =>
  !val || Number(val) === 0
    ? '–'
    : `${Number(val).toFixed(1).replace(/\.0$/, '')}%`;

export const numberWithSpaces = (val: number | string | null | undefined) =>
  val === null || val === undefined || val === '' || Number(val) === 0
    ? '–'
    : Number(val).toLocaleString('ru-RU'); 