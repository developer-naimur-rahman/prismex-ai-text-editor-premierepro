/**
 * Universal rock-solid clipboard copy for Adobe CEP & web browsers.
 * Combines:
 * 1. Synchronous document.execCommand('copy') with hidden textarea (CEF guaranteed)
 * 2. Modern navigator.clipboard.writeText
 * 3. Adobe CEP Node.js pbcopy (if available in window.require)
 * 4. Local daemon macOS pbcopy (/api/v1/system/clipboard)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  let copied = false;

  // 1. Standard CEF / Browser execCommand fallback (Synchronous in user click handler)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0.01';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (success) {
      copied = true;
    }
  } catch (e) {
    // Continue to next fallback
  }

  // 2. Modern Clipboard API
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (e) {
      // Ignored - fallback handles it
    }
  }

  // 3. CEP Node.js child_process pbcopy
  try {
    if (typeof window !== 'undefined' && (window as any).require) {
      const cp = (window as any).require('child_process');
      if (cp && cp.spawn) {
        const proc = cp.spawn('pbcopy');
        proc.stdin.write(text);
        proc.stdin.end();
        copied = true;
      }
    }
  } catch (e) {}

  // 4. Local Prismex Daemon macOS pbcopy
  try {
    fetch('http://127.0.0.1:49152/api/v1/system/clipboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    }).catch(() => {});
  } catch (e) {}

  return copied;
}
