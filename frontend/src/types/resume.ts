export interface Resume {
  id: string;
  userId: string;
  title: string;
  templateId: string;
  targetJob?: string;
  targetCompany?: string;
  fontFamily: string;
  fontSize: number;
  themeColor: string;
  layoutConfig: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeSection {
  id: string;
  resumeId: string;
  sectionType: string;
  sortOrder: number;
  isVisible: boolean;
  data: Record<string, unknown> | unknown[];
}

export interface ResumeDetail {
  id: string;
  title: string;
  templateId: string;
  targetJob?: string;
  targetCompany?: string;
  fontFamily: string;
  fontSize: number;
  themeColor: string;
  layoutConfig: string;
  sections: ResumeSection[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnailUrl: string;
  isPremium: boolean;
  config: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  userId: string;
  name: string;
  email: string;
  expiresIn: number;
}

export interface AtsScoreResponse {
  scores: {
    keywords: number;
    skills: number;
    experience: number;
    education: number;
    overall: number;
  };
  suggestions: string[];
}

export interface SectionData {
  sectionType: string;
  sortOrder: number;
  isVisible: boolean;
  data: string;
}
