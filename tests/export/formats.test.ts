import { describe, it, expect } from 'vitest';
import { buildCsv } from '../../src/lib/export/csv';
import { buildXml } from '../../src/lib/export/xml';
import { buildXlsx } from '../../src/lib/export/xlsx';
import * as XLSX from 'xlsx';
import type { ExportSession } from '../../src/types';
const session: ExportSession = {
 schemaVersion: 1, participantId: '=1+1', scenario: 'synthetic',
 startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z',
 deviceInfo: { userAgent:'test', language:'en', timezone:'UTC' },
 answers:[{id:'q',type:'longText',question:'A, "quoted" question',answer:'line1\nline2 & <text> 🧪'}]
};
describe('export interoperability and preservation', () => {
 it('quotes CSV delimiters and neutralizes spreadsheet formula prefixes', () => {
  const csv=buildCsv(session);
  expect(csv).toContain("'=1+1,synthetic,q,\"A, \"\"quoted\"\" question\"");
  expect(csv).toContain('"line1\nline2 & <text> 🧪"');
  expect(csv.endsWith('\r\n')).toBe(true);
 });
 it('escapes XML markup while retaining Unicode and literal formula strings',()=>{
  const xml=buildXml(session);
  expect(xml).toContain('<participantId>=1+1</participantId>');
  expect(xml).toContain('line2 &amp; &lt;text&gt; 🧪');
 });
 it('refuses XML-invalid control characters instead of silently changing data',()=>{
  expect(()=>buildXml({...session,participantId:'id\u0000'})).toThrow('XML 1.0');
  expect(()=>buildXml({...session,participantId:'id\ud800'})).toThrow('XML 1.0');
 });
 it('round trips literal spreadsheet text without creating formulas',async()=>{
  const blob=await buildXlsx(session);
  const book=XLSX.read(await blob.arrayBuffer());
  expect(book.Sheets.Session.B3.v).toBe('=1+1');
  expect(book.Sheets.Session.B3.f).toBeUndefined();
  expect(book.Sheets.Answers.F2.v).toBe(session.answers[0].answer);
 });
});
