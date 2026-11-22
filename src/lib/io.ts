import type { ProgramProfile, Row } from '../types';

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

export function parseCourseCsv(text: string, fileName: string): ProgramProfile {
  const table = parseCsvRows(text);
  if (table.length < 2) throw new Error('CSV至少需要表头和一行课程记录。');
  const headers = table[0].map(value => value.trim());
  const indexOf = (aliases: string[]) => headers.findIndex(header => aliases.includes(header));
  const nameIndex = indexOf(['课名', '课程名', '课程名称']);
  const hoursIndex = indexOf(['学时', 'hours', 'hours_num']);
  const creditsIndex = indexOf(['学分', 'credits', 'credit_num']);
  if (nameIndex < 0 || hoursIndex < 0 || creditsIndex < 0) throw new Error('缺少必需列：课名、学时、学分。');
  const idIndex = indexOf(['课程ID', '课程号']);
  const semesterIndex = indexOf(['开课学期', '学期']);
  const typeIndex = indexOf(['课程性质', '课程类别']);
  const skillIndex = indexOf(['技能标准名', '覆盖技能', '技能']);
  const mappingStatusIndex = indexOf(['映射状态', '供给确认']);
  const replacementIndex = indexOf(['置换资格', '可置换标记']);
  const majorIndex = indexOf(['所属专业/方向', '专业名称']);
  const prerequisiteIndex = indexOf(['先修', '先修课程']);
  const categoryIndex = indexOf(['课程分类', '课程类别', 'course_cat_norm']);
  const courseTypeIndex = indexOf(['课程类型', 'course_type_norm']);
  const majorName = majorIndex >= 0 ? table[1][majorIndex]?.trim() : '';
  const programName = majorName || fileName.replace(/\.(csv|CSV)$/, '');
  const courses: Row[] = table.slice(1).map((values, index) => {
    const name = values[nameIndex]?.trim();
    const hours = Number(values[hoursIndex]);
    const credits = Number(values[creditsIndex]);
    if (!name || !Number.isFinite(hours) || hours <= 0 || !Number.isFinite(credits) || credits < 0) throw new Error(`第${index + 2}行课程名、学时或学分无效。`);
    return {
      课程ID: idIndex >= 0 ? values[idIndex]?.trim() || `LOCAL-${index + 1}` : `LOCAL-${index + 1}`,
      课名: name, 学分: credits, 学时: hours,
      开课学期: semesterIndex >= 0 ? values[semesterIndex]?.trim() || '未分配' : '未分配',
      课程性质: typeIndex >= 0 ? values[typeIndex]?.trim() || '' : '',
      先修: prerequisiteIndex >= 0 ? values[prerequisiteIndex]?.trim() || '' : '', '所属专业/方向': programName,
      course_cat_norm: categoryIndex >= 0 ? values[categoryIndex]?.trim() || '' : '',
      course_type_norm: courseTypeIndex >= 0 ? values[courseTypeIndex]?.trim() || '' : '',
      技能标准名: skillIndex >= 0 ? values[skillIndex]?.trim() || '' : '',
      映射状态: mappingStatusIndex >= 0 ? values[mappingStatusIndex]?.trim() || '' : '',
      置换资格: replacementIndex >= 0 ? values[replacementIndex]?.trim() || '' : '',
    };
  });
  const ids = courses.map(row => String(row['课程ID']));
  if (new Set(ids).size !== ids.length) throw new Error('课程ID存在重复，请先修正。');
  const coverageMap = new Map<string, number>();
  for (const row of courses) for (const skill of String(row['技能标准名']).split(/[、;；]/).map(value => value.trim()).filter(Boolean)) coverageMap.set(skill, (coverageMap.get(skill) ?? 0) + Number(row['学时']));
  const coverage = [...coverageMap.entries()].map(([skill, hours]) => ({ 专业: programName, 技能标准ID: `LOCAL-${skill}`, 技能标准名: skill, 核心供给学时: hours, 核心课程门数: courses.filter(row => String(row['技能标准名']).split(/[、;；]/).includes(skill)).length }));
  const semesters = [...new Set(courses.map(row => String(row['开课学期'])))];
  const semesterLoads = semesters.map(semester => ({ semester, hours: courses.filter(row => String(row['开课学期']) === semester).reduce((sum, row) => sum + Number(row['学时']), 0) }));
  const hasCourseTypes = courses.every(row => ['必修', '选修'].includes(String(row['课程性质'])));
  const mappedCourses = courses.filter(row => String(row['技能标准名']).trim()).length;
  const confirmedZeroCourses = courses.filter(row => row['映射状态'] === '已确认无映射').length;
  const hasCompleteSemesters = courses.every(row => String(row['开课学期']).trim() && row['开课学期'] !== '未分配');
  return {
    id: `local-${Date.now()}`, name: programName, shortName: programName,
    basis: `本地导入课程底表 · ${courses.length}门 · 尚未外部核验`,
    courseCount: courses.length,
    totalHours: courses.reduce((sum, row) => sum + Number(row['学时']), 0),
    totalCredits: Number(courses.reduce((sum, row) => sum + Number(row['学分']), 0).toFixed(2)),
    requiredHours: hasCourseTypes ? courses.filter(row => row['课程性质'] === '必修').reduce((sum, row) => sum + Number(row['学时']), 0) : null,
    semesterCap: Math.max(...semesterLoads.map(row => row.hours)),
    semesterLoads, courses, coverage,
    sourceFile: `本地导入/${fileName}`,
    dataQuality: {
      mappedCourses, confirmedZeroCourses, pendingMappingCourses: courses.length - mappedCourses - confirmedZeroCourses,
      hasCompleteSemesters, hasCourseTypes,
      approvedReplacementCourses: courses.filter(row => row['置换资格'] === '可置换').length,
      prerequisiteCourses: courses.filter(row => String(row['先修']).trim()).length,
      classifiedCredits: Number(courses.filter(row => String(row['course_cat_norm']).trim()).reduce((sum, row) => sum + Number(row['学分']), 0).toFixed(2)),
    },
  };
}

export function downloadCourseTemplate() {
  const csv = '\uFEFF课程ID,课名,学分,学时,开课学期,课程性质,技能标准名,映射状态,置换资格,先修,课程分类,课程类型,专业名称\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = '产教智对_专业课程底表模板.csv'; link.click(); URL.revokeObjectURL(url);
}
