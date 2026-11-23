export type Row = Record<string, unknown>;

export interface ActionItem {
  id: string;
  name: string;
  scope: string;
  type: '新增课程' | '新增微模块' | '扩容已有课' | '置换低需求课' | '暂不处理';
  hours: number;
  creditDelta: number;
  enabled: boolean;
  covers: string[];
  evidence: string;
  rationale: string;
  semester: string;
  required: boolean;
  programId?: string;
  facultyField?: string;
  custom?: boolean;
  sourceCourseIds?: string[];
  category?: '通识' | '学科基础' | '专业' | '实践';
}

export interface ProgramProfile {
  id: string;
  name: string;
  shortName: string;
  basis: string;
  courseCount: number;
  totalHours: number;
  totalCredits: number;
  requiredHours: number | null;
  semesterCap: number;
  semesterLoads: { semester: string; hours: number }[];
  courses: Row[];
  coverage: Row[];
  sourceFile: string;
  dataQuality: {
    mappedCourses: number;
    confirmedZeroCourses: number;
    pendingMappingCourses: number;
    hasCompleteSemesters: boolean;
    hasCourseTypes: boolean;
    approvedReplacementCourses: number;
    prerequisiteCourses: number;
    classifiedCredits: number;
  };
}

export interface ConstraintConfig {
  totalHours: number;
  totalCredits: number;
  semesterCap: number;
  requiredMin: number;
  requiredMax: number;
  facultyTeams: number | null;
  availableFields: string;
  directionCapacity: number | null;
  expectedStudents: number | null;
  studentReadiness: number | null;
  minReadiness: number;
  labSeats: number | null;
  semesterCreditCap: number;
  categoryTolerance: number;
}

export interface PlatformData {
  generatedAt: string;
  stats: Record<string, number | boolean>;
  courses: Row[];
  mappings: Row[];
  reverseGaps: Row[];
  zeroCourses: Row[];
  doubleZeroSkills: Row[];
  skillDict: Row[];
  cufeCourses: Row[];
  cufeCoverage: Row[];
  programProfiles: ProgramProfile[];
  top30: Row[];
  anchors: Row[];
  industries: Row[];
  demandRows: { skill: string; heat: number; provinces: number; records: number }[];
  policyOutliers: { skill: string; heat: number; provinces: number }[];
  courseOutliers: { id: string; name: string; school: string; hours: number; type: string }[];
  policyBounds: { n: number; q1: number; q3: number; iqr: number; lower: number; upper: number };
  courseBounds: { n: number; q1: number; q3: number; iqr: number; lower: number; upper: number };
  employmentTrend: { region: string; p0: number; p1: number; n0: number | null; n1: number | null }[];
  marketRates: { skill: string; rate: number; keywords: string[] }[];
  salaryCoefficients: { skill: string; effect: number; low: number; high: number }[];
  defaultActions: ActionItem[];
  industryAnnotations: { skills: Row[]; occupations: Row[]; sources: Row[]; skillIndex: Row[]; evidenceNote: string };
  dictionarySheets: Record<string, Record<string, { count: number; sample: Row[] }>>;
  gapSheets: Record<string, { count: number; sample: Row[] }>;
  skillMapSample: Row[];
  sources: { file: string; rows: number; sample: Row[]; sheets?: string[] }[];
  dataWarnings: string[];
}

export type PageKey = 'overview' | 'gaps' | 'designer' | 'effects' | 'method';
export type ScenarioKey = 'optimistic' | 'baseline' | 'pessimistic';

export interface SimulationConfig {
  limit: number;
  smoothing: number;
  threshold: number;
  targetGap: number;
}
