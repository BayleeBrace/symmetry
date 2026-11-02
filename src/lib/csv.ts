/**
 * One spreadsheet cell, quoted. A value that starts like a formula (= + - @,
 * a tab or a carriage return) gets a leading apostrophe first, so a name or a
 * note typed by a customer cannot run as a formula when the file is opened.
 */
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
