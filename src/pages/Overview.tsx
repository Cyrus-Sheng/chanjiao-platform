import { ArrowRight, BookOpen, BriefcaseBusiness, Database, FileCheck2, Network, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { PlatformData, PageKey } from '../types';
import type { SourceContent } from '../components/SourceDialog';
import { Card, Metric, SectionTitle, Badge } from '../components/Common';

const pipeline = [
  ['P0', '数据接入', '政策、课程、招聘来源登记', '确定性脚本'],
  ['P1', '格式转化', '异构文件统一为 JSON 模式', '确定性脚本'],
  ['P2', '清洗去重', '字段校验、重复记录治理', '确定性脚本'],
  ['P3', '双向映射', '初筛、人工校对与双人裁定', 'LLM 辅助 + 人工'],
  ['P4', '缺口量化', '集合差、覆盖度与需求加权', '确定性脚本'],
  ['P5', '反馈优化', '词典版本化与季度滚动更新', '规则驱动'],
];

export function Overview({ data, onSource, onNavigate }: { data: PlatformData; onSource: (source: SourceContent) => void; onNavigate: (page: PageKey) => void }) {
  const find = (name: string) => data.sources.find(source => source.file.includes(name));
  const open = (title: string, name: string, formula?: string, note?: string) => {
    const source = find(name);
    onSource({ title, file: source?.file ?? name, rows: source?.sample ?? [], formula, note });
  };
  return <div className="page overview-page">
    <section className="hero">
      <div className="hero-copy"><div className="hero-kicker"><span /> 产业需求 × 教育供给 × 动态决策</div><h1>让专业调整<br /><em>看得见、评得准、调得快</em></h1><p>不止呈现报告，更把缺口识别、课程转化、约束求解、效果预测与统计检验变成可现场演算的分析引擎。</p><div className="hero-actions"><button className="primary-button" onClick={() => onNavigate('designer')}>进入方案设计器 <ArrowRight size={17} /></button><button className="text-button" onClick={() => onNavigate('method')}>查看方法与溯源</button></div></div>
      <div className="hero-orbit" aria-hidden="true"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-center"><Network size={34} /><strong>供需对齐</strong><span>SKILL GRAPH</span></div><div className="orbit-node node-a">政策需求<small>31 省</small></div><div className="orbit-node node-b">课程供给<small>227 门</small></div><div className="orbit-node node-c">就业反馈<small>2016—2025</small></div></div>
    </section>

    <div className="data-alert"><TriangleAlert size={18} /><div><strong>数据边界已显式登记</strong><span>{data.dataWarnings[0]}</span></div><Badge tone="amber">不填假数据</Badge></div>

    <SectionTitle eyebrow="DATA FOUNDATION" title="三端数据底座" description="点击任一指标，可查看来源文件与前 5 行原始记录。" />
    <div className="metrics-grid">
      <Metric label="政策端 · 产业条目" value={Number(data.stats.industries).toLocaleString()} note={`${data.stats.provinces} 省规划 · ${Number(data.stats.policyEdges).toLocaleString()} 技能边`} onClick={() => open('政策产业条目', '北京市十五五规划_结构化抽取.json', '31省产业条目求和 = 985')} />
      <Metric label="政策端 · 刚性锚点" value={Number(data.stats.anchors)} note="量化目标 + 目标年份 + 原文" onClick={() => open('政策刚性锚点', '任务2_政策刚性锚点表.csv', '量化目标非空的政策锚点')} />
      <Metric label="课程端 · 课程池" value={Number(data.stats.courses)} note={`${data.stats.courseSkills} 技能 · ${data.stats.mappings} 映射`} onClick={() => open('课程池', 'course_pool.csv', '四专业课程清洗去重后的记录数')} />
      <Metric label="就业端 · 招聘记录" value={Number(data.stats.recruitmentRecords).toLocaleString()} note="词典说明登记；原始明细未提供" onClick={() => open('就业端数据说明', '招聘技能词典_双人统一标注版_v1.0.xlsx', '93,602条职位描述非空，平均约414字符', data.dataWarnings[0])} />
      <Metric label="就业词典 · v1.0 / v1.1" value={`${data.stats.dictionary10} / ${data.stats.dictionary11}`} note="26 条扩词候选 · 双人标注" onClick={() => open('招聘技能词典', '招聘技能词典_双人统一标注版_v1.0.xlsx', 'v1.1 = 199原有 + 26待验证候选')} />
      <Metric label="外部基座 · 工商记录" value="1.22 亿" note={`精确值 ${Number(data.stats.externalBusiness).toLocaleString()}`} onClick={() => open('外部研究基座', '区域技能需求与高校课程评估_最终研究报告.pdf', '工商登记 122,380,690（1978—2025）', '汇总研究报告，不含逐条工商记录。')} />
      <Metric label="外部基座 · 去重招聘" value="845 万" note={Number(data.stats.externalRecruitment).toLocaleString()} onClick={() => open('外部招聘研究样本', '区域技能需求与高校课程评估_最终研究报告.pdf', '精确去重招聘记录 8,450,150', '用于长期趋势与薪资条件关联。')} />
      <Metric label="薪资主模型岗位" value={Number(data.stats.salaryModelJobs).toLocaleString()} note="12 技能大类联合回归" onClick={() => open('薪资回归模型', '区域技能需求与高校课程评估_最终研究报告.pdf', '100 × [exp(βₖ) − 1]%；主模型 N = 425,096', '控制地区、年份、行业、职业等固定效应；关联不等于因果。')} />
    </div>

    <div className="overview-lower">
      <Card><SectionTitle eyebrow="GOVERNANCE PIPELINE" title="P0—P5 治理流水线" description="机器负责规模，规则负责可信，人工负责裁定。" /><div className="pipeline">{pipeline.map(([id, title, desc, mode], index) => <div className="pipeline-step" key={id}><div className="pipeline-index">{id}</div><div><strong>{title}</strong><p>{desc}</p><Badge tone={mode.includes('LLM') ? 'amber' : 'gray'}>{mode}</Badge></div>{index < pipeline.length - 1 && <ArrowRight className="pipeline-arrow" size={17} />}</div>)}</div></Card>
      <Card className="verification-card"><SectionTitle eyebrow="LIVE ENGINES" title="五个引擎，共享一套状态" /><div className="engine-list">{[
        [FileCheck2, '01', '缺口 → 课程动作', '54 + Top30 逐项转化'],
        [ShieldCheck, '02', '硬约束求解', '学时、学分、学期、思政'],
        [Database, '03', '需求加权覆盖度', 'Um = Σaₖ(1−cₖ)'],
        [BookOpen, '04', '可解释效果预测', '薪资、缺口、招生仿真'],
        [BriefcaseBusiness, '05', '统计检验', '比例检验 + IQR 异常值'],
      ].map(([Icon, id, title, desc]) => { const I = Icon as typeof FileCheck2; return <div key={String(id)}><I size={19} /><span>{String(id)}</span><p><strong>{String(title)}</strong><small>{String(desc)}</small></p></div>; })}</div><button className="primary-button full" onClick={() => onNavigate('effects')}>运行效果验证 <ArrowRight size={16} /></button></Card>
    </div>
  </div>;
}
