const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\s-]?){9,14}\d/g;
const API_KEY_PATTERN = /\b(?:sk|pk|api|key|token)[_-]?[A-Za-z0-9]{16,}\b/gi;

export function redactPreview(value: string, maxLength = 500): string {
  return value
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_PATTERN, "[redacted-phone]")
    .replace(API_KEY_PATTERN, "[redacted-secret]")
    .slice(0, maxLength);
}
