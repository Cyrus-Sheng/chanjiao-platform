import { useMemo } from 'react';
import { AlertCircle, ShieldAlert, Tornado } from 'lucide-react';
import type { ActionItem, ConstraintConfig, PlatformData } from '../types';
import { Chart } from '../components/Chart';
import { Badge, Card, SectionTitle } from '../components/Common';
import { constraints, coverageModel, gapForecast, matchingModel, salaryForecast } from '../lib/engines';

export function StressAnalysis({ data, actions, programId, includeShared, landing, growth, targetHours, config }: {
  data: PlatformData; actions: ActionItem[]; programId: string; includeShared: boolean; landing: number; growth: number; targetHours: number; config: ConstraintConfig;
}) {
  const scenarios = useMemo(() => [
    { id: 'baseline', name: '当前设定', landing, growth, horizon: 4, config },
    { id: 'low-landing', name: '落地率降至50%', landing: 50, growth, horizon: 4, config },
    { id: 'high-growth', name: '需求增速升至9%', landing, growth: 9, horizon: 4, config },
    { id: 'faculty', name: '师资团队无法新增', landing, growth, horizon: 4, config: { ...config, facultyTeams: 0 } },
    { id: 'delay', name: '实施延迟2年（第6年评估）', landing: Math.min(100, landing * 1.5), growth, horizon: 6, config },
    { id: 'combined', name: '低落地 + 高需求 + 师资不足', landing: 50, growth: 9, horizon: 4, config: { ...config, facultyTeams: 0 } },
  ].map(scenario => {
    const gap = gapForecast(data, actions, scenario.landing, programId, includeShared);
    const matching = matchingModel(data, actions, programId, scenario.landing, scenario.growth, targetHours);
    const coverage = coverageModel(data, actions, programId, true, scenario.landing);
    const salary = salaryForecast(data, actions, scenario.landing, programId);
    const solver = constraints(data, actions, programId, scenario.config);
    return { ...scenario, gap, matching, coverage, salary, solver };
  }), [data, actions, programId, includeShared, landing, growth, targetHours, config]);
  const tornadoRows = useMemo(() => {
    const baseGap = gapForecast(data, actions, landing, programId, includeShared).forecast;
    const baseMatch = matchingModel(data, actions, programId, landing, growth, targetHours).after;
    const variants = [
      { name: '落地率 50%', landing: 50, growth, targetHours, shared: includeShared },
      { name: '落地率 100%', landing: 100, growth, targetHours, shared: includeShared },
      { name: '需求增速 4%', landing, growth: 4, targetHours, shared: includeShared },
      { name: '需求增速 9%', landing, growth: 9, targetHours, shared: includeShared },
      { name: '目标学时 32h', landing, growth, targetHours: 32, shared: includeShared },
      { name: '目标学时 128h', landing, growth, targetHours: 128, shared: includeShared },
      { name: includeShared ? '关闭跨校协同' : '开启跨校协同', landing, growth, targetHours, shared: !includeShared },
    ];
    return variants.map(variant => {
      const gap = gapForecast(data, actions, variant.landing, programId, variant.shared).forecast;
      const match = matchingModel(data, actions, programId, variant.landing, variant.growth, variant.targetHours).after;
      return { name: variant.name, gap: (gap - baseGap) * 100, match: match - baseMatch };
    }).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  }, [data, actions, programId, includeShared, landing, growth, targetHours]);
  return <>
    <Card><SectionTitle eyebrow="DETERMINISTIC STRESS TEST" title="确定性压力测试矩阵" description="逐项改变输入并重新计算，不引入随机抽样或额外智能体模拟。约束失败与效果下降分开呈现。" /><div className="table-wrap"><table><thead><tr><th>压力情景</th><th>评估期</th><th>缺口率</th><th>匹配度</th><th>Um</th><th>起薪改善</th><th>约束结论</th></tr></thead><tbody>{scenarios.map(scenario => <tr key={scenario.id}><td><strong>{scenario.name}</strong></td><td>{scenario.horizon}年</td><td>{(scenario.gap.forecast * 100).toFixed(2)}%</td><td>{scenario.matching.after.toFixed(2)}</td><td>{scenario.coverage.um.toFixed(4)}</td><td>{scenario.salary.salaryLow.toFixed(2)}%—{scenario.salary.salaryHigh.toFixed(2)}%</td><td><Badge tone={!scenario.solver.feasible ? 'red' : scenario.solver.complete ? 'green' : 'amber'}>{!scenario.solver.feasible ? '不可行' : scenario.solver.complete ? '可行' : '条件可行'}</Badge></td></tr>)}</tbody></table></div><div className="inline-notice"><AlertCircle size={16} />延迟情景将第4年的落地进度折算为第6年，其他参数保持不变；它不是实际延期记录。</div></Card>
    <Card><SectionTitle eyebrow="SENSITIVITY / TORNADO" title="参数敏感性龙卷风图" description="相对当前设定，缺口率变化以百分点(pp)、匹配度变化以分表示；左右两侧分别为下降与上升。" action={<Badge tone="blue"><Tornado size={14} /> 单因素扰动</Badge>} /><Chart className="tornado-chart" option={{ grid: { left: 115, right: 65, top: 30, bottom: 35 }, tooltip: { trigger: 'axis' }, legend: { data: ['缺口率变化(pp)', '匹配度变化(分)'], top: 0 }, xAxis: { type: 'value', name: '相对基准的变化', axisLabel: { formatter: '{value}' }, splitLine: { lineStyle: { color: '#e7ece7' } } }, yAxis: { type: 'category', inverse: true, data: tornadoRows.map(row => row.name), axisLabel: { fontSize: 11 }, axisTick: { show: false } }, series: [{ name: '缺口率变化(pp)', type: 'bar', data: tornadoRows.map(row => ({ value: Number(row.gap.toFixed(2)), itemStyle: { color: row.gap >= 0 ? '#a95c4f' : '#397b62' } })), label: { show: true, position: 'right', formatter: '{c}' } }, { name: '匹配度变化(分)', type: 'bar', data: tornadoRows.map(row => ({ value: Number(row.match.toFixed(2)), itemStyle: { color: row.match >= 0 ? '#397b62' : '#a95c4f' } })), label: { show: true, position: 'right', formatter: '{c}' } }] }} /><div className="table-wrap"><table><thead><tr><th>扰动项</th><th>缺口率变化 / pp</th><th>匹配度变化 / 分</th></tr></thead><tbody>{tornadoRows.map(row => <tr key={row.name}><td>{row.name}</td><td className={row.gap >= 0 ? 'negative' : 'positive'}>{row.gap >= 0 ? '+' : ''}{row.gap.toFixed(2)}</td><td className={row.match >= 0 ? 'positive' : 'negative'}>{row.match >= 0 ? '+' : ''}{row.match.toFixed(2)}</td></tr>)}</tbody></table></div></Card>
  </>;
}
