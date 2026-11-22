import type { ActionItem, ProgramProfile, Row } from '../types';

export function courseCategory(row: Row): '通识' | '学科基础' | '专业' | '实践' | '未分类' {
  const type = String(row['course_type_norm'] ?? row['课程类型'] ?? '');
  if (/实践|实验|实训/.test(type)) return '实践';
  const category = String(row['course_cat_norm'] ?? row['课程分类'] ?? '');
  if (/综合素养|思政|通识/.test(category)) return '通识';
  if (/数理基础|工程基础|学科基础/.test(category)) return '学科基础';
  if (/专业/.test(category)) return '专业';
  return '未分类';
}

export function categoryCreditAudit(profile: ProgramProfile, actions: ActionItem[], tolerance: number) {
  const active = actions.filter(action => action.enabled && action.type !== '暂不处理');
  const categories = ['通识', '学科基础', '专业', '实践'] as const;
  const before = Object.fromEntries([...categories, '未分类'].map(category => [category, 0])) as Record<string, number>;
  for (const course of profile.courses) before[courseCategory(course)] += Number(course['学分'] || 0);
  const after = { ...before };
  for (const action of active) {
    if (action.hours >= 0) after[action.category ?? '专业'] += action.creditDelta;
    else {
      const sources = (action.sourceCourseIds ?? []).map(id => profile.courses.find(course => String(course['课程ID']) === id)).filter((course): course is Row => Boolean(course));
      if (!sources.length) after['未分类'] += action.creditDelta;
      else {
        const total = sources.reduce((sum, course) => sum + Number(course['学分'] || 0), 0) || 1;
        for (const course of sources) after[courseCategory(course)] += action.creditDelta * Number(course['学分'] || 0) / total;
      }
    }
  }
  const beforeTotal = Object.values(before).reduce((sum, value) => sum + value, 0);
  const afterTotal = Object.values(after).reduce((sum, value) => sum + value, 0);
  const rows = categories.map(category => {
    const beforeShare = beforeTotal ? before[category] / beforeTotal : 0;
    const afterShare = afterTotal ? after[category] / afterTotal : 0;
    const delta = (afterShare - beforeShare) * 100;
    return { category, beforeCredits: before[category], afterCredits: after[category], beforeShare, afterShare, delta, pass: Math.abs(delta) <= tolerance + 0.00001 };
  });
  const unclassifiedBefore = before['未分类'];
  const unclassifiedAfter = after['未分类'];
  return {
    rows, beforeTotal, afterTotal, unclassifiedBefore, unclassifiedAfter,
    complete: Math.abs(unclassifiedAfter) < 0.001 && Math.abs(unclassifiedBefore) < 0.001,
    pass: Math.abs(unclassifiedAfter) < 0.001 && Math.abs(unclassifiedBefore) < 0.001 && rows.every(row => row.pass),
  };
}

function normalizeCourseName(value: string) {
  return value.replace(/[\s（）()【】]/g, '').trim();
}

export function prerequisiteAudit(profile: ProgramProfile, actions: ActionItem[]) {
  const removals = actions.filter(action => action.enabled && action.type === '置换低需求课' && action.hours < 0);
  const removedIds = new Set(removals.flatMap(action => action.sourceCourseIds ?? []));
  const removedNames = new Set(removals.map(action => normalizeCourseName(action.name)));
  const isRemoved = (course: Row) => removedIds.has(String(course['课程ID'])) || removedNames.has(normalizeCourseName(String(course['课名'])));
  const violations: { prerequisite: string; dependent: string; semester: string; action: string }[] = [];
  let knownDependencies = 0;
  let unresolvedReferences = 0;
  for (const dependent of profile.courses) {
    const raw = String(dependent['先修'] ?? '').trim();
    if (!raw || isRemoved(dependent)) continue;
    const parts = raw.split(/[;；\n]/).flatMap(part => /或|\//.test(part) ? [part] : part.split(/[、,，]/)).map(value => value.trim()).filter(Boolean);
    for (const part of parts) {
      const alternatives = part.split(/或|\//).map(value => normalizeCourseName(value)).filter(Boolean);
      const courses = alternatives.map(alternative => profile.courses.find(course => normalizeCourseName(String(course['课名'])) === alternative || normalizeCourseName(String(course['课程ID'])) === alternative));
      if (courses.every(course => !course)) { unresolvedReferences += 1; continue; }
      knownDependencies += 1;
      const failed = courses.every(course => !course || isRemoved(course));
      if (failed) {
        const source = courses.find(Boolean)!;
        const action = removals.find(item => item.sourceCourseIds?.includes(String(source['课程ID'])) || normalizeCourseName(item.name) === normalizeCourseName(String(source['课名'])));
        violations.push({ prerequisite: alternatives.join(' 或 '), dependent: String(dependent['课名']), semester: String(dependent['开课学期']), action: action?.name ?? '课程置换' });
      }
    }
  }
  const fieldCourses = profile.courses.filter(course => String(course['先修'] ?? '').trim()).length;
  return {
    fieldCourses, knownDependencies, unresolvedReferences, violations,
    pass: violations.length ? false : fieldCourses > 0 && knownDependencies > 0 ? true : null,
  };
}

const backgroundRules: Record<string, RegExp> = {
  物理: /物理|量子|力学|半导体/,
  数学: /数学|统计|概率|代数|几何|数理|运筹/,
  金融: /金融|经济|投资|财务|会计|保险/,
  数据: /数据|Python|机器学习|人工智能|统计|挖掘/,
  计算机: /计算机|软件|程序|编程|算法|计算|Python|网络/,
  通信: /通信|信号|网络|6G|信息/,
  法学: /法律|法学|知识产权|合规/,
  创新管理: /创新|创业|管理|技术转移|项目/,
  生物医学: /生物|医学|医疗|医工|药/,
  生物: /生物|基因|细胞|育种|农业/,
};

export function facultyBackgrounds(action: ActionItem) {
  const text = `${action.name} ${action.facultyField ?? ''} ${action.covers.join(' ')}`;
  if (/量子/.test(text)) return ['物理', '数学'];
  if (/科技金融|绿色金融/.test(text)) return ['金融', '数据'];
  if (/机器学习|数据|Python|人工智能/.test(text)) return ['数据', '计算机'];
  if (/知识产权|技术转移/.test(text)) return ['法学', '创新管理'];
  if (/6G|通信/.test(text)) return ['通信', '计算机'];
  if (/网络|安全/.test(text)) return ['计算机', '通信'];
  if (/脑机/.test(text)) return ['生物医学', '计算机'];
  if (/生物|育种|基因|细胞/.test(text)) return ['生物', '数据'];
  const custom = (action.facultyField ?? action.covers[0] ?? action.name).split(/[+、/]|与/).map(value => value.trim()).filter(value => backgroundRules[value]);
  return custom.length ? custom : [action.facultyField ?? action.covers[0] ?? action.name];
}

export function assessFaculty(profile: ProgramProfile, actions: ActionItem[]) {
  return actions.filter(action => action.enabled && action.hours > 0 && ['新增课程', '新增微模块'].includes(action.type)).map(action => {
    const backgrounds = facultyBackgrounds(action);
    const groups = backgrounds.map(background => {
      const rule = backgroundRules[background];
      const matched = rule ? profile.courses.filter(course => rule.test(String(course['课名']))) : [];
      return { background, matched: matched.map(course => String(course['课名'])), score: Math.min(1, matched.length / 2) };
    });
    const score = groups.reduce((sum, group) => sum + group.score, 0) / Math.max(groups.length, 1);
    const level = score >= 0.75 ? '可内部开课' : score >= 0.35 ? '需转型培训' : '建议外聘或校企共建';
    const reason = groups.map(group => group.matched.length ? `${group.background}：${group.matched.length}门相近课程（${group.matched.slice(0, 3).join('、')}）` : `${group.background}：未检出相近课程群`).join('；');
    return { id: action.id, course: action.name, backgrounds, groups, score, level, reason };
  });
}
