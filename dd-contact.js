/*
 * D&D HOMEINVEST – odesílání kontaktního formuláře na Cloudflare Pages.
 *
 * Skript se načítá na úvodní stránce (index.html) a napojí formulář #kontakt
 * na endpoint /api/contact (Cloudflare Pages Function, ukládání do D1).
 * Je to statický soubor, aby formulář fungoval i bez jakýchkoli serverových zásahů do HTML.
 */
(() => {
  const init = () => {
    const form = document.querySelector('#kontakt form');
    if (!form || form.dataset.ddBound === '1') return;
    form.dataset.ddBound = '1';

    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;

    const status = document.createElement('div');
    status.style.marginTop = '12px';
    status.style.fontSize = '14px';
    status.style.lineHeight = '1.5';
    form.appendChild(status);

    const setStatus = (text, color) => {
      status.textContent = text || '';
      status.style.color = color || '#9a9590';
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const payload = Object.fromEntries(new FormData(form).entries());
      submitButton.disabled = true;
      const originalText = submitButton.textContent;
      submitButton.textContent = 'Odesílám…';
      setStatus('Odesílám zprávu…', '#c9a84c');

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Zprávu se nepodařilo odeslat.');
        form.reset();
        setStatus(data.message || 'Děkujeme, zpráva byla odeslána.', '#10b981');
      } catch (error) {
        setStatus(error.message || 'Zprávu se nepodařilo odeslat.', '#ef4444');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }, true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
