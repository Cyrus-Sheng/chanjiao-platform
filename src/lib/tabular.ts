import * as XLSX from 'xlsx';
import { parseCourseCsv } from './io';

export async function parseCourseFile(file: File) {
  if (/\.csv$/i.test(file.name)) return parseCourseCsv(await file.text(), file.name);
  if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error('仅支持 .csv、.xlsx、.xls 文件。');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const first = workbook.Sheets[workbook.SheetNames[0]];
  if (!first) throw new Error('Excel中没有可读取的工作表。');
  return parseCourseCsv(XLSX.utils.sheet_to_csv(first), file.name);
}

function numberValue(value: unknown, label: string) {
  const raw = String(value ?? '').replaceAll(',', '').replaceAll('%', '').trim();
  const number = Number(raw);
  if (!Number.isFinite(number)) throw new Error(`${label}不是有效数值：${raw || '空值'}`);
  return number;
}

export async function parseTrendFile(file: File) {
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error('检验数据仅支持 .csv、.xlsx、.xls 文件。');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['检验数据'] ?? workbook.Sheets[workbook.SheetNames[0]], { defval: null, raw: false }) as Record<string, unknown>[];
  if (!rows.length) throw new Error('检验数据文件没有记录。');
  return rows.map((row, index) => {
    const region = String(row['region'] ?? row['区域'] ?? '').trim();
    if (!region) throw new Error(`第${index + 2}行缺少区域名称。`);
    const p0 = numberValue(row['p0'] ?? row['2016—2018提及率'] ?? row['2016-2018提及率'], `${region}早期提及率`);
    const p1 = numberValue(row['p1'] ?? row['2023—2025提及率'] ?? row['2023-2025提及率'], `${region}近期提及率`);
    const n0 = numberValue(row['n0'] ?? row['N0'] ?? row['早期样本量'], `${region}早期样本量`);
    const n1 = numberValue(row['n1'] ?? row['N1'] ?? row['近期样本量'], `${region}近期样本量`);
    const earlyRate = p0 > 1 ? p0 / 100 : p0;
    const recentRate = p1 > 1 ? p1 / 100 : p1;
    if (earlyRate < 0 || earlyRate > 1 || recentRate < 0 || recentRate > 1) throw new Error(`${region}提及率必须在0—1或0%—100%之间。`);
    if (n0 <= 0 || n1 <= 0 || !Number.isInteger(n0) || !Number.isInteger(n1)) throw new Error(`${region}两期样本量必须为正整数。`);
    const x0 = Math.round(earlyRate * n0);
    const x1 = Math.round(recentRate * n1);
    if (Math.min(x0, n0 - x0, x1, n1 - x1) < 5) throw new Error(`${region}两期期望频数不足5，不满足z检验近似前提。`);
    return { region, p0: earlyRate, p1: recentRate, n0, n1 };
  });
}

export function downloadTrendTemplate() {
  const content = '\uFEFFregion,p0,p1,n0,n1\n';
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = '两期比例检验数据模板.csv'; link.click(); URL.revokeObjectURL(url);
}
