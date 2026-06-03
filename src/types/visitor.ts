export interface CreateVisitorRequest {
  browser: string;
  browser_version: string;
  os: string;
  device_type: string;
  fingerprint_hash: string;
  screen_width: number;
  screen_height: number;
  language: string;
  timezone: string;
  entry_page: string;
  referrer_host: string;
  previous_site: string;
  acquisition_source?: string;
  acquisition_medium?: string;
  acquisition_campaign?: string;
  campaign_id?: string;
  campaign_content?: string;
  campaign_term?: string;
}

export interface VisitorResponse {
  uuid: string;
  session_id: string;
  first_seen_at: string;
  last_seen_at: string;
  is_bot: boolean;
  is_verified_human: boolean;
  primary_user_id: string | null;
}
