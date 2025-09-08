import { ModuleRegistry } from '@ag-grid-community/core';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { SetFilterModule } from '@ag-grid-enterprise/set-filter';
import { RangeSelectionModule } from '@ag-grid-enterprise/range-selection';
import { ClipboardModule } from '@ag-grid-enterprise/clipboard';
import { RichSelectModule } from '@ag-grid-enterprise/rich-select';
import { StatusBarModule } from '@ag-grid-enterprise/status-bar';

// Явная регистрация только нужных Enterprise‑модулей
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  SetFilterModule,
  RangeSelectionModule,
  ClipboardModule,
  RichSelectModule,
  StatusBarModule,
]);

// Опциональная установка ключа лицензии из env (если задан) или fallback
const envLicenseKey = (import.meta as any)?.env?.VITE_AG_GRID_LICENSE_KEY as string | undefined;
const fallbackLicenseKey = 'MANTOU_COM_NDEzOTQzOTU2OTEyNA==0b01e168f061c5bce9cfed3bd68f4f9f';
const runtimeLicenseKey = envLicenseKey || fallbackLicenseKey;

if (runtimeLicenseKey) {
  import('@ag-grid-enterprise/core').then(mod => {
    try {
      (mod as any).LicenseManager?.setLicenseKey?.(runtimeLicenseKey);
    } catch {}
  }).catch(() => {});
}
