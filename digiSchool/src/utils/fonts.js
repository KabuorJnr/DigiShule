// Ensures the report-card typeface (Poppins) is fully loaded before an
// html2canvas capture. Without this, a snapshot taken before the web font
// finishes downloading silently falls back to a system font, so the PDF and
// the on-screen card would use different fonts. Best-effort: resolves quietly
// if the Font Loading API is unavailable.
export async function ensureReportFontsLoaded() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('400 16px "Poppins"'),
      document.fonts.load('500 16px "Poppins"'),
      document.fonts.load('600 16px "Poppins"'),
      document.fonts.load('700 16px "Poppins"'),
      document.fonts.load('800 16px "Poppins"'),
    ]);
    await document.fonts.ready;
  } catch {
    /* Font Loading API not available — capture with whatever is ready. */
  }
}
