import type { ExportSession } from '../../types';
import { answerToCellString } from '../buildSession';

// CSV per RFC 4180-ish: quote when the field contains a comma, quote, CR, or
// LF, and escape embedded quotes by doubling them.
function csvField(input: string): string {
  // Treat spreadsheet formula prefixes as text. XML/QR preserve exact strings.
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(input)) input = "'" + input;
  if (/[",\r\n]/.test(input)) {
    return `"${input.replace(/"/g, '""')}"`;
  }
  return input;
}

const HEADERS = [
  'participantId',
  'scenario',
  'questionId',
  'questionText',
  'answerType',
  'answerValue',
] as const;

export function buildCsv(session: ExportSession): string {
  const lines: string[] = [HEADERS.join(',')];
  for (const a of session.answers) {
    lines.push(
      [
        session.participantId,
        session.scenario,
        a.id,
        a.question,
        a.type,
        answerToCellString(a.answer),
      ]
        .map((v) => csvField(String(v)))
        .join(','),
    );
  }
  // CRLF line endings per RFC 4180; many tools accept either, but Excel on
  // Windows prefers CRLF.
  return lines.join('\r\n') + '\r\n';
}
