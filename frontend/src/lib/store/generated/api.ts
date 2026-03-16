import { apiSlice as api } from "../apiSlice";
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    debugUserApiAuthDebugUserUsernameGet: build.query<
      DebugUserApiAuthDebugUserUsernameGetApiResponse,
      DebugUserApiAuthDebugUserUsernameGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/auth/debug-user/${queryArg.username}`,
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
    getProfileApiAuthProfileGet: build.query<
      GetProfileApiAuthProfileGetApiResponse,
      GetProfileApiAuthProfileGetApiArg
    >({
      query: () => ({ url: `/api/auth/profile` }),
    }),
    changePasswordApiAuthChangePasswordPost: build.mutation<
      ChangePasswordApiAuthChangePasswordPostApiResponse,
      ChangePasswordApiAuthChangePasswordPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/auth/change-password`,
        method: "POST",
        body: queryArg.changePasswordRequest,
      }),
    }),
    signOutApiAuthSignoutPost: build.mutation<
      SignOutApiAuthSignoutPostApiResponse,
      SignOutApiAuthSignoutPostApiArg
    >({
      query: () => ({ url: `/api/auth/signout`, method: "POST" }),
    }),
    listOwnersApiAdminOwnersGet: build.query<
      ListOwnersApiAdminOwnersGetApiResponse,
      ListOwnersApiAdminOwnersGetApiArg
    >({
      query: () => ({ url: `/api/admin/owners` }),
    }),
    createOwnerWithFarmApiAdminOwnersPost: build.mutation<
      CreateOwnerWithFarmApiAdminOwnersPostApiResponse,
      CreateOwnerWithFarmApiAdminOwnersPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/admin/owners`,
        method: "POST",
        body: queryArg.createOwnerRequest,
      }),
    }),
    getOwnerDetailApiAdminOwnersOwnerIdGet: build.query<
      GetOwnerDetailApiAdminOwnersOwnerIdGetApiResponse,
      GetOwnerDetailApiAdminOwnersOwnerIdGetApiArg
    >({
      query: (queryArg) => ({ url: `/api/admin/owners/${queryArg.ownerId}` }),
    }),
    deleteOwnerApiAdminOwnersOwnerIdDelete: build.mutation<
      DeleteOwnerApiAdminOwnersOwnerIdDeleteApiResponse,
      DeleteOwnerApiAdminOwnersOwnerIdDeleteApiArg
    >({
      query: (queryArg) => ({
        url: `/api/admin/owners/${queryArg.ownerId}`,
        method: "DELETE",
      }),
    }),
    toggleOwnerActiveApiAdminOwnersOwnerIdToggleActivePut: build.mutation<
      ToggleOwnerActiveApiAdminOwnersOwnerIdToggleActivePutApiResponse,
      ToggleOwnerActiveApiAdminOwnersOwnerIdToggleActivePutApiArg
    >({
      query: (queryArg) => ({
        url: `/api/admin/owners/${queryArg.ownerId}/toggle-active`,
        method: "PUT",
      }),
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
    injectAnomalyApiIotSimulatorInjectAnomalyPost: build.mutation<
      InjectAnomalyApiIotSimulatorInjectAnomalyPostApiResponse,
      InjectAnomalyApiIotSimulatorInjectAnomalyPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/simulator/inject/anomaly`,
        method: "POST",
        params: {
          zone_id: queryArg.zoneId,
          anomaly_type: queryArg.anomalyType,
          duration: queryArg.duration,
        },
      }),
    }),
    injectIrrigationApiIotSimulatorInjectIrrigationPost: build.mutation<
      InjectIrrigationApiIotSimulatorInjectIrrigationPostApiResponse,
      InjectIrrigationApiIotSimulatorInjectIrrigationPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/simulator/inject/irrigation`,
        method: "POST",
        params: {
          zone_id: queryArg.zoneId,
          action: queryArg.action,
        },
      }),
    }),
    injectReservoirApiIotSimulatorInjectReservoirPost: build.mutation<
      InjectReservoirApiIotSimulatorInjectReservoirPostApiResponse,
      InjectReservoirApiIotSimulatorInjectReservoirPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/simulator/inject/reservoir`,
        method: "POST",
        params: {
          level: queryArg.level,
        },
      }),
    }),
    injectFilterApiIotSimulatorInjectFilterPost: build.mutation<
      InjectFilterApiIotSimulatorInjectFilterPostApiResponse,
      InjectFilterApiIotSimulatorInjectFilterPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/simulator/inject/filter`,
        method: "POST",
        params: {
          status: queryArg.status,
        },
      }),
    }),
    injectSoilApiIotSimulatorInjectSoilPost: build.mutation<
      InjectSoilApiIotSimulatorInjectSoilPostApiResponse,
      InjectSoilApiIotSimulatorInjectSoilPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/simulator/inject/soil`,
        method: "POST",
        params: {
          zone_id: queryArg.zoneId,
          moisture: queryArg.moisture,
        },
      }),
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
    listFarmsApiFarmsGet: build.query<
      ListFarmsApiFarmsGetApiResponse,
      ListFarmsApiFarmsGetApiArg
    >({
      query: () => ({ url: `/api/farms` }),
    }),
    createFarmApiFarmsPost: build.mutation<
      CreateFarmApiFarmsPostApiResponse,
      CreateFarmApiFarmsPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/farms`,
        method: "POST",
        body: queryArg.farmCreate,
      }),
    }),
    getFarmApiFarmsFarmIdGet: build.query<
      GetFarmApiFarmsFarmIdGetApiResponse,
      GetFarmApiFarmsFarmIdGetApiArg
    >({
      query: (queryArg) => ({ url: `/api/farms/${queryArg.farmId}` }),
    }),
    updateFarmApiFarmsFarmIdPut: build.mutation<
      UpdateFarmApiFarmsFarmIdPutApiResponse,
      UpdateFarmApiFarmsFarmIdPutApiArg
    >({
      query: (queryArg) => ({
        url: `/api/farms/${queryArg.farmId}`,
        method: "PUT",
        body: queryArg.farmUpdate,
      }),
    }),
    deleteFarmApiFarmsFarmIdDelete: build.mutation<
      DeleteFarmApiFarmsFarmIdDeleteApiResponse,
      DeleteFarmApiFarmsFarmIdDeleteApiArg
    >({
      query: (queryArg) => ({
        url: `/api/farms/${queryArg.farmId}`,
        method: "DELETE",
      }),
    }),
    createEmployeeApiFarmsFarmIdEmployeesPost: build.mutation<
      CreateEmployeeApiFarmsFarmIdEmployeesPostApiResponse,
      CreateEmployeeApiFarmsFarmIdEmployeesPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/farms/${queryArg.farmId}/employees`,
        method: "POST",
        body: queryArg.createEmployeeRequest,
      }),
    }),
    listEmployeesApiFarmsFarmIdEmployeesGet: build.query<
      ListEmployeesApiFarmsFarmIdEmployeesGetApiResponse,
      ListEmployeesApiFarmsFarmIdEmployeesGetApiArg
    >({
      query: (queryArg) => ({ url: `/api/farms/${queryArg.farmId}/employees` }),
    }),
    listMembersApiFarmsFarmIdMembersGet: build.query<
      ListMembersApiFarmsFarmIdMembersGetApiResponse,
      ListMembersApiFarmsFarmIdMembersGetApiArg
    >({
      query: (queryArg) => ({ url: `/api/farms/${queryArg.farmId}/members` }),
    }),
    addMemberByIdApiFarmsFarmIdMembersUserIdPost: build.mutation<
      AddMemberByIdApiFarmsFarmIdMembersUserIdPostApiResponse,
      AddMemberByIdApiFarmsFarmIdMembersUserIdPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/farms/${queryArg.farmId}/members/${queryArg.userId}`,
        method: "POST",
      }),
    }),
    updateMemberApiFarmsFarmIdMembersUserIdPut: build.mutation<
      UpdateMemberApiFarmsFarmIdMembersUserIdPutApiResponse,
      UpdateMemberApiFarmsFarmIdMembersUserIdPutApiArg
    >({
      query: (queryArg) => ({
        url: `/api/farms/${queryArg.farmId}/members/${queryArg.userId}`,
        method: "PUT",
        body: queryArg.memberUpdate,
      }),
    }),
    removeMemberApiFarmsFarmIdMembersUserIdDelete: build.mutation<
      RemoveMemberApiFarmsFarmIdMembersUserIdDeleteApiResponse,
      RemoveMemberApiFarmsFarmIdMembersUserIdDeleteApiArg
    >({
      query: (queryArg) => ({
        url: `/api/farms/${queryArg.farmId}/members/${queryArg.userId}`,
        method: "DELETE",
      }),
    }),
    listConversationsApiConversationsGet: build.query<
      ListConversationsApiConversationsGetApiResponse,
      ListConversationsApiConversationsGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/conversations`,
        params: {
          farm_id: queryArg.farmId,
          page: queryArg.page,
          limit: queryArg.limit,
        },
      }),
    }),
    createConversationApiConversationsPost: build.mutation<
      CreateConversationApiConversationsPostApiResponse,
      CreateConversationApiConversationsPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/conversations`,
        method: "POST",
        body: queryArg.conversationCreate,
      }),
    }),
    getConversationApiConversationsConversationIdGet: build.query<
      GetConversationApiConversationsConversationIdGetApiResponse,
      GetConversationApiConversationsConversationIdGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/conversations/${queryArg.conversationId}`,
      }),
    }),
    updateConversationApiConversationsConversationIdPut: build.mutation<
      UpdateConversationApiConversationsConversationIdPutApiResponse,
      UpdateConversationApiConversationsConversationIdPutApiArg
    >({
      query: (queryArg) => ({
        url: `/api/conversations/${queryArg.conversationId}`,
        method: "PUT",
        body: queryArg.conversationUpdate,
      }),
    }),
    deleteConversationApiConversationsConversationIdDelete: build.mutation<
      DeleteConversationApiConversationsConversationIdDeleteApiResponse,
      DeleteConversationApiConversationsConversationIdDeleteApiArg
    >({
      query: (queryArg) => ({
        url: `/api/conversations/${queryArg.conversationId}`,
        method: "DELETE",
      }),
    }),
    getMessagesApiConversationsConversationIdMessagesGet: build.query<
      GetMessagesApiConversationsConversationIdMessagesGetApiResponse,
      GetMessagesApiConversationsConversationIdMessagesGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/conversations/${queryArg.conversationId}/messages`,
        params: {
          page: queryArg.page,
          limit: queryArg.limit,
        },
      }),
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
    dashboardLoginDashboardLoginGet: build.query<
      DashboardLoginDashboardLoginGetApiResponse,
      DashboardLoginDashboardLoginGetApiArg
    >({
      query: () => ({ url: `/dashboard/login` }),
    }),
    dashboardLogoutDashboardLogoutGet: build.query<
      DashboardLogoutDashboardLogoutGetApiResponse,
      DashboardLogoutDashboardLogoutGetApiArg
    >({
      query: () => ({ url: `/dashboard/logout` }),
    }),
    loginPageLoginGet: build.query<
      LoginPageLoginGetApiResponse,
      LoginPageLoginGetApiArg
    >({
      query: () => ({ url: `/login` }),
    }),
    usersPageUsersGet: build.query<
      UsersPageUsersGetApiResponse,
      UsersPageUsersGetApiArg
    >({
      query: () => ({ url: `/users` }),
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
export type DebugUserApiAuthDebugUserUsernameGetApiResponse =
  /** status 200 Successful Response */ any;
export type DebugUserApiAuthDebugUserUsernameGetApiArg = {
  username: string;
};
export type SignInApiAuthSigninPostApiResponse =
  /** status 200 Successful Response */ AuthResponse;
export type SignInApiAuthSigninPostApiArg = {
  signInRequest: SignInRequest;
};
export type GetProfileApiAuthProfileGetApiResponse =
  /** status 200 Successful Response */ UserProfile;
export type GetProfileApiAuthProfileGetApiArg = void;
export type ChangePasswordApiAuthChangePasswordPostApiResponse =
  /** status 200 Successful Response */ any;
export type ChangePasswordApiAuthChangePasswordPostApiArg = {
  changePasswordRequest: ChangePasswordRequest;
};
export type SignOutApiAuthSignoutPostApiResponse =
  /** status 200 Successful Response */ any;
export type SignOutApiAuthSignoutPostApiArg = void;
export type ListOwnersApiAdminOwnersGetApiResponse =
  /** status 200 Successful Response */ UserResponse[];
export type ListOwnersApiAdminOwnersGetApiArg = void;
export type CreateOwnerWithFarmApiAdminOwnersPostApiResponse =
  /** status 201 Successful Response */ OwnerWithFarmResponse;
export type CreateOwnerWithFarmApiAdminOwnersPostApiArg = {
  createOwnerRequest: CreateOwnerRequest;
};
export type GetOwnerDetailApiAdminOwnersOwnerIdGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetOwnerDetailApiAdminOwnersOwnerIdGetApiArg = {
  ownerId: string;
};
export type DeleteOwnerApiAdminOwnersOwnerIdDeleteApiResponse = unknown;
export type DeleteOwnerApiAdminOwnersOwnerIdDeleteApiArg = {
  ownerId: string;
};
export type ToggleOwnerActiveApiAdminOwnersOwnerIdToggleActivePutApiResponse =
  /** status 200 Successful Response */ any;
export type ToggleOwnerActiveApiAdminOwnersOwnerIdToggleActivePutApiArg = {
  ownerId: string;
};
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
export type InjectAnomalyApiIotSimulatorInjectAnomalyPostApiResponse =
  /** status 200 Successful Response */ any;
export type InjectAnomalyApiIotSimulatorInjectAnomalyPostApiArg = {
  /** Target zone */
  zoneId?: number;
  /** Type: sensor_fault, pipe_burst, pressure_drop, flow_spike */
  anomalyType?: string;
  /** How many readings the anomaly lasts */
  duration?: number;
};
export type InjectIrrigationApiIotSimulatorInjectIrrigationPostApiResponse =
  /** status 200 Successful Response */ any;
export type InjectIrrigationApiIotSimulatorInjectIrrigationPostApiArg = {
  /** Target zone */
  zoneId?: number;
  /** start or stop */
  action?: string;
};
export type InjectReservoirApiIotSimulatorInjectReservoirPostApiResponse =
  /** status 200 Successful Response */ any;
export type InjectReservoirApiIotSimulatorInjectReservoirPostApiArg = {
  /** Reservoir level % */
  level?: number;
};
export type InjectFilterApiIotSimulatorInjectFilterPostApiResponse =
  /** status 200 Successful Response */ any;
export type InjectFilterApiIotSimulatorInjectFilterPostApiArg = {
  /** 0=clean, 1=partial, 2=clogged */
  status?: number;
};
export type InjectSoilApiIotSimulatorInjectSoilPostApiResponse =
  /** status 200 Successful Response */ any;
export type InjectSoilApiIotSimulatorInjectSoilPostApiArg = {
  /** Target zone */
  zoneId?: number;
  /** Soil moisture % */
  moisture?: number;
};
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
export type ListFarmsApiFarmsGetApiResponse =
  /** status 200 Successful Response */ FarmListResponse;
export type ListFarmsApiFarmsGetApiArg = void;
export type CreateFarmApiFarmsPostApiResponse =
  /** status 201 Successful Response */ FarmResponse;
export type CreateFarmApiFarmsPostApiArg = {
  farmCreate: FarmCreate;
};
export type GetFarmApiFarmsFarmIdGetApiResponse =
  /** status 200 Successful Response */ FarmResponse;
export type GetFarmApiFarmsFarmIdGetApiArg = {
  farmId: string;
};
export type UpdateFarmApiFarmsFarmIdPutApiResponse =
  /** status 200 Successful Response */ FarmResponse;
export type UpdateFarmApiFarmsFarmIdPutApiArg = {
  farmId: string;
  farmUpdate: FarmUpdate;
};
export type DeleteFarmApiFarmsFarmIdDeleteApiResponse = unknown;
export type DeleteFarmApiFarmsFarmIdDeleteApiArg = {
  farmId: string;
};
export type CreateEmployeeApiFarmsFarmIdEmployeesPostApiResponse =
  /** status 201 Successful Response */ UserResponse;
export type CreateEmployeeApiFarmsFarmIdEmployeesPostApiArg = {
  farmId: string;
  createEmployeeRequest: CreateEmployeeRequest;
};
export type ListEmployeesApiFarmsFarmIdEmployeesGetApiResponse =
  /** status 200 Successful Response */ UserResponse[];
export type ListEmployeesApiFarmsFarmIdEmployeesGetApiArg = {
  farmId: string;
};
export type ListMembersApiFarmsFarmIdMembersGetApiResponse =
  /** status 200 Successful Response */ MemberListResponse;
export type ListMembersApiFarmsFarmIdMembersGetApiArg = {
  farmId: string;
};
export type AddMemberByIdApiFarmsFarmIdMembersUserIdPostApiResponse =
  /** status 200 Successful Response */ MemberResponse;
export type AddMemberByIdApiFarmsFarmIdMembersUserIdPostApiArg = {
  farmId: string;
  userId: string;
};
export type UpdateMemberApiFarmsFarmIdMembersUserIdPutApiResponse =
  /** status 200 Successful Response */ MemberResponse;
export type UpdateMemberApiFarmsFarmIdMembersUserIdPutApiArg = {
  farmId: string;
  userId: string;
  memberUpdate: MemberUpdate;
};
export type RemoveMemberApiFarmsFarmIdMembersUserIdDeleteApiResponse = unknown;
export type RemoveMemberApiFarmsFarmIdMembersUserIdDeleteApiArg = {
  farmId: string;
  userId: string;
};
export type ListConversationsApiConversationsGetApiResponse =
  /** status 200 Successful Response */ ConversationListResponse;
export type ListConversationsApiConversationsGetApiArg = {
  /** Filter by farm (optional) */
  farmId?: string;
  page?: number;
  limit?: number;
};
export type CreateConversationApiConversationsPostApiResponse =
  /** status 201 Successful Response */ ConversationResponse;
export type CreateConversationApiConversationsPostApiArg = {
  conversationCreate: ConversationCreate;
};
export type GetConversationApiConversationsConversationIdGetApiResponse =
  /** status 200 Successful Response */ ConversationResponse;
export type GetConversationApiConversationsConversationIdGetApiArg = {
  conversationId: string;
};
export type UpdateConversationApiConversationsConversationIdPutApiResponse =
  /** status 200 Successful Response */ ConversationResponse;
export type UpdateConversationApiConversationsConversationIdPutApiArg = {
  conversationId: string;
  conversationUpdate: ConversationUpdate;
};
export type DeleteConversationApiConversationsConversationIdDeleteApiResponse =
  unknown;
export type DeleteConversationApiConversationsConversationIdDeleteApiArg = {
  conversationId: string;
};
export type GetMessagesApiConversationsConversationIdMessagesGetApiResponse =
  /** status 200 Successful Response */ ChatMessageResponse[];
export type GetMessagesApiConversationsConversationIdMessagesGetApiArg = {
  conversationId: string;
  page?: number;
  limit?: number;
};
export type RootGetApiResponse = /** status 200 Successful Response */ any;
export type RootGetApiArg = void;
export type HealthCheckHealthGetApiResponse =
  /** status 200 Successful Response */ any;
export type HealthCheckHealthGetApiArg = void;
export type DashboardLoginDashboardLoginGetApiResponse = unknown;
export type DashboardLoginDashboardLoginGetApiArg = void;
export type DashboardLogoutDashboardLogoutGetApiResponse =
  /** status 200 Successful Response */ any;
export type DashboardLogoutDashboardLogoutGetApiArg = void;
export type LoginPageLoginGetApiResponse = unknown;
export type LoginPageLoginGetApiArg = void;
export type UsersPageUsersGetApiResponse = unknown;
export type UsersPageUsersGetApiArg = void;
export type DashboardDashboardGetApiResponse = unknown;
export type DashboardDashboardGetApiArg = void;
export type GetLatestApiLatestGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetLatestApiLatestGetApiArg = void;
export type SseEventsApiEventsGetApiResponse =
  /** status 200 Successful Response */ any;
export type SseEventsApiEventsGetApiArg = void;
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
export type AuthResponse = {
  access_token: string;
  token_type?: string;
  user: {
    [key: string]: any;
  };
};
export type SignInRequest = {
  username: string;
  password: string;
};
export type UserProfile = {
  id: string;
  username: string;
  full_name?: string | null;
  phone?: string | null;
  role: string;
  farm_ids?: string[];
  owned_farm_ids?: string[];
  active_farm_id?: string | null;
};
export type ChangePasswordRequest = {
  old_password: string;
  new_password: string;
};
export type UserResponse = {
  id: string;
  username: string;
  role: string;
  full_name?: string | null;
  phone?: string | null;
  is_active: boolean;
};
export type OwnerWithFarmResponse = {
  user: UserResponse;
  farm: {
    [key: string]: any;
  };
};
export type CreateOwnerRequest = {
  username: string;
  password: string;
  full_name?: string | null;
  phone?: string | null;
  farm_name: string;
  farm_location?: string | null;
  farm_total_zones?: number;
  farm_description?: string | null;
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
export type FarmResponse = {
  name: string;
  location?: string | null;
  total_zones?: number;
  description?: string | null;
  id: string;
  owner_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type FarmListResponse = {
  farms: FarmResponse[];
  total: number;
};
export type FarmCreate = {
  name: string;
  location?: string | null;
  total_zones?: number;
  description?: string | null;
};
export type FarmUpdate = {
  name?: string | null;
  location?: string | null;
  total_zones?: number | null;
  description?: string | null;
  is_active?: boolean | null;
};
export type CreateEmployeeRequest = {
  username: string;
  password: string;
  full_name?: string | null;
  phone?: string | null;
};
export type PermissionsSchema = {
  read?: boolean;
  write_readings?: boolean;
  manage_alerts?: boolean;
  manage_employees?: boolean;
};
export type MemberResponse = {
  id: string;
  farm_id: string;
  user_id: string;
  user_username?: string | null;
  user_full_name?: string | null;
  permissions: PermissionsSchema;
  is_active: boolean;
  joined_at: string;
};
export type MemberListResponse = {
  members: MemberResponse[];
  total: number;
};
export type MemberUpdate = {
  permissions?: PermissionsSchema | null;
  is_active?: boolean | null;
};
export type ConversationResponse = {
  id: string;
  user_id: string;
  farm_id?: string | null;
  title: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type ConversationListResponse = {
  conversations: ConversationResponse[];
  total: number;
};
export type ConversationCreate = {
  title?: string;
  farm_id?: string | null;
};
export type ConversationUpdate = {
  title?: string | null;
  is_active?: boolean | null;
};
export type ChatMessageResponse = {
  id: string;
  conversation_id: string;
  sender_id?: string | null;
  role: string;
  content: string;
  created_at: string;
};
export const {
  useDebugUserApiAuthDebugUserUsernameGetQuery,
  useSignInApiAuthSigninPostMutation,
  useGetProfileApiAuthProfileGetQuery,
  useChangePasswordApiAuthChangePasswordPostMutation,
  useSignOutApiAuthSignoutPostMutation,
  useListOwnersApiAdminOwnersGetQuery,
  useCreateOwnerWithFarmApiAdminOwnersPostMutation,
  useGetOwnerDetailApiAdminOwnersOwnerIdGetQuery,
  useDeleteOwnerApiAdminOwnersOwnerIdDeleteMutation,
  useToggleOwnerActiveApiAdminOwnersOwnerIdToggleActivePutMutation,
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
  useInjectAnomalyApiIotSimulatorInjectAnomalyPostMutation,
  useInjectIrrigationApiIotSimulatorInjectIrrigationPostMutation,
  useInjectReservoirApiIotSimulatorInjectReservoirPostMutation,
  useInjectFilterApiIotSimulatorInjectFilterPostMutation,
  useInjectSoilApiIotSimulatorInjectSoilPostMutation,
  useForecastApiPredictionsForecastPostMutation,
  useDetectAnomaliesApiPredictionsAnomaliesPostMutation,
  useGetHistoryApiPredictionsHistoryGetQuery,
  useChatApiAiChatPostMutation,
  useGetChatHistoryApiAiChatConversationIdGetQuery,
  useListFarmsApiFarmsGetQuery,
  useCreateFarmApiFarmsPostMutation,
  useGetFarmApiFarmsFarmIdGetQuery,
  useUpdateFarmApiFarmsFarmIdPutMutation,
  useDeleteFarmApiFarmsFarmIdDeleteMutation,
  useCreateEmployeeApiFarmsFarmIdEmployeesPostMutation,
  useListEmployeesApiFarmsFarmIdEmployeesGetQuery,
  useListMembersApiFarmsFarmIdMembersGetQuery,
  useAddMemberByIdApiFarmsFarmIdMembersUserIdPostMutation,
  useUpdateMemberApiFarmsFarmIdMembersUserIdPutMutation,
  useRemoveMemberApiFarmsFarmIdMembersUserIdDeleteMutation,
  useListConversationsApiConversationsGetQuery,
  useCreateConversationApiConversationsPostMutation,
  useGetConversationApiConversationsConversationIdGetQuery,
  useUpdateConversationApiConversationsConversationIdPutMutation,
  useDeleteConversationApiConversationsConversationIdDeleteMutation,
  useGetMessagesApiConversationsConversationIdMessagesGetQuery,
  useRootGetQuery,
  useHealthCheckHealthGetQuery,
  useDashboardLoginDashboardLoginGetQuery,
  useDashboardLogoutDashboardLogoutGetQuery,
  useLoginPageLoginGetQuery,
  useUsersPageUsersGetQuery,
  useDashboardDashboardGetQuery,
  useGetLatestApiLatestGetQuery,
  useSseEventsApiEventsGetQuery,
} = injectedRtkApi;
