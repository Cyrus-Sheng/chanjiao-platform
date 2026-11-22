import type { ActionItem, ConstraintConfig, PlatformData, ProgramProfile, ScenarioKey, SimulationConfig } from '../types';
import { categoryCreditAudit, prerequisiteAudit } from './audits';

export const scenarioConfig: Record<ScenarioKey, { label: string; landing: number; growth: number; color: string }> = {
  optimistic: { label: '乐观', landing: 100, growth: 4, color: '#1c7c64' },
  baseline: { label: '基准', landing: 80, growth: 6, color: '#b07a36' },
  pessimistic: { label: '悲观', landing: 50, growth: 9, color: '#9a4c43' },
};

export function actionProgram(action: ActionItem) {
  if (action.programId) return action.programId;
  if (action.scope === '中财经济学') return 'cufe-econ';
  return 'shared';
}

export function defaultConstraintConfig(profile: ProgramProfile): ConstraintConfig {
  return {
    totalHours: profile.totalHours,
    totalCredits: profile.totalCredits,
    semesterCap: profile.semesterCap,
    requiredMin: 45,
    requiredMax: 60,
    facultyTeams: null,
    availableFields: '',
    directionCapacity: profile.id === 'cufe-econ' ? 30 : null,
    expectedStudents: profile.id === 'cufe-econ' ? 30 : null,
    studentReadiness: null,
    minReadiness: 70,
    labSeats: null,
    semesterCreditCap: Math.max(...profile.semesterLoads.map(load => profile.courses.filter(course => String(course['开课学期']) === load.semester).reduce((sum, course) => sum + Number(course['学分'] || 0), 0))),
    categoryTolerance: 2,
  };
}

export function facultyFieldFor(action: ActionItem) {
  if (action.facultyField) return action.facultyField;
  const text = `${action.name} ${action.covers.join(' ')}`;
  if (/科技金融|绿色金融/.test(text)) return '金融科技';
  if (/机器学习|数据|Python|人工智能/.test(text)) return '数据科学与人工智能';
  if (/知识产权|技术转移/.test(text)) return '知识产权与技术转移';
  if (/量子/.test(text)) return '量子信息';
  if (/6G|通信/.test(text)) return '通信工程';
  if (/网络|安全/.test(text)) return '网络与信息安全';
  if (/脑机/.test(text)) return '医工交叉';
  if (/生物|育种/.test(text)) return '生物科学';
  return action.covers[0] || '现有课程团队';
}

export function normalCdf(x: number) {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * z);
  const erf = sign * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z));
  return 0.5 * (1 + erf);
}

export function proportionTest(p0: number, p1: number, n0: number, n1: number) {
  if (![p0, p1, n0, n1].every(Number.isFinite) || n0 <= 0 || n1 <= 0) return null;
  const x0 = Math.round(p0 * n0);
  const x1 = Math.round(p1 * n1);
  const pooled = (x0 + x1) / (n0 + n1);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n0 + 1 / n1));
  if (!se) return null;
  const z = (p1 - p0) / se;
  return { z, p: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))), x0, x1 };
}

export function gapForecast(data: PlatformData, actions: ActionItem[], landing: number, programId = 'cufe-econ', includeShared = false) {
  const profile = data.programProfiles.find(item => item.id === programId) ?? data.programProfiles[0];
  const beijing = data.reverseGaps.filter(row => row['北京十五五命中'] === '是');
  const existingCovered = beijing.filter(row => profile.coverage.some(item => item['技能标准名'] === row['标准技能名'] && Number(item['核心供给学时']) > 0));
  const uncovered = beijing.filter(row => !existingCovered.includes(row));
  const active = actions.filter(action => action.enabled && action.type !== '暂不处理' && (actionProgram(action) === programId || (includeShared && actionProgram(action) === 'shared')));
  const coveredByActions = uncovered.filter(row => active.some(action => action.covers.includes(String(row['标准技能名']))));
  const expectedRemaining = Math.max(0, uncovered.length - landing / 100 * coveredByActions.length);
  return {
    baseline: uncovered.length / Number(data.stats.beijingSkills),
    current: (uncovered.length - coveredByActions.length) / Number(data.stats.beijingSkills),
    forecast: expectedRemaining / Number(data.stats.beijingSkills),
    covered: [...existingCovered, ...coveredByActions].map(row => String(row['标准技能名'])),
    expectedRemaining,
    baseUncovered: uncovered.length,
    actionCovered: coveredByActions.length,
    provisional: profile.dataQuality.pendingMappingCourses > 0,
  };
}

export function counterfactualGap(data: PlatformData, growth: number, baseline?: number) {
  return (baseline ?? Number(data.stats.beijingGaps) / Number(data.stats.beijingSkills)) * Math.pow(1 + growth / 100, 4);
}

function coverageHours(profile: ProgramProfile, keywords: string[]) {
  return profile.coverage.filter(row => keywords.some(keyword => String(row['技能标准名']).toLowerCase().includes(keyword.toLowerCase()))).reduce((sum, row) => sum + Number(row['核心供给学时'] || 0), 0);
}

export function coverageModel(data: PlatformData, actions: ActionItem[], programId: string, after = false, landing = 100) {
  const profile = data.programProfiles.find(item => item.id === programId) ?? data.programProfiles[0];
  const active = after ? actions.filter(action => action.enabled && action.hours > 0 && actionProgram(action) === programId) : [];
  const rows = data.marketRates.map(market => {
    const heat = data.demandRows.filter(row => market.keywords.some(keyword => row.skill.toLowerCase().includes(keyword.toLowerCase()))).reduce((sum, row) => sum + row.heat, 0);
    let hours = coverageHours(profile, market.keywords);
    for (const action of active) {
      if (action.covers.some(skill => market.keywords.some(keyword => skill.toLowerCase().includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(skill.toLowerCase())))) hours += action.hours * landing / 100;
    }
    return { skill: market.skill, heat, rate: market.rate, raw: heat * market.rate, hours, coverage: Math.min(1, hours / profile.totalHours) };
  });
  const sum = rows.reduce((acc, row) => acc + row.raw, 0);
  const weighted = rows.map(row => ({ ...row, weight: sum ? row.raw / sum : 0, contribution: sum ? (row.raw / sum) * (1 - row.coverage) : 0 }));
  return { rows: weighted.sort((a, b) => b.contribution - a.contribution), um: weighted.reduce((sum, row) => sum + row.contribution, 0) };
}

export function matchingModel(data: PlatformData, actions: ActionItem[], programId: string, landing: number, growth: number, targetHours: number) {
  const before = coverageModel(data, actions, programId, false);
  const after = coverageModel(data, actions, programId, true, landing);
  const demandIndex = Math.pow(1 + growth / 100, 4);
  const rows = before.rows.map(base => {
    const changed = after.rows.find(row => row.skill === base.skill)!;
    const beforeScore = Math.min(1, base.hours / Math.max(targetHours, 1));
    const afterTarget = targetHours * demandIndex;
    const afterScore = Math.min(1, changed.hours / Math.max(afterTarget, 1));
    return {
      skill: base.skill,
      weight: base.weight,
      beforeHours: base.hours,
      afterHours: changed.hours,
      beforeScore,
      afterScore,
      targetHours: afterTarget,
      contributionDelta: changed.weight * afterScore - base.weight * beforeScore,
    };
  }).sort((a, b) => Math.abs(b.contributionDelta) - Math.abs(a.contributionDelta));
  return {
    before: rows.reduce((sum, row) => sum + row.weight * row.beforeScore, 0) * 100,
    after: rows.reduce((sum, row) => sum + row.weight * row.afterScore, 0) * 100,
    rows,
    targetHours,
    afterTargetHours: targetHours * demandIndex,
  };
}

export function salaryForecast(data: PlatformData, actions: ActionItem[], landing: number, programId = 'cufe-econ') {
  const activeProgram = actions.filter(action => action.enabled && actionProgram(action) === programId);
  const positiveHours = activeProgram.filter(action => action.hours > 0).reduce((sum, action) => sum + action.hours, 0);
  const matchPoint = Math.min(12, 12.5 * (positiveHours * landing / 100) / 96);
  const activeDigital = activeProgram.filter(action => action.hours > 0 && action.covers.some(skill => ['机器学习', '数据分析', 'Python编程'].includes(skill)));
  const regressionParts = activeDigital.flatMap(action => action.covers.flatMap(skill => {
    const category = skill === 'Python编程' ? '编程能力' : skill === '机器学习' ? '人工智能' : '数据分析与商业智能';
    const coefficient = data.salaryCoefficients.find(row => row.skill === category);
    if (!coefficient) return [];
    return [{ skill: category, beta: coefficient.effect, hours: action.hours, contribution: Math.log1p(coefficient.effect / 100) * Math.min(1, action.hours / 32) * 0.1 * landing / 100 * 100 }];
  }));
  return {
    positiveHours,
    matchPoint,
    matchLow: Math.max(0, matchPoint * 0.8),
    matchHigh: Math.min(100, matchPoint * 1.2),
    salaryLow: matchPoint * 0.3,
    salaryHigh: matchPoint * 0.5,
    regressionParts,
    regressionReference: regressionParts.reduce((sum, row) => sum + row.contribution, 0),
  };
}

export function constraints(data: PlatformData, actions: ActionItem[], programId: string, config: ConstraintConfig) {
  const profile = data.programProfiles.find(item => item.id === programId) ?? data.programProfiles[0];
  const active = actions.filter(action => action.enabled && actionProgram(action) === programId && action.type !== '暂不处理');
  const deltaHours = active.reduce((sum, action) => sum + action.hours, 0);
  const deltaCredits = active.reduce((sum, action) => sum + action.creditDelta, 0);
  const totalHours = config.totalHours + deltaHours;
  const totalCredits = Number((config.totalCredits + deltaCredits).toFixed(2));
  const requiredDelta = profile.requiredHours === null ? null : active.reduce((sum, action) => sum + (action.required ? action.hours : 0), 0);
  const requiredRatio = profile.requiredHours === null || totalHours <= 0 ? null : (profile.requiredHours + (requiredDelta ?? 0)) / totalHours;
  const prerequisites = prerequisiteAudit(profile, active);
  const categoryAudit = categoryCreditAudit(profile, active, config.categoryTolerance);
  const semesterRows = profile.semesterLoads.map(load => {
    const matched = active.filter(action => action.semester === load.semester || load.semester.startsWith(action.semester));
    const delta = matched.reduce((sum, action) => sum + action.hours, 0);
    const creditsBefore = profile.courses.filter(course => String(course['开课学期']) === load.semester).reduce((sum, course) => sum + Number(course['学分'] || 0), 0);
    const creditDelta = matched.reduce((sum, action) => sum + action.creditDelta, 0);
    return { semester: load.semester, before: load.hours, delta, after: load.hours + delta, creditsBefore, creditDelta, creditsAfter: creditsBefore + creditDelta };
  });
  const teacherDelta = active.reduce((sum, action) => {
    if (action.type === '置换低需求课' && action.hours < 0) return sum - Math.floor(Math.abs(action.hours) / 32);
    if (action.type === '新增课程' || action.type === '新增微模块') return sum + Math.ceil(action.hours / 32);
    return sum;
  }, 0);
  const requiredFields = [...new Set(active.filter(action => action.hours > 0 && action.type !== '扩容已有课').map(facultyFieldFor))];
  const availableFields = config.availableFields.split(/[,，、;；\n]/).map(value => value.trim()).filter(Boolean);
  const missingFields = requiredFields.filter(field => !availableFields.includes(field));
  const hasNewDirection = active.some(action => action.hours > 0 && action.type === '新增课程');
  const hasPedagogyChange = active.some(action => action.hours > 0);
  const requiresLab = active.some(action => action.hours > 0 && /数据|Python|机器学习|人工智能|计算|软件|智能|网络|实验|编程/.test(`${action.name} ${action.covers.join(' ')}`));
  const requiredLabSeats = requiresLab ? config.expectedStudents : 0;
  const protectedPattern = /思政|习近平|思想道德|马克思|毛泽东|体育|心理健康|军事/;
  const checks: { label: string; category: string; pass: boolean | null; value: string }[] = [
    { label: '总学时不变', category: '总量', pass: totalHours === config.totalHours, value: `${totalHours.toLocaleString()} / ${config.totalHours.toLocaleString()}` },
    { label: '总学分不变', category: '总量', pass: Math.abs(totalCredits - config.totalCredits) < 0.001, value: `${totalCredits} / ${config.totalCredits}` },
    { label: `必修占比 ${config.requiredMin}%—${config.requiredMax}%`, category: '结构', pass: requiredRatio === null ? null : requiredRatio >= config.requiredMin / 100 && requiredRatio <= config.requiredMax / 100, value: requiredRatio === null ? '课程池未区分必修/选修' : `${(requiredRatio * 100).toFixed(1)}%` },
    { label: `单学期学时 ≤ ${config.semesterCap}`, category: '学生负荷', pass: profile.dataQuality.hasCompleteSemesters ? semesterRows.every(row => row.after <= config.semesterCap) : null, value: profile.dataQuality.hasCompleteSemesters ? `${Math.max(...semesterRows.map(row => row.after))} / ${config.semesterCap}` : '学期字段不完整，无法判定学生负荷' },
    { label: '课程—技能映射已完成复核', category: '数据完备', pass: profile.dataQuality.pendingMappingCourses === 0 ? true : null, value: `已映射${profile.dataQuality.mappedCourses} · 确认零${profile.dataQuality.confirmedZeroCourses} · 待复核${profile.dataQuality.pendingMappingCourses}` },
    { label: '删除/合并不造成先修断裂', category: '先修链', pass: prerequisites.pass, value: prerequisites.violations.length ? `${prerequisites.violations.length}门后续课程受影响` : prerequisites.fieldCourses === 0 ? '先修字段全为空，无法判定' : `已核验${prerequisites.knownDependencies}条依赖` },
    { label: `分类学分占比偏差 ≤ ±${config.categoryTolerance}pp`, category: '分类结构', pass: categoryAudit.complete ? categoryAudit.pass : null, value: categoryAudit.complete ? categoryAudit.rows.map(row => `${row.category}${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(1)}pp`).join(' · ') : `未分类${categoryAudit.unclassifiedAfter.toFixed(2)}学分，无法完整判定` },
    { label: `单学期学分 ≤ ${config.semesterCreditCap}`, category: '学生负荷', pass: profile.dataQuality.hasCompleteSemesters ? semesterRows.every(row => row.creditsAfter <= config.semesterCreditCap + 0.001) : null, value: profile.dataQuality.hasCompleteSemesters ? `${Math.max(...semesterRows.map(row => row.creditsAfter)).toFixed(1)} / ${config.semesterCreditCap}` : '学期字段不完整' },
    { label: '思政 / 体育 / 心理健康不动', category: '政策', pass: active.every(action => action.hours >= 0 || !protectedPattern.test(action.name)), value: `${active.filter(action => action.hours < 0 && protectedPattern.test(action.name)).length} 门被压减` },
    { label: '教学团队净需求 ≤ 可用团队', category: '师资数量', pass: config.facultyTeams === null ? null : Math.max(0, teacherDelta) <= config.facultyTeams, value: config.facultyTeams === null ? `净需求 ${teacherDelta} 个 · 待配置容量` : `${Math.max(0, teacherDelta)} / ${config.facultyTeams}` },
    { label: '新开课学科方向均有团队', category: '师资结构', pass: !requiredFields.length ? true : !config.availableFields.trim() ? null : missingFields.length === 0, value: !requiredFields.length ? '无新增方向' : !config.availableFields.trim() ? `${requiredFields.length} 个方向待配置` : missingFields.length ? `缺：${missingFields.join('、')}` : '全部覆盖' },
    { label: '方向容量满足预计分流人数', category: '方向容量', pass: !hasNewDirection ? true : config.directionCapacity === null || config.expectedStudents === null ? null : config.expectedStudents <= config.directionCapacity, value: !hasNewDirection ? '未新增课程方向' : config.directionCapacity === null || config.expectedStudents === null ? '待配置容量/人数' : `${config.expectedStudents} / ${config.directionCapacity} 人` },
    { label: `先修适应学生比例 ≥ ${config.minReadiness}%`, category: '学生适应', pass: !hasPedagogyChange ? true : config.studentReadiness == null ? null : config.studentReadiness >= config.minReadiness, value: !hasPedagogyChange ? '无新增教学动作' : config.studentReadiness == null ? '待进行先修摸底' : `${config.studentReadiness}% / ${config.minReadiness}%` },
    { label: '实验/机位容量满足分流人数', category: '资源冲突', pass: !requiresLab ? true : requiredLabSeats == null || config.labSeats == null ? null : config.labSeats >= requiredLabSeats, value: !requiresLab ? '无数字实验动作' : requiredLabSeats == null || config.labSeats == null ? '待配置人数/机位' : `${requiredLabSeats} / ${config.labSeats} 个` },
  ];
  const repairs: string[] = [];
  if (deltaHours > 0) repairs.push(`超出 ${deltaHours} 学时：压缩新增课，或选择本专业已标记“可置换”的非保护课程。`);
  if (deltaHours < 0) repairs.push(`少于 ${Math.abs(deltaHours)} 学时：恢复部分新增/扩容动作，或减少置换幅度。`);
  if (Math.abs(deltaCredits) >= 0.001) repairs.push(`学分偏差 ${deltaCredits > 0 ? '+' : ''}${deltaCredits.toFixed(2)}：逐动作调整学分，不能只用学时平衡代替。`);
  const overloaded = profile.dataQuality.hasCompleteSemesters ? semesterRows.find(row => row.after > config.semesterCap) : undefined;
  if (overloaded) repairs.push(`${overloaded.semester}超 ${overloaded.after - config.semesterCap} 学时：将新增模块移至低负荷学期。`);
  for (const violation of prerequisites.violations) repairs.push(`先修断裂：${violation.dependent}（${violation.semester}）依赖 ${violation.prerequisite}；禁止当前方案通过。`);
  if (categoryAudit.complete && !categoryAudit.pass) repairs.push(`分类学分占比偏差超过±${config.categoryTolerance}pp：调整动作分类或学分分配。`);
  const creditOverload = profile.dataQuality.hasCompleteSemesters ? semesterRows.find(row => row.creditsAfter > config.semesterCreditCap + 0.001) : undefined;
  if (creditOverload) repairs.push(`${creditOverload.semester}学分超 ${(creditOverload.creditsAfter - config.semesterCreditCap).toFixed(1)}：将课程移至其他学期。`);
  if (config.facultyTeams === null) repairs.push('师资团队容量未配置：当前只能判定课程结构，不能判定实际可开出。');
  else if (teacherDelta > config.facultyTeams) repairs.push(`师资净缺口 ${teacherDelta - config.facultyTeams} 个团队：减少并行新课、置换释放团队或补充师资。`);
  if (missingFields.length && config.availableFields.trim()) repairs.push(`缺少 ${missingFields.join('、')} 方向团队：配置共建/外聘团队后再判定可执行。`);
  if (config.studentReadiness != null && config.studentReadiness < config.minReadiness) repairs.push(`先修适应比例低于${config.minReadiness}%：设置试听、先修补强与回退通道，或降低首期分流规模。`);
  if (requiredLabSeats != null && config.labSeats != null && config.labSeats < requiredLabSeats) repairs.push(`实验/机位缺口 ${requiredLabSeats - config.labSeats} 个：分批排课、共享平台或扩充容量。`);
  if (!repairs.length && checks.every(check => check.pass === true)) repairs.push('全部已配置约束通过，可以进入实施评估。');
  return {
    profile, totalHours, totalCredits, deltaHours, deltaCredits, requiredRatio, semesterRows, checks, repairs,
    teacherDelta, requiredFields, missingFields, requiredLabSeats, prerequisites, categoryAudit,
    feasible: checks.every(check => check.pass !== false),
    complete: checks.every(check => check.pass === true),
  };
}

function semesterName(value: string) {
  return value.match(/^(大一上|大一下|大二上|大二下|大三上|大三下|大四上|大四下)/)?.[0] ?? value;
}

export function generateScheme(data: PlatformData, programId: string, existingActions: ActionItem[], options: { maxActions: number; region: 'beijing' | 'national'; strategy: 'module' | 'balanced' | 'course'; facultyTeams: number | null; includeShared?: boolean }) {
  const profile = data.programProfiles.find(item => item.id === programId) ?? data.programProfiles[0];
  const covered = new Set(profile.coverage.filter(row => Number(row['核心供给学时']) > 0).map(row => String(row['技能标准名'])));
  for (const action of existingActions.filter(action => action.enabled && (actionProgram(action) === programId || (options.includeShared && actionProgram(action) === 'shared')))) for (const skill of action.covers) covered.add(skill);
  const reverse = data.reverseGaps.filter(row => options.region === 'national' || row['北京十五五命中'] === '是').map(row => ({
    skill: String(row['标准技能名']), heat: data.demandRows.find(item => item.skill === String(row['标准技能名']))?.heat ?? 0,
    priority: row['北京十五五命中'] === '是' ? 100 : 20,
    evidence: `政策词：${String(row['北京十五五技能词'] || row['京外全国技能词'])}；当前已映射课程未覆盖，另有${profile.dataQuality.pendingMappingCourses}门待复核`,
    field: String(row['技能领域']),
  }));
  const forward = data.top30.map((row, index) => ({ row, rank: index + 1 })).filter(({ row }) => options.region === 'national' || String(row['覆盖省份']).includes('北京')).map(({ row, rank }) => ({
    skill: String(row['政策独有技能']), heat: Number(row['政策强度_加权热度']), priority: 60 - rank,
    evidence: `Top30第${rank}：热度${row['政策强度_加权热度']}，覆盖${row['政策普适性_覆盖省份数']}省`,
    field: String(row['政策独有技能']),
  }));
  const candidates = [...reverse, ...forward].filter(row => !covered.has(row.skill)).filter((row, index, array) => array.findIndex(item => item.skill === row.skill) === index).sort((a, b) => b.priority - a.priority || b.heat - a.heat);
  const generated: ActionItem[] = [];
  let usedTeams = 0;
  for (const candidate of candidates) {
    if (generated.filter(action => action.hours > 0).length >= options.maxActions) break;
    const type = options.strategy === 'module' ? '新增微模块' : options.strategy === 'course' ? '新增课程' : candidate.heat >= 5 ? '新增课程' : '新增微模块';
    const hours = type === '新增课程' ? 32 : 16;
    const teams = type === '新增课程' ? 1 : 1;
    if (options.facultyTeams !== null && usedTeams + teams > options.facultyTeams) continue;
    usedTeams += teams;
    const semester = semesterName([...profile.semesterLoads].sort((a, b) => a.hours - b.hours)[0]?.semester ?? '模块课');
    generated.push({
      id: `auto-${programId}-${generated.length}-${candidate.skill}`, name: `${candidate.skill}${type === '新增课程' ? '基础' : '微模块'}`,
      scope: profile.shortName, programId, type, hours, creditDelta: hours / 16, enabled: true, covers: [candidate.skill],
      evidence: candidate.evidence, rationale: `${candidate.evidence} → ${type}${hours}学时 → 进入学时、师资与容量联合校验`,
      semester, required: false, facultyField: candidate.field, custom: true,
    });
  }
  const protectedPattern = /思政|习近平|思想道德|马克思|毛泽东|体育|心理健康|军事/;
  const replaceable = profile.courses.filter(row => row['置换资格'] === '可置换' && Number(row['学时']) > 0 && !protectedPattern.test(String(row['课名'])) && row['课程性质'] !== '必修' && row['课程性质'] !== '核心专业类').sort((a, b) => Number(a['学时']) - Number(b['学时']));
  let remaining = generated.reduce((sum, action) => sum + action.hours, 0);
  for (const course of replaceable) {
    if (remaining <= 0) break;
    const courseHours = Number(course['学时']);
    const release = Math.min(courseHours, remaining);
    generated.push({
      id: `auto-replace-${programId}-${String(course['课程ID'])}`, name: `${String(course['课名'])}${release === courseHours ? '置换' : '压缩'}`,
      scope: profile.shortName, programId, type: '置换低需求课', hours: -release,
      creditDelta: -Number((Number(course['学分']) * release / courseHours).toFixed(2)), enabled: true, covers: [], sourceCourseIds: [String(course['课程ID'])],
      evidence: `用户在导入底表中将「${String(course['课名'])}」标记为可置换；原${courseHours}学时/${course['学分']}学分`,
      rationale: `经用户确认可置换且非保护课程 → ${release === courseHours ? '置换' : '压缩'}释放${release}学时 → 不触碰思政、必修与核心课程`,
      semester: semesterName(String(course['开课学期'])), required: course['课程性质'] === '必修', custom: true,
    });
    remaining -= release;
  }
  return generated;
}

export function simulateEnrollment(data: PlatformData, actions: ActionItem[], landing: number, growth: number, config: SimulationConfig, programId?: string, includeShared = false) {
  const gap = gapForecast(data, actions, landing, programId, includeShared).forecast;
  const demandLevel = 1 + growth / 100 * 4;
  let enrollment = 100;
  const history: number[] = [];
  const rows = [{ year: 0, enrollment, feedback: 0.4 * (0.9 - 0.3 * gap) + 0.3 * (0.72 - 0.5 * gap) + 0.3 * (1 - gap), gap, adjustment: 0 }];
  for (let year = 1; year <= 10; year += 1) {
    const dynamicGap = Math.min(0.95, Math.max(0, gap * demandLevel * 100 / enrollment));
    const employment = 0.9 - 0.3 * dynamicGap;
    const alignment = 0.72 - 0.5 * dynamicGap;
    const feedback = 0.4 * employment + 0.3 * alignment + 0.3 * (1 - dynamicGap);
    history.push(feedback);
    const smooth = history.slice(-config.smoothing).reduce((sum, value) => sum + value, 0) / Math.min(history.length, config.smoothing);
    let raw = 0;
    if (smooth < 0.7 || employment < 0.85 || alignment < 0.6) raw = -0.05;
    else if (smooth >= Math.max(0.8, config.threshold) && dynamicGap > config.targetGap) raw = 5 * (dynamicGap - config.targetGap);
    const adjustment = Math.max(-config.limit / 100, Math.min(config.limit / 100, raw));
    enrollment = Math.max(30, enrollment * (1 + adjustment));
    rows.push({ year, enrollment, feedback, gap: dynamicGap, adjustment });
  }
  const last = rows.at(-1)!;
  const previous = rows.at(-2)!;
  return { rows, converged: Math.abs(last.enrollment - previous.enrollment) / previous.enrollment < 0.005, finalChange: last.adjustment };
}

export function recommendAction(skill: string, region: string, heat = 0) {
  const digital = /Python|数据|软件|人工|智能|网络|计算|通信/.test(skill);
  const type = region === '北京' ? (digital && /网络|安全/.test(skill) ? '新增课程' : '新增微模块') : heat >= 5 ? '新增课程' : '新增微模块';
  return { type, hours: type === '新增课程' ? 32 : 16, reason: `${region}政策证据 → ${type} → ${heat >= 5 ? '高热信号优先排课' : '低学时模块先行验证'}；进入学时、师资、学生负荷与容量联合校验` };
}
