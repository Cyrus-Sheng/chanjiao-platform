import { useMemo } from 'react';
import { CheckCircle2, CircleDashed, Clock3 } from 'lucide-react';
import type { ActionItem, ConstraintConfig, PlatformData, SimulationConfig } from '../types';
import { Badge, Card, SectionTitle } from '../components/Common';
import { constraints, gapForecast, matchingModel, salaryForecast, simulateEnrollment } from '../lib/engines';

export function TimelineAnalysis({ data, actions, programId, includeShared, landing, growth, targetHours, simulation, config }: {
  data: PlatformData; actions: ActionItem[]; programId: string; includeShared: boolean; landing: number; growth: number; targetHours: number; simulation: SimulationConfig; config: ConstraintConfig;
}) {
  const profile = data.programProfiles.find(item => item.id === programId) ?? data.programProfiles[0];
  const before = matchingModel(data, actions, programId, landing, growth, targetHours);
  const after = matchingModel(data, actions, programId, landing, growth, targetHours);
  const gap = gapForecast(data, actions, landing, programId, includeShared);
  const salary = salaryForecast(data, actions, landing, programId);
  const sim = simulateEnrollment(data, actions, landing, growth, simulation, programId, includeShared);
  const solver = constraints(data, actions, programId, config);
  const newMicro = actions.filter(action => action.enabled && actionProgramMatches(action, programId, includeShared) && action.type === '新增微模块').length;
  const newCourses = actions.filter(action => action.enabled && actionProgramMatches(action, programId, includeShared) && action.type === '新增课程').length;
  const stages = useMemo(() => [
    { year: 'T0', title: '证据与基线确认', detail: `缺口基线 ${(gap.baseline * 100).toFixed(2)}%；匹配度 ${before.before.toFixed(2)}；${profile.dataQuality.pendingMappingCourses}门课程待复核。`, status: '当前可观测数据' },
    { year: 'T1', title: '微模块与师资准备', detail: `${newMicro}个微模块进入建设；师资数量、学科背景和校企共建方式先行核验。`, status: '教学准备' },
    { year: 'T2', title: '完整课程与方向分流', detail: `${newCourses}门完整课程进入实施；分流${config.expectedStudents ?? '待定'}人 / 容量${config.directionCapacity ?? '待定'}人。`, status: '课程落地' },
    { year: 'T3', title: '数据复核与全面上线', detail: '复核课程映射、先修链和师资到位情况；未通过硬约束的动作不得上线。', status: '实施闸口' },
    { year: 'T4', title: '四年效果评估', detail: `缺口率 ${(gap.forecast * 100).toFixed(2)}%；匹配度 ${after.after.toFixed(2)}；起薪改善 ${salary.salaryLow.toFixed(1)}%—${salary.salaryHigh.toFixed(1)}%。`, status: '效果验证' },
    { year: 'T5', title: '首轮就业反馈', detail: `反馈F=${sim.rows[5]?.feedback.toFixed(3)}；招生规模指数=${sim.rows[5]?.enrollment.toFixed(2)}。`, status: '延迟反馈' },
    { year: 'T6', title: '滚动修正', detail: `根据3年滑动平均与±${simulation.limit}%限幅进行下一轮课程和规模调整。`, status: '滚动优化' },
    { year: 'T10', title: '收敛与复核', detail: `规模指数=${sim.rows[10]?.enrollment.toFixed(2)}；${sim.converged ? '达到收敛判据' : '仍在调整'}。`, status: sim.converged ? '收敛' : '趋稳' },
  ], [data, actions, programId, includeShared, landing, growth, targetHours, simulation, config]);
  return <Card><SectionTitle eyebrow="MULTI-STAGE TRANSMISSION" title="多阶段传导与时间轴" description="沿“证据→建设→实施→反馈→修正”传导，区分当前事实、规划里程碑和延迟反馈，不把规划值当作完成记录。" action={<Badge tone="blue"><Clock3 size={14} /> 10年离散时间</Badge>} /><div className="timeline-stages">{stages.map((stage, index) => <div className="timeline-stage" key={stage.year}><div className="timeline-marker">{index < 4 ? <CircleDashed size={17} /> : <CheckCircle2 size={17} />}<span>{stage.year}</span></div><div className="timeline-content"><div><strong>{stage.title}</strong><Badge tone={index < 4 ? 'gray' : index === 4 ? 'amber' : 'green'}>{stage.status}</Badge></div><p>{stage.detail}</p></div></div>)}</div><div className="inline-notice"><CheckCircle2 size={16} />当前联合求解状态：{!solver.feasible ? '存在不可行约束，需先修复' : solver.complete ? '已配置约束全部通过' : '仍有待补参数，只能条件评估'}。T1—T4为规划里程碑，T5以后由反馈模型驱动。</div></Card>;
}

function actionProgramMatches(action: ActionItem, programId: string, includeShared: boolean) {
  if (action.programId) return action.programId === programId || (includeShared && action.programId === 'shared');
  if (action.scope === '中财经济学') return programId === 'cufe-econ';
  return includeShared;
}
