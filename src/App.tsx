import { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpenCheck, ChevronLeft, ChevronRight, Database, Expand, FlaskConical, Menu, Minimize, Network, SlidersHorizontal, X } from 'lucide-react';
import rawData from './data/platform.json';
import type { ActionItem, ConstraintConfig, PageKey, PlatformData, ProgramProfile, Row, ScenarioKey, SimulationConfig } from './types';
import type { SourceContent } from './components/SourceDialog';
import { SourceDialog } from './components/SourceDialog';
import { defaultConstraintConfig } from './lib/engines';
import { applyCourseReviews, CourseReviewMap, reviewsFromSnapshot } from './lib/review';
import { Overview } from './pages/Overview';
import { GapAnalysis } from './pages/GapAnalysis';
import { Designer } from './pages/Designer';
import { Effects } from './pages/Effects';
import { Methodology } from './pages/Methodology';
import './styles.css';

const baseData = rawData as PlatformData;
const pages: { key: PageKey; label: string; index: string; icon: typeof Database; conclusion: string }[] = [
  { key: 'overview', label: '数据总览', index: '01', icon: Database, conclusion: '三端数据可逐条回溯，所有关键数字都有来源与原始样例。' },
  { key: 'gaps', label: '差距分析', index: '02', icon: BarChart3, conclusion: '北京缺口基线15.1%，统计检验与异常值分析共同界定结论边界。' },
  { key: 'designer', label: '方案设计器', index: '03', icon: SlidersHorizontal, conclusion: '内置专业与本地导入课程底表均可进行课程、师资、资源与容量联合求解。' },
  { key: 'effects', label: '效果验证', index: '04', icon: FlaskConical, conclusion: '逐技能匹配度随课程学时实时变化，缺口、薪资与招生反馈同步验证。' },
  { key: 'method', label: '方法论与溯源', index: '05', icon: BookOpenCheck, conclusion: '确定性脚本负责计算，LLM只辅助初筛，人工裁定保证可信。' },
];

export default function App() {
  const [page, setPage] = useState<PageKey>('overview');
  const [actions, setActions] = useState<ActionItem[]>(() => structuredClone(baseData.defaultActions));
  const [customProfiles, setCustomProfiles] = useState<ProgramProfile[]>(() => {
    try { return JSON.parse(localStorage.getItem('chanjiao-custom-profiles') ?? '[]') as ProgramProfile[]; }
    catch { return []; }
  });
  const [profileReviews, setProfileReviews] = useState<Record<string, CourseReviewMap>>(() => {
    try { return JSON.parse(localStorage.getItem('chanjiao-course-reviews') ?? '{}') as Record<string, CourseReviewMap>; }
    catch { return {}; }
  });
  const data = useMemo(() => ({
    ...baseData,
    programProfiles: [...baseData.programProfiles, ...customProfiles].map(profile => applyCourseReviews(profile, profileReviews[profile.id] ?? {})),
  }), [customProfiles, profileReviews]);
  const [programId, setProgramId] = useState('cufe-econ');
  const [constraintConfigs, setConstraintConfigs] = useState<Record<string, ConstraintConfig>>(() => Object.fromEntries(data.programProfiles.map(profile => [profile.id, defaultConstraintConfig(profile)])));
  const [targetHours, setTargetHours] = useState(64);
  const [scenario, setScenario] = useState<ScenarioKey>('baseline');
  const [landing, setLanding] = useState(80);
  const [growth, setGrowth] = useState(6);
  const [includeShared, setIncludeShared] = useState(false);
  const [simulation, setSimulation] = useState<SimulationConfig>({ limit: 10, smoothing: 3, threshold: 0.78, targetGap: 0.035 });
  const [source, setSource] = useState<SourceContent | null>(null);
  const [present, setPresent] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { localStorage.setItem('chanjiao-custom-profiles', JSON.stringify(customProfiles)); }, [customProfiles]);
  useEffect(() => { localStorage.setItem('chanjiao-course-reviews', JSON.stringify(profileReviews)); }, [profileReviews]);
  const reviewCourse = (id: string, courseId: string, patch: Row) => {
    setProfileReviews(prev => {
      const baseProfile = baseData.programProfiles.find(profile => profile.id === id) ?? customProfiles.find(profile => profile.id === id);
      const original = baseProfile?.courses.find(course => String(course['课程ID']) === courseId) ?? {};
      const course = { ...prev[id]?.[courseId], ...patch };
      for (const key of Object.keys(course)) if (String(course[key] ?? '') === String(original[key] ?? '')) delete course[key];
      const program = { ...prev[id] };
      if (Object.keys(course).length) program[courseId] = course;
      else delete program[courseId];
      const next = { ...prev };
      if (Object.keys(program).length) next[id] = program;
      else delete next[id];
      return next;
    });
  };
  const current = pages.find(item => item.key === page)!;
  const navigate = (key: PageKey) => { setPage(key); setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const togglePresent = () => setPresent(value => !value);
  const importProfile = (profile: ProgramProfile) => {
    setCustomProfiles(prev => [...prev.filter(item => item.id !== profile.id), profile]);
    setConstraintConfigs(prev => ({ ...prev, [profile.id]: defaultConstraintConfig(profile) }));
    setProgramId(profile.id);
  };
  const deleteProfile = (id: string) => {
    setCustomProfiles(prev => prev.filter(profile => profile.id !== id));
    setProfileReviews(prev => { const next = { ...prev }; delete next[id]; return next; });
    setConstraintConfigs(prev => { const next = { ...prev }; delete next[id]; return next; });
    setProgramId('cufe-econ');
    setIncludeShared(false);
    setActions(structuredClone(baseData.defaultActions));
  };
  const importDecision = (payload: { programId: string; actions: ActionItem[]; config: ConstraintConfig; includeShared?: boolean; profileSnapshot?: ProgramProfile }) => {
    let profile = data.programProfiles.find(item => item.id === payload.programId);
    if (!profile) {
      const snapshot = payload.profileSnapshot;
      if (!snapshot || snapshot.id !== payload.programId || !Array.isArray(snapshot.courses)) throw new Error('方案中的专业不存在，且文件未包含有效课程快照。');
      profile = snapshot;
      setCustomProfiles(prev => [...prev.filter(item => item.id !== snapshot.id), snapshot]);
    } else if (payload.profileSnapshot) {
      const base = baseData.programProfiles.find(item => item.id === payload.programId) ?? customProfiles.find(item => item.id === payload.programId) ?? profile;
      const reviews = reviewsFromSnapshot(base, payload.profileSnapshot);
      setProfileReviews(prev => ({ ...prev, [payload.programId]: reviews }));
    }
    const config = { ...defaultConstraintConfig(profile), ...payload.config };
    setProgramId(payload.programId);
    setActions(payload.actions);
    setIncludeShared(Boolean(payload.includeShared));
    setConstraintConfigs(prev => ({ ...prev, [payload.programId]: config }));
  };
  const reset = () => {
    setActions(structuredClone(data.defaultActions));
    setConstraintConfigs(Object.fromEntries(data.programProfiles.map(profile => [profile.id, defaultConstraintConfig(profile)])));
    setLanding(80); setGrowth(6); setScenario('baseline'); setTargetHours(64); setIncludeShared(false);
  };
  return <div className={present ? 'app presentation' : 'app'}>
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Network size={27} /></div><div><strong>产教智对</strong><span>CHANJIAO INTELLIGENCE</span></div><button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
      <div className="competition-label">第二届北京市大学生<br />「人工智能+」创新大赛</div>
      <nav>{pages.map(item => { const Icon = item.icon; return <button key={item.key} className={page === item.key ? 'active' : ''} onClick={() => navigate(item.key)}><span className="nav-index">{item.index}</span><Icon size={19} /><strong>{item.label}</strong>{page === item.key && <i />}</button>; })}</nav>
      <div className="sidebar-bottom"><div className="offline-status"><i /><div><strong>离线数据包已加载</strong><span>{data.sources.length} 个核心来源 · 可复核</span></div></div><div className="team"><span>航材队</span><small>「产教智对」赛题 · 2026</small></div></div>
    </aside>
    {mobileOpen && <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} />}
    <main className="main-shell">
      <header className="topbar"><button className="menu-button" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><div className="breadcrumb"><span>产教智对</span><ChevronRight size={14} /><strong>{current.label}</strong></div><div className="topbar-right"><span className="academic-tag">产业需求与高校专业动态适配智能分析平台</span><button className="present-button" onClick={togglePresent}>{present ? <Minimize size={16} /> : <Expand size={16} />}{present ? '退出演示' : '演示模式'}</button></div></header>
      {present && <div className="presentation-banner"><span>{current.index} / 05</span><strong>{current.conclusion}</strong><button onClick={togglePresent} aria-label="退出演示"><Minimize size={18} /></button></div>}
      <div className="content">
        {page === 'overview' && <Overview data={data} onSource={setSource} onNavigate={navigate} />}
        {page === 'gaps' && <GapAnalysis data={data} onSource={setSource} />}
        {page === 'designer' && <Designer data={data} actions={actions} setActions={setActions} programId={programId} setProgramId={setProgramId} config={constraintConfigs[programId]} setConfig={config => setConstraintConfigs(prev => ({ ...prev, [programId]: config }))} targetHours={targetHours} landing={landing} growth={growth} includeShared={includeShared} setIncludeShared={setIncludeShared} onReset={reset} onSource={setSource} onImportProfile={importProfile} onImportDecision={importDecision} onDeleteProfile={deleteProfile} onReviewCourse={reviewCourse} />}
        {page === 'effects' && <Effects data={data} actions={actions} programId={programId} includeShared={includeShared} setIncludeShared={setIncludeShared} targetHours={targetHours} setTargetHours={setTargetHours} scenario={scenario} setScenario={setScenario} landing={landing} setLanding={setLanding} growth={growth} setGrowth={setGrowth} simulation={simulation} setSimulation={setSimulation} onSource={setSource} />}
        {page === 'method' && <Methodology data={data} onSource={setSource} />}
      </div>
      {present && <div className="presentation-nav"><button disabled={current.index === '01'} onClick={() => navigate(pages[Number(current.index) - 2].key)}><ChevronLeft size={18} />上一页</button><span>{pages.map(item => <i key={item.key} className={item.key === page ? 'active' : ''} />)}</span><button disabled={current.index === '05'} onClick={() => navigate(pages[Number(current.index)].key)}>下一页<ChevronRight size={18} /></button></div>}
    </main>
    <SourceDialog source={source} onClose={() => setSource(null)} />
  </div>;
}
