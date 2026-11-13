/**
 * Universal rock-solid clipboard copy for Adobe CEP & web browsers.
 * Combines:
 * 1. Modern navigator.clipboard.writeText
 * 2. Synchronous document.execCommand('copy') with unconstrained textarea
 * 3. Adobe CEP Node.js pbcopy (if available in window.require)
 * 4. Local daemon macOS pbcopy (/api/v1/system/clipboard) with full OS permissions
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  let copied = false;

  // 1. Modern Clipboard API
  if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (e) {
      // Ignored - fallbacks handle it
    }
  }

  // 2. Standard CEF / Browser execCommand fallback
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (success) {
      copied = true;
    }
  } catch (e) {}

  // 3. CEP Node.js child_process pbcopy / clip
  try {
    if (typeof window !== 'undefined' && (window as any).require) {
      const cp = (window as any).require('child_process');
      if (cp && typeof cp.spawn === 'function') {
        const isWin = typeof process !== 'undefined' && process.platform === 'win32';
        const proc = cp.spawn(isWin ? 'clip' : '/usr/bin/pbcopy');
        proc.stdin.write(text);
        proc.stdin.end();
        copied = true;
      }
    }
  } catch (e) {}

  // 4. Local Prismex Companion Daemon OS clipboard (macOS pbcopy / Windows clip)
  try {
    const res = await fetch('http://127.0.0.1:49152/api/v1/system/clipboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (res.ok) {
      copied = true;
    }
  } catch (e) {}

  return copied;
}
