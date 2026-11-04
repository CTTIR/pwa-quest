import type { ExportSession } from '../../types';

function escapeXml(input: string): string {
  // XML 1.0 cannot represent these characters, even as numeric entities.
  // Refuse instead of silently dropping part of a participant response.
  if (/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u.test(input)) {
    throw new Error('A response contains a character XML 1.0 cannot represent. Use JSON or XLSX to preserve the response.');
  }
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function attr(name: string, value: string): string {
  return `${name}="${escapeXml(value)}"`;
}

export function buildXml(session: ExportSession): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<session ${attr('schemaVersion', String(session.schemaVersion))}>`);
  lines.push(`  <participantId>${escapeXml(session.participantId)}</participantId>`);
  lines.push(`  <scenario>${escapeXml(session.scenario)}</scenario>`);
  lines.push(`  <startedAt>${escapeXml(session.startedAt)}</startedAt>`);
  lines.push(`  <completedAt>${escapeXml(session.completedAt)}</completedAt>`);
  lines.push('  <deviceInfo>');
  lines.push(`    <userAgent>${escapeXml(session.deviceInfo.userAgent)}</userAgent>`);
  lines.push(`    <language>${escapeXml(session.deviceInfo.language)}</language>`);
  lines.push(`    <timezone>${escapeXml(session.deviceInfo.timezone)}</timezone>`);
  lines.push('  </deviceInfo>');
  lines.push('  <answers>');
  for (const a of session.answers) {
    const open = `<answer ${attr('id', a.id)} ${attr('type', a.type)}>`;
    lines.push(`    ${open}`);
    lines.push(`      <question>${escapeXml(a.question)}</question>`);
    if (Array.isArray(a.answer)) {
      lines.push('      <value>');
      for (const item of a.answer) {
        lines.push(`        <item>${escapeXml(String(item))}</item>`);
      }
      lines.push('      </value>');
    } else if (a.answer === null || a.answer === undefined) {
      lines.push('      <value/>');
    } else {
      lines.push(`      <value>${escapeXml(String(a.answer))}</value>`);
    }
    lines.push('    </answer>');
  }
  lines.push('  </answers>');
  lines.push('</session>');
  return lines.join('\n') + '\n';
}
