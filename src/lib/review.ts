import type { ProgramProfile, Row } from '../types';

export type CourseReviewMap = Record<string, Row>;

export function refreshProfile(profile: ProgramProfile): ProgramProfile {
  const coverageMap = new Map<string, { hours: number; count: number }>();
  for (const course of profile.courses) {
    const skills = String(course['技能标准名'] ?? '').split(/[、;；]/).map(value => value.trim()).filter(Boolean);
    for (const skill of new Set(skills)) {
      const current = coverageMap.get(skill) ?? { hours: 0, count: 0 };
      coverageMap.set(skill, { hours: current.hours + Number(course['学时'] || 0), count: current.count + 1 });
    }
  }
  const coverage = [...coverageMap.entries()].map(([skill, value]) => ({ 专业: profile.name, 技能标准ID: `REVIEW-${skill}`, 技能标准名: skill, 核心供给学时: value.hours, 核心课程门数: value.count }));
  const semesters = [...new Set(profile.courses.map(course => String(course['开课学期'] ?? '').trim()))];
  const semesterLoads = semesters.map(semester => ({ semester, hours: profile.courses.filter(course => String(course['开课学期'] ?? '').trim() === semester).reduce((sum, course) => sum + Number(course['学时'] || 0), 0) }));
  const mappedCourses = profile.courses.filter(course => String(course['技能标准名'] ?? '').trim()).length;
  const confirmedZeroCourses = profile.courses.filter(course => course['映射状态'] === '已确认无映射').length;
  const hasCompleteSemesters = profile.courses.every(course => String(course['开课学期'] ?? '').trim() && course['开课学期'] !== '未分配');
  const hasCourseTypes = profile.courses.every(course => ['必修', '选修'].includes(String(course['课程性质'])));
  return {
    ...profile,
    totalHours: profile.courses.reduce((sum, course) => sum + Number(course['学时'] || 0), 0),
    totalCredits: Number(profile.courses.reduce((sum, course) => sum + Number(course['学分'] || 0), 0).toFixed(2)),
    requiredHours: hasCourseTypes ? profile.courses.filter(course => course['课程性质'] === '必修').reduce((sum, course) => sum + Number(course['学时'] || 0), 0) : null,
    semesterLoads, coverage,
    dataQuality: {
      mappedCourses, confirmedZeroCourses,
      pendingMappingCourses: profile.courseCount - mappedCourses - confirmedZeroCourses,
      hasCompleteSemesters, hasCourseTypes,
      approvedReplacementCourses: profile.courses.filter(course => course['置换资格'] === '可置换').length,
      prerequisiteCourses: profile.courses.filter(course => String(course['先修'] ?? '').trim()).length,
      classifiedCredits: Number(profile.courses.filter(course => String(course['course_cat_norm'] ?? '').trim()).reduce((sum, course) => sum + Number(course['学分'] || 0), 0).toFixed(2)),
    },
  };
}

export function applyCourseReviews(profile: ProgramProfile, reviews: CourseReviewMap): ProgramProfile {
  const entries = Object.entries(reviews);
  if (!entries.length) return profile;
  const allowed = new Set(['开课学期', 'course_cat_norm', 'course_type_norm', '技能标准名', '映射状态', '置换资格', '先修']);
  const courses = profile.courses.map(course => {
    const patch = reviews[String(course['课程ID'])];
    if (!patch) return course;
    const clean = Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.has(key)));
    if (String(clean['技能标准名'] ?? '').trim()) clean['映射状态'] = '';
    return { ...course, ...clean };
  });
  const reviewed = refreshProfile({ ...profile, courses });
  reviewed.basis = reviewed.basis.includes('本地复核') ? reviewed.basis : `${reviewed.basis} · 含本地复核`;
  return reviewed;
}

export function downloadReviewedCsv(profile: ProgramProfile) {
  const headers = ['课程ID', '课名', '学分', '学时', '开课学期', '课程性质', '技能标准名', '映射状态', '置换资格', '先修', '课程分类', '课程类型', '专业名称'];
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = profile.courses.map(course => [course['课程ID'], course['课名'], course['学分'], course['学时'], course['开课学期'], course['课程性质'], course['技能标准名'], course['映射状态'], course['置换资格'], course['先修'], course['course_cat_norm'], course['course_type_norm'], profile.name].map(escape).join(','));
  const blob = new Blob(['\uFEFF' + headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `${profile.shortName}_复核课程底表.csv`; link.click(); URL.revokeObjectURL(url);
}

export function reviewsFromSnapshot(base: ProgramProfile, snapshot: ProgramProfile): CourseReviewMap {
  const fields = ['开课学期', 'course_cat_norm', 'course_type_norm', '技能标准名', '映射状态', '置换资格', '先修'];
  const reviews: CourseReviewMap = {};
  for (const course of snapshot.courses) {
    const original = base.courses.find(item => String(item['课程ID']) === String(course['课程ID']));
    if (!original) continue;
    const patch = Object.fromEntries(fields.filter(field => String(original[field] ?? '') !== String(course[field] ?? '')).map(field => [field, course[field] ?? '']));
    if (Object.keys(patch).length) reviews[String(course['课程ID'])] = patch;
  }
  return reviews;
}
