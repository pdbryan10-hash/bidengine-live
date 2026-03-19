export interface TenderQuestion {
  _id: string;
  question_number: string;
  question_text: string;
  answer_text: string;
  evaluation_text: string;
  final_evaluation: string;
  section: string;
  status: string;
  tender: string;
  client_id: number;
  word_limit?: string;
  weighting?: string;
  // n8n tracking fields
  processed_at?: string;
  n8n_execution_id?: string;
  'Modified Date'?: string;
  'Created Date'?: string;
}

export interface Tender {
  _id: string;
  tender_name: string;
  client_id: string;
  file_url: string;
  vector_store_id: string;
  status: string;
  Created_Date: string;
  question_count?: number;
  avg_score?: number;
  processing_time?: number; // seconds taken to process
}

export interface BubbleResponse<T> {
  response: {
    results: T[];
    count: number;
    remaining: number;
  };
}

export interface ParsedScore {
  score: number;
  maxScore: number;
  summary: string;
  complianceChecks: string[];
  evidenceQuality: string[];
}

// BidVault Types
export interface Project {
  _id: string;
  project_id: string;
  project_name: string;
  client_id: string;
  client_name: string;
  client_sector: string;
  contract_type: string;
  contract_value: number;
  contract_value_text: string;
  duration_months: number;
  start_date: string;
  end_date: string;
  our_role: string;
  scope_summary: string;
  relevance_tags: string;
  status: string;
  source_file: string;
  Created_Date: string;
}

export interface ProjectCaseStudy {
  _id: string;
  case_study_id: string;
  case_study_title: string;
  project_id: string;
  client_name: string;
  contract_name: string;
  contract_value: number;
  contract_duration: string;
  sector: string;
  challenge: string;
  solution: string;
  services_delivered: string;
  key_metrics: string;
  testimonial_text: string;
  testimonial_person: string;
  testimonial_role: string;
  Created_Date: string;
  Modified_Date: string;
  // Enriched fields from Project
  _project_name?: string;
  _client_sector?: string;
  _contract_type?: string;
}
