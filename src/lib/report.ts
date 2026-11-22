import type { ActionItem, ConstraintConfig, PlatformData, ProgramProfile } from '../types';
import { counterfactualGap, constraints, coverageModel, gapForecast, matchingModel, salaryForecast } from './engines';
import { assessFaculty } from './audits';
import { courseDesign } from './courseDesign';

interface ReportInput {
  data: PlatformData;
  profile: ProgramProfile;
  config: ConstraintConfig;
  actions: ActionItem[];
  includeShared: boolean;
  result: ReturnType<typeof constraints>;
  faculty: ReturnType<typeof assessFaculty>;
  gap: ReturnType<typeof gapForecast>;
  matching: ReturnType<typeof matchingModel>;
  beforeCoverage: ReturnType<typeof coverageModel>;
  afterCoverage: ReturnType<typeof coverageModel>;
  salary: ReturnType<typeof salaryForecast>;
  landing: number;
  growth: number;
  targetHours: number;
}

function cell(value: unknown) {
  return String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function status(value: boolean | null) {
  return value === true ? '通过' : value === false ? '不通过' : '待补数据';
}

export function buildMarkdownReport(input: ReportInput) {
  const { data, profile, config, actions, includeShared, result, faculty, gap, matching, beforeCoverage, afterCoverage, salary, landing, growth, targetHours } = input;
  const active = actions.filter(action => action.enabled && action.type !== '暂不处理');
  const teaching = active.filter(action => action.hours > 0 && ['新增课程', '新增微模块'].includes(action.type)).map(action => ({ action, design: courseDesign(action, profile) }));
  const noAction = counterfactualGap(data, growth, gap.baseline);
  const riskDefinition = [
    { id: 'R1', name: '学生适应度与先修断裂', impact: 3, categories: ['学生适应', '先修链'], response: '设置试听、先修补强和回退通道；存在先修断裂时不得提交实施。' },
    { id: 'R2', name: '师资数量与结构短板', impact: 4, categories: ['师资数量', '师资结构'], response: '优先内部课程群支撑；不足时安排转型培训、外聘或校企共建。' },
    { id: 'R3', name: '数据完备性与时效', impact: 3, categories: ['数据完备'], response: '完成映射复核并季度更新；待复核课程不作为自动删除依据。' },
    { id: 'R4', name: '容量、排课与实验资源冲突', impact: 3, categories: ['资源冲突', '方向容量', '学生负荷'], response: '分流容量前置，采用分批排课、共享平台或扩充机位。' },
  ];
  const risks = riskDefinition.map(risk => {
    const related = result.checks.filter(check => risk.categories.includes(check.category));
    const likelihood = related.some(check => check.pass === false) ? 5 : related.some(check => check.pass === null) ? 3 : 1;
    const score = risk.impact * likelihood;
    return { ...risk, likelihood, score, level: score >= 12 ? '高' : score >= 6 ? '中' : '低', evidence: related.map(check => `${check.label}：${check.value}`).join('；') };
  });
  const quality = profile.dataQuality;
  return `# 专业调整论证报告

> 生成时间：${new Date().toLocaleString('zh-CN')}  
> 专业：${profile.name}  
> 数据基础：${profile.basis}  
> 计算范围：${includeShared ? '本专业 + 显式启用的跨校协同模块' : '仅本专业'}  
> 来源文件：${profile.sourceFile}

## 一、调整依据（缺口证据链）

- 当前专业缺口基线：**${(gap.baseline * 100).toFixed(2)}%**（${gap.baseUncovered}/53）。
- 当前动作直接新增覆盖 **${gap.actionCovered}项**；落地率假设为 **${landing}%**。
- 映射完备性：已映射${quality.mappedCourses}门，确认零供给${quality.confirmedZeroCourses}门，待复核${quality.pendingMappingCourses}门。
- ${gap.provisional ? '由于仍有课程待复核，以下缺口与匹配度均为可观测暂定结果，不构成完整专业结论。' : '课程映射复核完整。'}
- 本报告只使用当前勾选动作及其来源证据，不使用未勾选动作改善指标。

| 课程/模块 | 缺口或调整证据 | 理由链 |
|---|---|---|
${active.map(action => `| ${cell(action.name)} | ${cell(action.evidence)} | ${cell(action.rationale)} |`).join('\n')}

## 二、调整方案明细

| 课程/模块 | 动作 | 学时变化 | 学分变化 | 开课学期 | 分类 | 所需师资方向 |
|---|---|---:|---:|---|---|---|
${active.map(action => `| ${cell(action.name)} | ${action.type} | ${action.hours > 0 ? '+' : ''}${action.hours} | ${action.creditDelta > 0 ? '+' : ''}${action.creditDelta} | ${cell(action.semester)} | ${action.category ?? (action.hours < 0 ? '按源课程' : '专业')} | ${cell(action.facultyField ?? action.covers.join('、') ?? '—')} |`).join('\n')}

**学时平衡：${result.deltaHours >= 0 ? '+' : ''}${result.deltaHours}；学分平衡：${result.deltaCredits >= 0 ? '+' : ''}${result.deltaCredits.toFixed(2)}。**

### 新课教学模块、先修建议与考核

> 以下为领域规则生成的教学设计建议，需经教学委员会审定；先修匹配只使用当前课程池真实课程。

${teaching.length ? teaching.map(({ action, design }) => `#### ${action.name}（${action.hours}学时）

| 教学模块 | 学时 | 具体教学内容 | 可检查学习成果 |
|---|---:|---|---|
${design.modules.map(module => `| ${cell(module.name)} | ${module.hours} | ${cell(module.content)} | ${cell(module.outcome)} |`).join('\n')}

**先修建议**

${design.prerequisites.map(item => `- ${item.suggestion}：${item.existingCourse ? `可衔接${item.existingCourse}（${item.semester}）` : '当前课程池未检出，建议跨院补修或设置先修学习包'}。`).join('\n')}

| 考核组成 | 权重 | 考核证据 |
|---|---:|---|
${design.assessment.map(item => `| ${item.name} | ${item.weight}% | ${item.evidence} |`).join('\n')}`).join('\n\n') : '当前方案没有拟新增课程。'}

## 三、硬性约束校验表

| 层级 | 校验项 | 当前值 | 结论 |
|---|---|---|---|
${result.checks.map(check => `| ${check.category} | ${cell(check.label)} | ${cell(check.value)} | ${status(check.pass)} |`).join('\n')}

### 先修链断裂明细

${result.prerequisites.violations.length ? `| 被置换先修课 | 受影响后续课程 | 开课学期 | 触发动作 |\n|---|---|---|---|\n${result.prerequisites.violations.map(row => `| ${cell(row.prerequisite)} | ${cell(row.dependent)} | ${cell(row.semester)} | ${cell(row.action)} |`).join('\n')}` : `未发现已知先修断裂。先修字段非空课程${result.prerequisites.fieldCourses}门，有效依赖${result.prerequisites.knownDependencies}条，未解析引用${result.prerequisites.unresolvedReferences}条；字段为空不等于已完成校验。`}

### 分类学分占比

| 分类 | 调整前学分 | 调整后学分 | 调整前占比 | 调整后占比 | 偏差 |
|---|---:|---:|---:|---:|---:|
${result.categoryAudit.rows.map(row => `| ${row.category} | ${row.beforeCredits.toFixed(2)} | ${row.afterCredits.toFixed(2)} | ${(row.beforeShare * 100).toFixed(2)}% | ${(row.afterShare * 100).toFixed(2)}% | ${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(2)}pp |`).join('\n')}

未分类学分：调整前${result.categoryAudit.unclassifiedBefore.toFixed(2)}，调整后${result.categoryAudit.unclassifiedAfter.toFixed(2)}。分类不全时不作“分类结构通过”结论。

### 修复建议

${result.repairs.map(item => `- ${item}`).join('\n')}

## 四、效果预测

| 指标 | 调整前/基线 | 当前方案预测 | 口径 |
|---|---:|---:|---|
| 专业缺口率 | ${(gap.baseline * 100).toFixed(2)}% | ${(gap.forecast * 100).toFixed(2)}% | 先扣已有供给，再扣落地率×新增覆盖，分母53 |
| 反事实缺口率（不调整） | — | ${(noAction * 100).toFixed(2)}% | 基线×(1+${growth}%)⁴ |
| 需求加权未覆盖度 Um | ${beforeCoverage.um.toFixed(4)} | ${afterCoverage.um.toFixed(4)} | Σaₖ(1−cₖ)，分母${profile.totalHours}学时 |
| 可观测技能匹配度 | ${matching.before.toFixed(2)} | ${matching.after.toFixed(2)} | Σaₖ×min(Hₖ/H*,1)，H*=${targetHours}学时 |
| 专业对口率改善点估计 | — | ${salary.matchPoint.toFixed(2)}pp | min(12, 12.5×有效新增学时/96) |
| 平均起薪改善 | — | ${salary.salaryLow.toFixed(2)}%—${salary.salaryHigh.toFixed(2)}% | 对口率改善×0.3%—0.5%/pp |

### 模型假设与边界

- 需求年增速：${growth}%；方案落地率：${landing}%；单技能基准目标学时：${targetHours}。
- H*是课程决策阈值，不是实测统计常数；薪资系数表示条件关联，不直接解释为课程因果收益。
- 技能匹配度、专业对口率与起薪分别计算，不混用口径。
- 师资评估只使用课程群近似，不涉及教师个人评价。

### 师资课程群近似评估

| 拟新增课程 | 所需背景 | 支撑度 | 建议 | 理由 |
|---|---|---:|---|---|
${faculty.length ? faculty.map(row => `| ${cell(row.course)} | ${row.backgrounds.join(' + ')} | ${(row.score * 100).toFixed(0)}% | ${row.level} | ${cell(row.reason)} |`).join('\n') : '| — | — | — | 当前无拟新增课程 | — |'}

## 五、风险与应对

风险筛查规则：已配置约束失败记发生可能性5，待补数据记3，已配置且通过记1；风险值=影响程度×可能性。该矩阵用于当前方案审查，不替代教学委员会专家评定。

| 风险 | 影响 | 可能性 | 风险值 | 等级 | 当前证据 | 应对 |
|---|---:|---:|---:|---|---|---|
${risks.map(risk => `| ${risk.id} ${risk.name} | ${risk.impact} | ${risk.likelihood} | ${risk.score} | ${risk.level} | ${cell(risk.evidence)} | ${risk.response} |`).join('\n')}

---

数据来源：产教智对离线数据包及${profile.sourceFile}。本报告由当前方案实时生成；所有“待补数据”项应在提交教学委员会前完成复核。
`;
}
