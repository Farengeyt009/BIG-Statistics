export function installClipboardPolyfill(): void {
  try {
    const hasClipboard = typeof navigator !== 'undefined' && 'clipboard' in navigator;
    const isSecure = typeof window !== 'undefined' && window.isSecureContext === true;

    if (!hasClipboard || !isSecure) {
      const writeText = (text: string): Promise<void> =>
        new Promise<void>((resolve, reject) => {
          try {
            const ta = document.createElement('textarea');
            ta.value = String(text ?? '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            ok ? resolve() : reject(new Error('execCommand copy failed'));
          } catch (e) {
            reject(e as Error);
          }
        });

      try {
        Object.defineProperty(navigator as any, 'clipboard', {
          configurable: true,
          value: { writeText },
        });
      } catch {
        try {
          (navigator as any).clipboard = { writeText };
        } catch {}
      }
    }
  } catch {}
}


