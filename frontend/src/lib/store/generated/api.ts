import { apiSlice as api } from "../apiSlice";
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    signUpApiAuthSignupPost: build.mutation<
      SignUpApiAuthSignupPostApiResponse,
      SignUpApiAuthSignupPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/auth/signup`,
        method: "POST",
        body: queryArg.signUpRequest,
      }),
    }),
    signInApiAuthSigninPost: build.mutation<
      SignInApiAuthSigninPostApiResponse,
      SignInApiAuthSigninPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/auth/signin`,
        method: "POST",
        body: queryArg.signInRequest,
      }),
    }),
    refreshTokenApiAuthRefreshPost: build.mutation<
      RefreshTokenApiAuthRefreshPostApiResponse,
      RefreshTokenApiAuthRefreshPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/auth/refresh`,
        method: "POST",
        body: queryArg.refreshTokenRequest,
      }),
    }),
    getProfileApiAuthProfileGet: build.query<
      GetProfileApiAuthProfileGetApiResponse,
      GetProfileApiAuthProfileGetApiArg
    >({
      query: () => ({ url: `/api/auth/profile` }),
    }),
    signOutApiAuthSignoutPost: build.mutation<
      SignOutApiAuthSignoutPostApiResponse,
      SignOutApiAuthSignoutPostApiArg
    >({
      query: () => ({ url: `/api/auth/signout`, method: "POST" }),
    }),
    sendMessageApiWhatsappSendPost: build.mutation<
      SendMessageApiWhatsappSendPostApiResponse,
      SendMessageApiWhatsappSendPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/whatsapp/send`,
        method: "POST",
        body: queryArg.sendMessageRequest,
      }),
    }),
    getMessagesApiWhatsappMessagesGet: build.query<
      GetMessagesApiWhatsappMessagesGetApiResponse,
      GetMessagesApiWhatsappMessagesGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/whatsapp/messages`,
        params: {
          page: queryArg.page,
          page_size: queryArg.pageSize,
          phone: queryArg.phone,
        },
      }),
    }),
    getDeviceStatusApiWhatsappStatusGet: build.query<
      GetDeviceStatusApiWhatsappStatusGetApiResponse,
      GetDeviceStatusApiWhatsappStatusGetApiArg
    >({
      query: () => ({ url: `/api/whatsapp/status` }),
    }),
    sendAlertApiWhatsappAlertPost: build.mutation<
      SendAlertApiWhatsappAlertPostApiResponse,
      SendAlertApiWhatsappAlertPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/whatsapp/alert`,
        method: "POST",
        body: queryArg.whatsAppAlert,
      }),
    }),
    createReadingApiIotReadingsPost: build.mutation<
      CreateReadingApiIotReadingsPostApiResponse,
      CreateReadingApiIotReadingsPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/readings`,
        method: "POST",
        body: queryArg.ioTReadingCreate,
      }),
    }),
    getReadingsApiIotReadingsGet: build.query<
      GetReadingsApiIotReadingsGetApiResponse,
      GetReadingsApiIotReadingsGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/readings`,
        params: {
          zone_id: queryArg.zoneId,
          start_date: queryArg.startDate,
          end_date: queryArg.endDate,
          columns: queryArg.columns,
          anomalies_only: queryArg.anomaliesOnly,
          irrigation_only: queryArg.irrigationOnly,
          limit: queryArg.limit,
          offset: queryArg.offset,
        },
      }),
    }),
    createBatchApiIotReadingsBatchPost: build.mutation<
      CreateBatchApiIotReadingsBatchPostApiResponse,
      CreateBatchApiIotReadingsBatchPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/readings/batch`,
        method: "POST",
        body: queryArg.ioTBatchCreate,
      }),
    }),
    latestPerZoneApiIotReadingsLatestGet: build.query<
      LatestPerZoneApiIotReadingsLatestGetApiResponse,
      LatestPerZoneApiIotReadingsLatestGetApiArg
    >({
      query: () => ({ url: `/api/iot/readings/latest` }),
    }),
    analyzeZoneApiIotAnalyzeZoneIdGet: build.query<
      AnalyzeZoneApiIotAnalyzeZoneIdGetApiResponse,
      AnalyzeZoneApiIotAnalyzeZoneIdGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/analyze/${queryArg.zoneId}`,
        params: {
          hours: queryArg.hours,
        },
      }),
    }),
    getDashboardApiIotDashboardGet: build.query<
      GetDashboardApiIotDashboardGetApiResponse,
      GetDashboardApiIotDashboardGetApiArg
    >({
      query: () => ({ url: `/api/iot/dashboard` }),
    }),
    listAlertRulesApiIotAlertsRulesGet: build.query<
      ListAlertRulesApiIotAlertsRulesGetApiResponse,
      ListAlertRulesApiIotAlertsRulesGetApiArg
    >({
      query: () => ({ url: `/api/iot/alerts/rules` }),
    }),
    createAlertRuleApiIotAlertsRulesPost: build.mutation<
      CreateAlertRuleApiIotAlertsRulesPostApiResponse,
      CreateAlertRuleApiIotAlertsRulesPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/alerts/rules`,
        method: "POST",
        body: queryArg.alertRuleCreate,
      }),
    }),
    deleteAlertRuleApiIotAlertsRulesRuleIdDelete: build.mutation<
      DeleteAlertRuleApiIotAlertsRulesRuleIdDeleteApiResponse,
      DeleteAlertRuleApiIotAlertsRulesRuleIdDeleteApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/alerts/rules/${queryArg.ruleId}`,
        method: "DELETE",
      }),
    }),
    getSimulatorStatusApiIotSimulatorStatusGet: build.query<
      GetSimulatorStatusApiIotSimulatorStatusGetApiResponse,
      GetSimulatorStatusApiIotSimulatorStatusGetApiArg
    >({
      query: () => ({ url: `/api/iot/simulator/status` }),
    }),
    startSimulatorApiIotSimulatorStartPost: build.mutation<
      StartSimulatorApiIotSimulatorStartPostApiResponse,
      StartSimulatorApiIotSimulatorStartPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/simulator/start`,
        method: "POST",
        params: {
          zones: queryArg.zones,
          interval: queryArg.interval,
        },
      }),
    }),
    stopSimulatorApiIotSimulatorStopPost: build.mutation<
      StopSimulatorApiIotSimulatorStopPostApiResponse,
      StopSimulatorApiIotSimulatorStopPostApiArg
    >({
      query: () => ({ url: `/api/iot/simulator/stop`, method: "POST" }),
    }),
    forecastApiPredictionsForecastPost: build.mutation<
      ForecastApiPredictionsForecastPostApiResponse,
      ForecastApiPredictionsForecastPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/predictions/forecast`,
        method: "POST",
        body: queryArg.forecastRequest,
      }),
    }),
    detectAnomaliesApiPredictionsAnomaliesPost: build.mutation<
      DetectAnomaliesApiPredictionsAnomaliesPostApiResponse,
      DetectAnomaliesApiPredictionsAnomaliesPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/predictions/anomalies`,
        method: "POST",
        body: queryArg.anomalyRequest,
      }),
    }),
    getHistoryApiPredictionsHistoryGet: build.query<
      GetHistoryApiPredictionsHistoryGetApiResponse,
      GetHistoryApiPredictionsHistoryGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/predictions/history`,
        params: {
          limit: queryArg.limit,
        },
      }),
    }),
    chatApiAiChatPost: build.mutation<
      ChatApiAiChatPostApiResponse,
      ChatApiAiChatPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/ai/chat`,
        method: "POST",
        body: queryArg.chatRequest,
      }),
    }),
    getChatHistoryApiAiChatConversationIdGet: build.query<
      GetChatHistoryApiAiChatConversationIdGetApiResponse,
      GetChatHistoryApiAiChatConversationIdGetApiArg
    >({
      query: (queryArg) => ({ url: `/api/ai/chat/${queryArg.conversationId}` }),
    }),
    rootGet: build.query<RootGetApiResponse, RootGetApiArg>({
      query: () => ({ url: `/` }),
    }),
    healthCheckHealthGet: build.query<
      HealthCheckHealthGetApiResponse,
      HealthCheckHealthGetApiArg
    >({
      query: () => ({ url: `/health` }),
    }),
    dashboardDashboardGet: build.query<
      DashboardDashboardGetApiResponse,
      DashboardDashboardGetApiArg
    >({
      query: () => ({ url: `/dashboard` }),
    }),
    getLatestApiLatestGet: build.query<
      GetLatestApiLatestGetApiResponse,
      GetLatestApiLatestGetApiArg
    >({
      query: () => ({ url: `/api/latest` }),
    }),
    sseEventsApiEventsGet: build.query<
      SseEventsApiEventsGetApiResponse,
      SseEventsApiEventsGetApiArg
    >({
      query: () => ({ url: `/api/events` }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as enhancedApi };
export type SignUpApiAuthSignupPostApiResponse =
  /** status 200 Successful Response */ AuthResponse;
export type SignUpApiAuthSignupPostApiArg = {
  signUpRequest: SignUpRequest;
};
export type SignInApiAuthSigninPostApiResponse =
  /** status 200 Successful Response */ AuthResponse;
export type SignInApiAuthSigninPostApiArg = {
  signInRequest: SignInRequest;
};
export type RefreshTokenApiAuthRefreshPostApiResponse =
  /** status 200 Successful Response */ AuthResponse;
export type RefreshTokenApiAuthRefreshPostApiArg = {
  refreshTokenRequest: RefreshTokenRequest;
};
export type GetProfileApiAuthProfileGetApiResponse =
  /** status 200 Successful Response */ UserProfile;
export type GetProfileApiAuthProfileGetApiArg = void;
export type SignOutApiAuthSignoutPostApiResponse =
  /** status 200 Successful Response */ any;
export type SignOutApiAuthSignoutPostApiArg = void;
export type SendMessageApiWhatsappSendPostApiResponse =
  /** status 200 Successful Response */ WhatsAppMessageResponse;
export type SendMessageApiWhatsappSendPostApiArg = {
  sendMessageRequest: SendMessageRequest;
};
export type GetMessagesApiWhatsappMessagesGetApiResponse =
  /** status 200 Successful Response */ WhatsAppMessagesListResponse;
export type GetMessagesApiWhatsappMessagesGetApiArg = {
  page?: number;
  pageSize?: number;
  phone?: string | null;
};
export type GetDeviceStatusApiWhatsappStatusGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetDeviceStatusApiWhatsappStatusGetApiArg = void;
export type SendAlertApiWhatsappAlertPostApiResponse =
  /** status 200 Successful Response */ WhatsAppMessageResponse;
export type SendAlertApiWhatsappAlertPostApiArg = {
  whatsAppAlert: WhatsAppAlert;
};
export type CreateReadingApiIotReadingsPostApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type CreateReadingApiIotReadingsPostApiArg = {
  ioTReadingCreate: IoTReadingCreate;
};
export type GetReadingsApiIotReadingsGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetReadingsApiIotReadingsGetApiArg = {
  /** Filter by zone */
  zoneId?: number | null;
  /** ISO datetime start */
  startDate?: string | null;
  /** ISO datetime end */
  endDate?: string | null;
  /** Comma-separated column names */
  columns?: string | null;
  anomaliesOnly?: boolean;
  irrigationOnly?: boolean;
  limit?: number;
  offset?: number;
};
export type CreateBatchApiIotReadingsBatchPostApiResponse =
  /** status 200 Successful Response */ IoTBatchResponse;
export type CreateBatchApiIotReadingsBatchPostApiArg = {
  ioTBatchCreate: IoTBatchCreate;
};
export type LatestPerZoneApiIotReadingsLatestGetApiResponse =
  /** status 200 Successful Response */ any;
export type LatestPerZoneApiIotReadingsLatestGetApiArg = void;
export type AnalyzeZoneApiIotAnalyzeZoneIdGetApiResponse =
  /** status 200 Successful Response */ any;
export type AnalyzeZoneApiIotAnalyzeZoneIdGetApiArg = {
  zoneId: number;
  /** Lookback period in hours */
  hours?: number;
};
export type GetDashboardApiIotDashboardGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetDashboardApiIotDashboardGetApiArg = void;
export type ListAlertRulesApiIotAlertsRulesGetApiResponse =
  /** status 200 Successful Response */ AlertRuleResponse[];
export type ListAlertRulesApiIotAlertsRulesGetApiArg = void;
export type CreateAlertRuleApiIotAlertsRulesPostApiResponse =
  /** status 200 Successful Response */ any;
export type CreateAlertRuleApiIotAlertsRulesPostApiArg = {
  alertRuleCreate: AlertRuleCreate;
};
export type DeleteAlertRuleApiIotAlertsRulesRuleIdDeleteApiResponse =
  /** status 200 Successful Response */ any;
export type DeleteAlertRuleApiIotAlertsRulesRuleIdDeleteApiArg = {
  ruleId: string;
};
export type GetSimulatorStatusApiIotSimulatorStatusGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetSimulatorStatusApiIotSimulatorStatusGetApiArg = void;
export type StartSimulatorApiIotSimulatorStartPostApiResponse =
  /** status 200 Successful Response */ any;
export type StartSimulatorApiIotSimulatorStartPostApiArg = {
  /** Number of zones */
  zones?: number;
  /** Seconds between readings */
  interval?: number;
};
export type StopSimulatorApiIotSimulatorStopPostApiResponse =
  /** status 200 Successful Response */ any;
export type StopSimulatorApiIotSimulatorStopPostApiArg = void;
export type ForecastApiPredictionsForecastPostApiResponse =
  /** status 200 Successful Response */ ForecastResponse;
export type ForecastApiPredictionsForecastPostApiArg = {
  forecastRequest: ForecastRequest;
};
export type DetectAnomaliesApiPredictionsAnomaliesPostApiResponse =
  /** status 200 Successful Response */ AnomalyResponse;
export type DetectAnomaliesApiPredictionsAnomaliesPostApiArg = {
  anomalyRequest: AnomalyRequest;
};
export type GetHistoryApiPredictionsHistoryGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetHistoryApiPredictionsHistoryGetApiArg = {
  limit?: number;
};
export type ChatApiAiChatPostApiResponse =
  /** status 200 Successful Response */ ChatResponse;
export type ChatApiAiChatPostApiArg = {
  chatRequest: ChatRequest;
};
export type GetChatHistoryApiAiChatConversationIdGetApiResponse =
  /** status 200 Successful Response */ ChatMessage[];
export type GetChatHistoryApiAiChatConversationIdGetApiArg = {
  conversationId: string;
};
export type RootGetApiResponse = /** status 200 Successful Response */ any;
export type RootGetApiArg = void;
export type HealthCheckHealthGetApiResponse =
  /** status 200 Successful Response */ any;
export type HealthCheckHealthGetApiArg = void;
export type DashboardDashboardGetApiResponse = unknown;
export type DashboardDashboardGetApiArg = void;
export type GetLatestApiLatestGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetLatestApiLatestGetApiArg = void;
export type SseEventsApiEventsGetApiResponse =
  /** status 200 Successful Response */ any;
export type SseEventsApiEventsGetApiArg = void;
export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  user: {
    [key: string]: any;
  };
};
export type ValidationError = {
  loc: (string | number)[];
  msg: string;
  type: string;
  input?: any;
  ctx?: object;
};
export type HttpValidationError = {
  detail?: ValidationError[];
};
export type SignUpRequest = {
  email: string;
  password: string;
  full_name?: string | null;
  phone?: string | null;
};
export type SignInRequest = {
  email: string;
  password: string;
};
export type RefreshTokenRequest = {
  refresh_token: string;
};
export type UserProfile = {
  id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
};
export type WhatsAppMessageResponse = {
  success: boolean;
  message_id?: string | null;
  status: string;
  detail?: string | null;
};
export type SendMessageRequest = {
  /** Recipient phone number with country code, e.g. +212612345678 */
  phone: string;
  message: string;
};
export type WhatsAppMessage = {
  id?: string | null;
  phone: string;
  message: string;
  direction?: string;
  status?: string | null;
  timestamp?: string | null;
  metadata?: {
    [key: string]: any;
  } | null;
};
export type WhatsAppMessagesListResponse = {
  messages: WhatsAppMessage[];
  total: number;
  page: number;
  page_size: number;
};
export type WhatsAppAlert = {
  phone: string;
  alert_type: string;
  sensor_id?: string | null;
  value?: number | null;
  threshold?: number | null;
  message?: string | null;
};
export type IoTReadingCreate = {
  timestamp: string;
  month?: number | null;
  hour?: number | null;
  /** Irrigation zone (1-based) */
  zone_id: number;
  plant_type?: string;
  plant_species?: string;
  air_temperature_c?: number | null;
  air_humidity_pct?: number | null;
  air_pressure_hpa?: number | null;
  light_intensity_lux?: number | null;
  reservoir_level_pct?: number | null;
  main_pressure_mpa?: number | null;
  filter_status?: number | null;
  valve_open?: number | null;
  zone_flow_lpm?: number | null;
  zone_pressure_mpa?: number | null;
  soil_moisture_pct?: number | null;
  solar_radiation_wm2?: number | null;
  precipitation_mm?: number | null;
  wind_speed_kmh?: number | null;
  cloud_cover_pct?: number | null;
  is_anomaly?: number | null;
  stress_score?: number | null;
  stress_class?: string | null;
  health_score?: number | null;
  irrigation_needed?: number | null;
};
export type IoTBatchResponse = {
  inserted: number;
  failed: number;
  errors?: string[];
};
export type IoTBatchCreate = {
  readings: IoTReadingCreate[];
};
export type AlertRuleResponse = {
  name: string;
  /** Column to monitor */
  target_column: string;
  condition?: "above" | "below" | "equals";
  threshold: number;
  /** NULL = all zones */
  zone_id?: number | null;
  notify_whatsapp?: boolean;
  phone?: string | null;
  message_template?: string | null;
  id: string;
  user_id: string;
  is_active: boolean;
  created_at: string;
};
export type AlertRuleCreate = {
  name: string;
  /** Column to monitor */
  target_column: string;
  condition?: "above" | "below" | "equals";
  threshold: number;
  /** NULL = all zones */
  zone_id?: number | null;
  notify_whatsapp?: boolean;
  phone?: string | null;
  message_template?: string | null;
};
export type ForecastPoint = {
  timestamp: string;
  predicted_value: number;
  lower_bound: number;
  upper_bound: number;
};
export type ForecastResponse = {
  target_column: string;
  zone_id: number | null;
  model: string;
  accuracy_r2: number | null;
  trend_direction: string;
  trend_slope_per_hour: number;
  current_value: number | null;
  forecast: ForecastPoint[];
  recommendations: string[];
};
export type ForecastRequest = {
  /** Column to forecast (e.g. soil_moisture_pct) */
  target_column: string;
  /** Zone to forecast (None = aggregate) */
  zone_id?: number | null;
  /** Historical data to use */
  lookback_hours?: number;
  /** Hours to predict ahead */
  forecast_hours?: number;
};
export type AnomalyPoint = {
  timestamp: string;
  value: number;
  z_score: number;
  expected_range: {
    [key: string]: any;
  };
};
export type AnomalyResponse = {
  target_column: string;
  zone_id: number | null;
  total_checked: number;
  anomalies_found: number;
  anomaly_rate_pct: number;
  z_threshold: number;
  anomalies: AnomalyPoint[];
  recommendations: string[];
};
export type AnomalyRequest = {
  /** Column to check */
  target_column: string;
  zone_id?: number | null;
  lookback_hours?: number;
  /** Z-score threshold */
  z_threshold?: number;
};
export type ChatResponse = {
  response: string;
  conversation_id: string;
};
export type ChatRequest = {
  message: string;
  /** Thread ID for multi-turn */
  conversation_id?: string | null;
};
export type ChatMessage = {
  role: string;
  content: string;
  created_at?: string | null;
};
export const {
  useSignUpApiAuthSignupPostMutation,
  useSignInApiAuthSigninPostMutation,
  useRefreshTokenApiAuthRefreshPostMutation,
  useGetProfileApiAuthProfileGetQuery,
  useSignOutApiAuthSignoutPostMutation,
  useSendMessageApiWhatsappSendPostMutation,
  useGetMessagesApiWhatsappMessagesGetQuery,
  useGetDeviceStatusApiWhatsappStatusGetQuery,
  useSendAlertApiWhatsappAlertPostMutation,
  useCreateReadingApiIotReadingsPostMutation,
  useGetReadingsApiIotReadingsGetQuery,
  useCreateBatchApiIotReadingsBatchPostMutation,
  useLatestPerZoneApiIotReadingsLatestGetQuery,
  useAnalyzeZoneApiIotAnalyzeZoneIdGetQuery,
  useGetDashboardApiIotDashboardGetQuery,
  useListAlertRulesApiIotAlertsRulesGetQuery,
  useCreateAlertRuleApiIotAlertsRulesPostMutation,
  useDeleteAlertRuleApiIotAlertsRulesRuleIdDeleteMutation,
  useGetSimulatorStatusApiIotSimulatorStatusGetQuery,
  useStartSimulatorApiIotSimulatorStartPostMutation,
  useStopSimulatorApiIotSimulatorStopPostMutation,
  useForecastApiPredictionsForecastPostMutation,
  useDetectAnomaliesApiPredictionsAnomaliesPostMutation,
  useGetHistoryApiPredictionsHistoryGetQuery,
  useChatApiAiChatPostMutation,
  useGetChatHistoryApiAiChatConversationIdGetQuery,
  useRootGetQuery,
  useHealthCheckHealthGetQuery,
  useDashboardDashboardGetQuery,
  useGetLatestApiLatestGetQuery,
  useSseEventsApiEventsGetQuery,
} = injectedRtkApi;
