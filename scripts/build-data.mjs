import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const ROOT = 'C:/Users/陈吴晟/Desktop/基础数据';
const POLICY = path.join(ROOT, '政策端');
const COURSE = path.join(ROOT, '课程端');
const OUT = path.join(process.cwd(), 'src/data/platform.json');
const sources = [];

function readTable(file) {
  if (!fs.existsSync(file)) throw new Error(`源文件不存在：${file}`);
  const input = file.toLowerCase().endsWith('.csv')
    ? fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    : fs.readFileSync(file);
  const book = XLSX.read(input, { type: typeof input === 'string' ? 'string' : 'buffer' });
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
  sources.push({ file: file.replaceAll('\\', '/'), rows: rows.length, sample: rows.slice(0, 5) });
  return rows;
}

function readWorkbook(file) {
  if (!fs.existsSync(file)) throw new Error(`源文件不存在：${file}`);
  const book = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
  const sheets = Object.fromEntries(book.SheetNames.map(name => [name, XLSX.utils.sheet_to_json(book.Sheets[name], { defval: null, raw: false })]));
  sources.push({ file: file.replaceAll('\\', '/'), rows: Object.values(sheets).reduce((n, rows) => n + rows.length, 0), sheets: book.SheetNames, sample: Object.values(sheets)[0]?.slice(0, 5) ?? [] });
  return sheets;
}

const courseRoot = path.join(COURSE, '课程端数据治理/产出');
const courses = readTable(path.join(courseRoot, 'course_pool.csv'));
const mappings = readTable(path.join(courseRoot, 'course_skill_map.csv'));
const reverseGaps = readTable(path.join(courseRoot, '反向缺口_有需求无供给技能.csv'));
const zeroCourses = readTable(path.join(courseRoot, '双零命中_课程清单.csv'));
const doubleZeroSkills = readTable(path.join(courseRoot, '双零命中_有供给无需求技能.csv'));
const skillDict = readTable(path.join(courseRoot, 'skill_dict.csv'));
const cufeCourses = readTable(path.join(COURSE, '中财经济学_交付包/5_course_base_中财经济学.csv'));
const cufeCoverage = readTable(path.join(COURSE, '中财经济学_交付包/7_major_skill_coverage_中财经济学.csv'));
const programSpecs = [
  { id: 'cufe-econ', name: '中央财经大学 · 经济学', shortName: '中财经济学', basis: '完整培养方案（63门）', folder: '中财经济学_交付包', base: '5_course_base_中财经济学.csv', coverage: '7_major_skill_coverage_中财经济学.csv', semesterCap: 551 },
  { id: 'buaa-cs', name: '北京航空航天大学 · 计算机学院', shortName: '北航计算机', basis: '2026秋季学院课程池快照', folder: '北航计算机_交付包', base: '5_course_base_计算机学院.csv', coverage: '7_major_skill_coverage_计算机学院.csv' },
  { id: 'buaa-math', name: '北京航空航天大学 · 数学科学学院', shortName: '北航数学', basis: '2026秋季学院课程池快照', folder: '北航数学_交付包', base: '5_course_base_数学科学学院.csv', coverage: '7_major_skill_coverage_数学科学学院.csv' },
  { id: 'buaa-mech', name: '北京航空航天大学 · 机械工程及自动化学院', shortName: '北航机械', basis: '2026秋季学院课程池快照', folder: '北航机械_交付包', base: '5_course_base_机械工程及自动化学院.csv', coverage: '7_major_skill_coverage_机械工程及自动化学院.csv' },
];
const programProfiles = programSpecs.map(spec => {
  const sourceCourses = spec.id === 'cufe-econ' ? cufeCourses : readTable(path.join(COURSE, spec.folder, spec.base));
  const profileCourses = sourceCourses.map(row => {
    const enriched = courses.find(item => String(item['课程号']) === String(row['课程ID']));
    const skills = [...new Set(mappings.filter(item => String(item['课程号']) === String(row['课程ID'])).map(item => String(item['技能标准名'])))] .join('、');
    return { ...row, ...(enriched ? { course_cat_norm: enriched['course_cat_norm'], course_type_norm: enriched['course_type_norm'] } : {}), 技能标准名: skills };
  });
  const coverage = spec.id === 'cufe-econ' ? cufeCoverage : readTable(path.join(COURSE, spec.folder, spec.coverage));
  const semesters = [...new Set(profileCourses.map(row => String(row['开课学期'])))];
  const semesterLoads = semesters.map(semester => ({ semester, hours: profileCourses.filter(row => String(row['开课学期']) === semester).reduce((sum, row) => sum + Number(row['学时'] || 0), 0) }));
  const courseIds = new Set(profileCourses.map(row => String(row['课程ID'])));
  const mappedCourses = new Set(mappings.filter(row => courseIds.has(String(row['课程号']))).map(row => String(row['课程号']))).size;
  return {
    id: spec.id, name: spec.name, shortName: spec.shortName, basis: spec.basis,
    courseCount: profileCourses.length,
    totalHours: profileCourses.reduce((sum, row) => sum + Number(row['学时'] || 0), 0),
    totalCredits: Number(profileCourses.reduce((sum, row) => sum + Number(row['学分'] || 0), 0).toFixed(2)),
    requiredHours: spec.id === 'cufe-econ' ? profileCourses.filter(row => row['课程性质'] === '必修').reduce((sum, row) => sum + Number(row['学时'] || 0), 0) : null,
    semesterCap: spec.semesterCap ?? Math.max(...semesterLoads.map(row => row.hours)),
    semesterLoads, courses: profileCourses, coverage,
    sourceFile: `课程端/${spec.folder}/${spec.base}`,
    dataQuality: {
      mappedCourses, confirmedZeroCourses: 0, pendingMappingCourses: profileCourses.length - mappedCourses,
      hasCompleteSemesters: spec.id === 'cufe-econ', hasCourseTypes: spec.id === 'cufe-econ', approvedReplacementCourses: 0,
      prerequisiteCourses: profileCourses.filter(row => String(row['先修'] ?? '').trim()).length,
      classifiedCredits: Number(profileCourses.filter(row => String(row['course_cat_norm'] ?? '').trim()).reduce((sum, row) => sum + Number(row['学分'] || 0), 0).toFixed(2)),
    },
  };
});
const top30 = readTable(path.join(ROOT, '产教适配_前瞻性缺口清单_Top30.csv'));
const policyEdges = readTable(path.join(POLICY, '任务1_政策技能需求热力表_长表.csv'));
const anchors = readTable(path.join(POLICY, '十五五规划_成果表/任务2_政策刚性锚点表.csv'));
const skillStandardMap = readTable(path.join(POLICY, '技能标准化映射表.csv'));
const dict10 = readWorkbook(path.join(ROOT, '招聘技能词典_双人统一标注版_v1.0.xlsx'));
const dict11 = readWorkbook(path.join(ROOT, '就业端/招聘技能词典_双人统一标注版_v1.1_扩词草案.xlsx'));
const gapWorkbook = readWorkbook(path.join(POLICY, '任务1_技能缺口清单_v2.xlsx'));
const industrySkillBook = readWorkbook('C:/Users/陈吴晟/.kimi-code/sessions/wm_7eb49287-8cac-4ed2-ba63-89576246b475/session_b19e4b7a-e159-4a58-84a8-a2767eeb5e16/attachments/f_b162ff89-f37d-4ee0-b760-da0adc72083e-行业需求技能小类标注.xlsx');
const industryJobBook = readWorkbook('C:/Users/陈吴晟/.kimi-code/sessions/wm_7eb49287-8cac-4ed2-ba63-89576246b475/session_b19e4b7a-e159-4a58-84a8-a2767eeb5e16/attachments/f_eb6945e9-12e8-4d71-8653-3b73b90e4f4d-list1_行业职业标注.xlsx');
const industryAnnotations = {
  skills: industrySkillBook['行业技能标注'],
  occupations: industryJobBook['行业职业标注'],
  sources: industryJobBook['依据与口径'],
  skillIndex: industryJobBook['标准名称索引'],
  evidenceNote: '附件不含2016—2018与2023—2025两期样本量，不用于直接生成z统计量或p值。',
};

const policyStats = JSON.parse(fs.readFileSync(path.join(POLICY, '十五五规划_结构化抽取/汇总_各省抽取统计.json'), 'utf8'));
const industries = [];
for (const name of fs.readdirSync(path.join(POLICY, '十五五规划_结构化抽取')).filter(name => name.endsWith('_结构化抽取.json'))) {
  const file = path.join(POLICY, '十五五规划_结构化抽取', name);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const region = name.replace('省十五五规划_结构化抽取.json', '').replace('市十五五规划_结构化抽取.json', '').replace('十五五规划_结构化抽取.json', '');
  for (const row of json.industries ?? []) industries.push({ region, ...row });
  if (region === '北京') sources.push({ file: file.replaceAll('\\', '/'), rows: (json.industries ?? []).length, sample: (json.industries ?? []).slice(0, 5) });
}

const skillDemand = {};
for (const row of policyEdges) {
  const name = row['技能(标准)'];
  if (!name) continue;
  skillDemand[name] ??= { skill: name, heat: 0, provinces: new Set(), records: 0 };
  skillDemand[name].heat += Number(row['加权计数(高1.0/中0.6/低0.3)']) || 0;
  skillDemand[name].provinces.add(row['地区']);
  skillDemand[name].records += 1;
}
const demandRows = Object.values(skillDemand).map(row => ({ skill: row.skill, heat: Number(row.heat.toFixed(2)), provinces: row.provinces.size, records: row.records }));

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}
function iqr(rows, value) {
  const values = rows.map(value).filter(Number.isFinite).sort((a, b) => a - b);
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const spread = q3 - q1;
  const lower = q1 - 1.5 * spread;
  const upper = q3 + 1.5 * spread;
  return { n: values.length, q1, q3, iqr: spread, lower, upper, outliers: rows.filter(row => value(row) < lower || value(row) > upper) };
}
const policyIqr = iqr(demandRows, row => row.heat);
const policyOutliers = [...policyIqr.outliers].sort((a, b) => b.heat - a.heat);
const courseIqr = iqr(courses, row => Number(row.hours_num));
const courseOutliers = courseIqr.outliers.map(row => ({ id: row['课程号'], name: row['课程名'], school: row['开课院系'], hours: Number(row.hours_num), type: row['course_cat_norm'] })).sort((a, b) => b.hours - a.hours);
const policyBounds = { n: policyIqr.n, q1: policyIqr.q1, q3: policyIqr.q3, iqr: policyIqr.iqr, lower: policyIqr.lower, upper: policyIqr.upper };
const courseBounds = { n: courseIqr.n, q1: courseIqr.q1, q3: courseIqr.q3, iqr: courseIqr.iqr, lower: courseIqr.lower, upper: courseIqr.upper };

const dictionarySheets = {};
for (const [version, sheets] of [['v1.0', dict10], ['v1.1', dict11]]) {
  dictionarySheets[version] = Object.fromEntries(Object.entries(sheets).map(([name, rows]) => [name, { count: rows.length, sample: rows.slice(0, 5) }]));
}

const employmentTrend = [
  { region: '珠三角', p0: 0.0775, p1: 0.1203, n0: null, n1: null },
  { region: '环渤海', p0: 0.0753, p1: 0.1049, n0: null, n1: null },
  { region: '西三角', p0: 0.0541, p1: 0.1035, n0: null, n1: null },
  { region: '东北', p0: 0.0306, p1: 0.0695, n0: null, n1: null },
  { region: '长三角', p0: 0.0788, p1: 0.1099, n0: null, n1: null },
];
const marketRates = [
  { skill: '沟通与协作', rate: 0.423, keywords: ['沟通', '协作', '团队'] },
  { skill: '办公软件应用', rate: 0.191, keywords: ['办公', 'Office', '文档'] },
  { skill: '数据分析与商业智能', rate: 0.100, keywords: ['数据分析', '数据可视化', '商业智能', '数据挖掘'] },
  { skill: '编程能力', rate: 0.058, keywords: ['编程', 'Python', '软件开发', '程序'] },
  { skill: '工业自动化与控制', rate: 0.019, keywords: ['自动化', '工业控制', 'PLC', '机器人'] },
  { skill: '人工智能', rate: 0.012, keywords: ['人工智能', '机器学习', '大模型', '深度学习', '智能算法'] },
];
const salaryCoefficients = [
  { skill: '英语应用', effect: 2.32, low: 1.50, high: 3.15 },
  { skill: '办公软件应用', effect: -13.43, low: -13.95, high: -12.91 },
  { skill: '编程能力', effect: 24.02, low: 22.78, high: 25.26 },
  { skill: '数据库与SQL', effect: 3.61, low: 2.72, high: 4.52 },
  { skill: '人工智能', effect: 24.56, low: 22.08, high: 27.10 },
  { skill: '数据分析与商业智能', effect: 3.89, low: 3.21, high: 4.57 },
  { skill: '机械与结构设计', effect: 6.83, low: 6.09, high: 7.57 },
  { skill: '工业自动化与控制', effect: 0.31, low: -0.94, high: 1.57 },
  { skill: '会计与财务管理', effect: -1.31, low: -2.22, high: -0.39 },
  { skill: '销售与商务拓展', effect: 12.10, low: 11.30, high: 12.91 },
  { skill: '沟通与协作', effect: 1.18, low: 0.70, high: 1.66 },
  { skill: '项目管理', effect: 11.12, low: 10.23, high: 12.02 },
];

const defaultActions = [
  { id: 'fin-tech', name: '科技金融与绿色金融', scope: '中财经济学', type: '新增课程', hours: 32, creditDelta: 2, enabled: true, covers: ['科技金融服务', '绿色金融'], evidence: 'Top30 第1：热度8.1、14省；绿色金融热度4.8、8省', rationale: '政策高位信号 → 新增方向必修 → 以低需求选修置换32学时', semester: '大三上', required: true },
  { id: 'ml-practice', name: '经济大数据与机器学习实战', scope: '中财经济学', type: '新增课程', hours: 32, creditDelta: 2, enabled: true, covers: ['机器学习', '数据分析'], evidence: '机器学习核心供给32学时，覆盖度1.3%', rationale: '数字技能短板 → 理论+实战序列 → 与置换课程学时对冲', semester: '大三上', required: true },
  { id: 'ip-transfer', name: '知识产权与技术转移实务', scope: '中财经济学', type: '新增课程', hours: 16, creditDelta: 1, enabled: true, covers: ['技术转移', '知识产权服务'], evidence: '北京反向缺口；知识产权服务Top30第10、9省', rationale: '北京零供给 → 增设16学时实务模块 → 思政课不动', semester: '大三下', required: true },
  { id: 'python-up', name: 'Python大数据分析基础', scope: '中财经济学', type: '扩容已有课', hours: 16, creditDelta: 1, enabled: true, covers: ['Python编程'], evidence: 'Python覆盖度1.3%，原课32学时', rationale: '工具基座薄弱 → 32→48学时 → 由经济心理学压缩对冲', semester: '大二上', required: true },
  { id: 'history-merge', name: '中国金融史与中外经济关系史整合', scope: '中财经济学', type: '置换低需求课', hours: -16, creditDelta: -1, enabled: true, covers: [], sourceCourseIds: ['CUFE-ECON-015', 'CUFE-ECON-024'], evidence: '中国金融史32 + 中外经济关系史32，整合后48学时', rationale: '内容重叠 → 64→48学时 → 释放16学时；与另三门选修置换合计−96', semester: '大二上', required: false },
  { id: 'org-out', name: '组织行为学', scope: '中财经济学', type: '置换低需求课', hours: -32, creditDelta: -2, enabled: true, covers: [], sourceCourseIds: ['CUFE-ECON-063'], evidence: '原培养方案大四选修32学时', rationale: '低需求选修退出 → 学时让位科技金融 → 总学时不变', semester: '大四上', required: false },
  { id: 'west-out', name: '当代西方经济学流派', scope: '中财经济学', type: '置换低需求课', hours: -32, creditDelta: -2, enabled: true, covers: [], sourceCourseIds: ['CUFE-ECON-036'], evidence: '原培养方案大二下选修32学时', rationale: '内容部分重叠 → 退出选修池 → 学时让位实战课', semester: '大二下', required: false },
  { id: 'psych-compress', name: '经济心理学', scope: '中财经济学', type: '置换低需求课', hours: -16, creditDelta: -1, enabled: true, covers: [], sourceCourseIds: ['CUFE-ECON-060'], evidence: '原培养方案大三下选修32学时', rationale: '转为16学时专题 → 释放16学时 → 支撑Python扩容', semester: '大三下', required: false },
  { id: 'quantum', name: '量子信息科学导论', scope: '北航模块', type: '新增微模块', hours: 16, creditDelta: 1, enabled: true, covers: ['量子计算与量子算法', '量子通信技术'], evidence: '北京量子科技2项反向缺口', rationale: '两项零供给 → 数学×计算机联合微模块 → 创新创业学分池置换', semester: '模块课', required: false },
  { id: '6g', name: '6G通信与下一代网络导论', scope: '北航模块', type: '新增微模块', hours: 16, creditDelta: 1, enabled: true, covers: ['6G通信与下一代网络'], evidence: '北京6G反向缺口', rationale: '前沿缺口 → 计算机学院微模块 → 16学时', semester: '模块课', required: false },
  { id: 'security', name: '网络与信息安全基础', scope: '北航模块', type: '新增微模块', hours: 32, creditDelta: 2, enabled: true, covers: ['网络与信息安全'], evidence: '北京网络与信息安全反向缺口', rationale: '零供给 → 计算机学院专业选修 → 32学时', semester: '模块课', required: false },
  { id: 'brain', name: '脑机接口技术导论', scope: '北航模块', type: '新增微模块', hours: 16, creditDelta: 1, enabled: true, covers: ['脑机接口技术'], evidence: '北京脑机接口反向缺口', rationale: '医工交叉 → 机械学院微模块 → 16学时', semester: '模块课', required: false },
  { id: 'bio', name: '合成生物学与生物制造导论', scope: '北航模块', type: '新增微模块', hours: 16, creditDelta: 1, enabled: true, covers: ['合成生物与生物制造'], evidence: '北京合成生物反向缺口', rationale: '未来产业 → 跨学院微模块 → 16学时', semester: '模块课', required: false },
  { id: 'transfer', name: '技术转移与成果转化实务', scope: '北航模块', type: '新增微模块', hours: 16, creditDelta: 1, enabled: true, covers: ['技术转移'], evidence: '北京技术转移反向缺口', rationale: '科技服务需求 → 创新创业微模块 → 16学时', semester: '模块课', required: false },
  { id: 'breeding', name: '生物育种与现代农业概论', scope: '北航模块', type: '新增微模块', hours: 16, creditDelta: 1, enabled: true, covers: ['生物育种与种质资源'], evidence: '北京生物育种反向缺口', rationale: '现代种业需求 → 通识跨选微模块 → 16学时', semester: '模块课', required: false },
];

const data = {
  generatedAt: new Date().toISOString(),
  stats: {
    provinces: policyStats['合计']['省份数'], industries: industries.length, policyEdges: policyEdges.length,
    anchors: anchors.length, courses: courses.length, courseSkills: skillDict.length, mappings: mappings.length,
    recruitmentRecords: 93602, recruitmentRawAvailable: false, dictionary10: 199, dictionary11: 225,
    reverseGaps: reverseGaps.length, beijingGaps: reverseGaps.filter(row => row['北京十五五命中'] === '是').length,
    beijingSkills: 53, zeroCourses: zeroCourses.length, doubleZeroSkills: doubleZeroSkills.length,
    externalBusiness: 122380690, externalRecruitment: 8450150, salaryModelJobs: 425096,
    policyUniqueV11: 1486, policyUniqueV10: 1580, fuzzyCandidates: 50, fuzzyAccepted: 42, fuzzyRejected: 8,
  },
  courses, mappings, reverseGaps, zeroCourses, doubleZeroSkills, skillDict, cufeCourses, cufeCoverage, programProfiles, top30,
  anchors, industries, demandRows, policyOutliers, courseOutliers, policyBounds, courseBounds,
  employmentTrend, marketRates, salaryCoefficients, defaultActions, dictionarySheets, industryAnnotations,
  gapSheets: Object.fromEntries(Object.entries(gapWorkbook).map(([name, rows]) => [name, { count: rows.length, sample: rows.slice(0, 5) }])),
  skillMapSample: skillStandardMap.slice(0, 5), sources,
  dataWarnings: ['就业端目录未提供93,602条招聘明细，仅有v1.1词典；比例检验使用研究报告汇总率，原始分期样本量未披露时不出具z/p值。', '行业标注附件未披露两期样本量，不用于直接生成z/p；仅用于行业—职业—技能溯源与描述统计。'],
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
console.log(`已生成 ${OUT}`);
console.log(JSON.stringify({ ...data.stats, sources: sources.length, policyOutliers: policyOutliers.length, courseOutliers: courseOutliers.length, cufeHours: cufeCourses.reduce((sum, row) => sum + Number(row['学时']), 0), cufeCredits: cufeCourses.reduce((sum, row) => sum + Number(row['学分']), 0) }, null, 2));
