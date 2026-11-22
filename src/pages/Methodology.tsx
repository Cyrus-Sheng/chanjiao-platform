import { Bot, Check, FileCode2, GitBranch, ShieldAlert, UserCheck } from 'lucide-react';
import type { PlatformData } from '../types';
import type { SourceContent } from '../components/SourceDialog';
import { Badge, Card, Formula, SectionTitle } from '../components/Common';

const methods = [
  ['政策—技能边', '按地区、产业、标准技能聚合；置信度高1.0 / 中0.6 / 低0.3', '政策端/任务1_政策技能需求热力表_长表.csv'],
  ['反向缺口', 'Gᵣ = {s | 政策需求(s)>0 ∧ 课程供给(s)=0}', '课程端/课程端数据治理/产出/反向缺口_有需求无供给技能.csv'],
  ['课程覆盖度', 'cₖ = 技能核心课程供给学时 / 所选专业课程池总学时', '课程端/中财经济学_交付包/7_major_skill_coverage_中财经济学.csv'],
  ['需求加权未覆盖度', 'Um = Σaₖ(1−cₖ)，a来自政策热度×招聘提及率', '区域技能需求与高校课程评估_最终研究报告.pdf'],
  ['技能匹配度', 'M = Σaₖ × min(Hₖ/H*,1)；H*为可调课程决策阈值', '四专业课程底表 + 区域技能需求与高校课程评估_最终研究报告.pdf'],
  ['多层约束', '学时/学分/必修结构 + 师资数量/方向 + 学生负荷 + 方向容量', '赛题规则.pdf · 企业选拔题评分维度'],
  ['薪资条件关联', '100×[exp(βₖ)−1]%，12技能大类联合回归', '区域技能需求与高校课程评估_最终研究报告.pdf'],
  ['招生反馈', 'Fₜ=.4Eₜ+.3Pₜ+.3(1−Gapₜ)，限幅+滑动平均', '产教智对-方案报告.html · 式4-1'],
];

export function Methodology({ data, onSource }: { data: PlatformData; onSource: (source: SourceContent) => void }) {
  const openMetric = (title: string, file: string, formula: string, rows: Record<string, unknown>[] = []) => onSource({ title, file, formula, rows });
  return <div className="page method-page">
    <SectionTitle eyebrow="METHODOLOGY & LINEAGE" title="方法论与溯源" description="明确区分确定性计算与LLM辅助，把公式、代入值、来源文件和原始样例放在同一条证据链上。" />
    <div className="method-principles"><Card><FileCode2 size={26} /><Badge>确定性脚本</Badge><h3>可复算的分析主链</h3><p>格式转化、清洗去重、集合差、统计检验、覆盖度、约束求解与仿真全部由确定性代码执行。相同输入必得相同输出。</p><ul><li><Check size={15} />2825条政策—技能边聚合</li><li><Check size={15} />146条课程—技能映射求交</li><li><Check size={15} />IQR、z检验、Um与动态仿真</li></ul></Card><Card className="llm-card"><Bot size={26} /><Badge tone="amber">LLM 仅辅助初筛</Badge><h3>不直接生成最终指标</h3><p>政策文本与课程映射初筛后必须进入人工校对和双人标注裁定，模型不直接决定缺口或课程动作。</p><ul><li><UserCheck size={15} />原文excerpt与key_anchor锚定</li><li><UserCheck size={15} />双人独立标注 + 分歧裁定</li><li><UserCheck size={15} />50条模糊候选：42交集 / 8缺口</li></ul></Card></div>

    <Card><SectionTitle title="人机协同判定级联" description="每一步保留判定依据，语义假匹配不会被自动并入交集。" /><div className="cascade">{['人工映射 10条', '精确 / 同义词匹配', '子串包含 · 词条≥4字', '模糊匹配 · ≥0.82进交集', '0.70—0.82进入人工候选'].map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong>{index < 4 && <GitBranch size={18} />}</div>)}</div><div className="cascade-result"><div><strong>50</strong><span>模糊候选</span></div><div><strong>42</strong><span>裁定进交集</span></div><div><strong>8</strong><span>语义假匹配进缺口</span></div><p>例：工业设计 ≠ 工艺设计。自动相似度不代替语义裁定。</p></div></Card>

    <SectionTitle eyebrow="FORMULA LIBRARY" title="关键公式与来源" description="点击打开溯源抽屉，查看来源与可获得的原始样例。" />
    <div className="method-grid">{methods.map(([title, formula, file]) => <button key={title} onClick={() => { const source = data.sources.find(item => file.includes(item.file.split('/').at(-1) ?? '')); openMetric(title, file, formula, source?.sample ?? []); }}><span>{title}</span><code>{formula}</code><small>{file}</small></button>)}</div>

    <div className="two-col">
      <Card><SectionTitle title="关键数字一致性" description="平台默认值与方案报告同口径。" /><div className="consistency-list">{[
        ['北京缺口基线', '15.1%（8/53）'], ['中财总学时', '2,486'], ['中财总学分', '157'], ['默认学时平衡', '+96 / −96'], ['Python扩容', '32 → 48'], ['数字技术学时', '400 → 448'], ['跨校协同基准4年缺口率', '3.0%'], ['基准起薪改善', '3%—5%'],
      ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong><Badge>一致</Badge></div>)}</div></Card>
      <Card><SectionTitle title="可复核性声明" description="数据缺失与模型假设均显式披露。" /><div className="statement"><ShieldAlert size={22} /><p>{data.dataWarnings[0]}</p></div><div className="statement"><ShieldAlert size={22} /><p>报告表4-2全部置换项逐项相加为−128学时，与文字合计−96不一致；平台按任务要求选取其中四门选修构成默认−96方案，未默认采用“经济思想史＋经济史”合并项。课程底表实际必修1,362学时（54.8%），不沿用报告约47%的表述。</p></div><div className="statement"><ShieldAlert size={22} /><p>薪资系数是控制其他变量后的条件关联，不直接解释为课程的因果收益；主预测另用报告H4保守弹性。</p></div><div className="statement"><ShieldAlert size={22} /><p>招生仿真使用相对规模指数和显式初始假设，用于检验反馈机制稳定性，不宣称预测真实招生人数。</p></div><Formula caption="构建期烘焙为 src/data/platform.json，运行时不访问网络">raw xlsx / csv / json → build-data.mjs → platform.json → deterministic frontend</Formula></Card>
    </div>

    <Card><SectionTitle eyebrow="RISK CONTROL" title="风险评估与应对" description="影响程度 × 发生可能性，每项均绑定责任主体与预警指标。" /><div className="risk-grid">{[
      ['R1', '学生适应度 · 分流阵痛', 12, '高', '2周试听 + 第5学期回退通道', '退选率>15%'],
      ['R2', '师资短板 · 无人开课', 12, '高', '企业导师 + 外聘双轨补充', '开课达成率<90%'],
      ['R3', '数据时效衰减', 9, '中', '季度更新政策与招聘数据', '新鲜度>6个月'],
      ['R4', '排课与实验平台冲突', 6, '低', '共享实验平台 + 容量前置', '平台使用率>85%'],
    ].map(([id, title, score, level, action, warning]) => <div key={id}><div><Badge tone={level === '高' ? 'red' : level === '中' ? 'amber' : 'gray'}>{id} · {level}风险</Badge><strong>{score}</strong></div><h3>{title}</h3><p>{action}</p><small>预警：{warning}</small></div>)}</div></Card>

    <Card><SectionTitle title="数据支撑材料" description={`本次构建读取 ${data.sources.length} 个核心文件；原始文件保持只读，平台运行仅依赖烘焙JSON。`} /><div className="source-list">{data.sources.map(source => <button key={source.file} onClick={() => onSource({ title: source.file.split('/').at(-1) ?? source.file, file: source.file, rows: source.sample, note: `读取 ${source.rows} 行${source.sheets ? `；工作表：${source.sheets.join('、')}` : ''}` })}><FileCode2 size={17} /><span><strong>{source.file.split('/').at(-1)}</strong><small>{source.rows.toLocaleString()} 行 · 前5行样例</small></span><em>查看</em></button>)}</div></Card>
  </div>;
}
