export type EventType =
  | "navigation"
  | "interaction"
  | "engagement"
  | "authentication"
  | "communication"
  | "commerce"
  | "system"
  | "custom";

export type EventCategory =
  // Navigation
  | "navigation.page_view"
  | "navigation.route_change"
  | "navigation.exit"
  // Interaction
  | "interaction.click"
  | "interaction.hover"
  | "interaction.submit"
  | "interaction.focus"
  | "interaction.blur"
  | "interaction.change"
  | "interaction.scroll"
  // Engagement
  | "engagement.time_on_page"
  | "engagement.scroll_depth"
  | "engagement.visibility"
  // Authentication
  | "authentication.login"
  | "authentication.logout"
  | "authentication.signup"
  | "authentication.password_reset"
  // Commerce
  | "commerce.view_item"
  | "commerce.view_item_list"
  | "commerce.select_item"
  | "commerce.add_to_cart"
  | "commerce.remove_from_cart"
  | "commerce.view_cart"
  | "commerce.begin_checkout"
  | "commerce.add_shipping_info"
  | "commerce.add_payment_info"
  | "commerce.purchase"
  | "commerce.refund"
  | "commerce.promotion_view"
  | "commerce.promotion_select"
  // Communication
  | "communication.chat_start"
  | "communication.chat_message"
  | "communication.chat_end"
  | "communication.email_click"
  | "communication.phone_click"
  // System
  | "system.error"
  | "system.performance"
  | "system.crash"
  // Custom or fallback
  | (string & {});

export interface PlatformClickIds {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  ttclid?: string;
  ttp?: string;
  twclid?: string;
  msclkid?: string;
  li_fat_id?: string;
  epik?: string;
  dclid?: string;
  ScCid?: string;
  liveramp_ats_id?: string;
  [key: string]: string | undefined;
}

export interface CommerceItem {
  affiliation?: string;
  coupon?: string;
  currency?: string;
  discount?: number;
  index?: number;
  item_brand?: string;
  item_category?: string;
  item_category2?: string;
  item_category3?: string;
  item_id?: string;
  item_list_id?: string;
  item_list_name?: string;
  item_name?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
}

export interface TargetProps {
  affiliation?: string;
  auth_method?: string;
  auth_provider?: string;
  button_id?: string;
  button_name?: string;
  click_x?: number;
  click_y?: number;
  component?: string;
  component_name?: string;
  coupon?: string;
  currency?: string;
  custom?: Record<string, any>;
  duration_ms?: number;
  element_class?: string;
  element_id?: string;
  element_name?: string;
  element_selector?: string;
  element_text?: string;
  element_type?: string;
  element_x?: number;
  element_y?: number;
  error_code?: string;
  error_message?: string;
  error_severity?: "info" | "warning" | "error" | "fatal";
  error_stack?: string;
  feature?: string;
  form_completion_pct?: number;
  form_field?: string;
  form_field_count?: number;
  form_id?: string;
  form_name?: string;
  form_value_hash?: string;
  href?: string;
  http_status?: number;
  is_new_user?: boolean;
  items?: CommerceItem[];
  media_current_time_ms?: number;
  media_duration_ms?: number;
  media_fullscreen?: boolean;
  media_id?: string;
  media_percent?: number;
  media_provider?: string;
  media_quality?: string;
  media_sound_on?: boolean;
  media_title?: string;
  media_type?: "audio" | "video";
  mouse_button?: "left" | "middle" | "right";
  page_name?: string;
  payment_type?: string;
  priority?: "low" | "medium" | "high";
  scroll_depth_px?: number;
  scroll_direction?: "up" | "down" | "left" | "right";
  scroll_percent?: number;
  search_filters?: Record<string, string>;
  search_results_count?: number;
  search_term?: string;
  share_method?: string;
  share_platform?: string;
  shipping?: number;
  shipping_tier?: string;
  tax?: number;
  transaction_id?: string;
  value?: number;
  [key: string]: any;
}

export interface CreatePageViewRequest {
  url: string;
  referrer: string;
  title: string;
}

export interface CreateCustomEventRequest {
  category: EventCategory;
  type: EventType;
  name: string;
  occurred_at: string;
  page_id?: number;
  schema_version?: string;
  sdk_name?: string;
  sdk_version?: string;
  sequence?: number;
  click_ids?: PlatformClickIds;
  target?: TargetProps;
}
