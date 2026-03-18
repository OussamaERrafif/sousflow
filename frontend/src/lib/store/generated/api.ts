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
    seedIotDevicesApiAdminSeedDevicesFarmIdPost: build.mutation<
      SeedIotDevicesApiAdminSeedDevicesFarmIdPostApiResponse,
      SeedIotDevicesApiAdminSeedDevicesFarmIdPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/admin/seed-devices/${queryArg.farmId}`,
        method: "POST",
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
    whatsappWebhookApiWhatsappWebhookPost: build.mutation<
      WhatsappWebhookApiWhatsappWebhookPostApiResponse,
      WhatsappWebhookApiWhatsappWebhookPostApiArg
    >({
      query: () => ({ url: `/api/whatsapp/webhook`, method: "POST" }),
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
    createEnvironmentReadingApiIotReadingsEnvironmentPost: build.mutation<
      CreateEnvironmentReadingApiIotReadingsEnvironmentPostApiResponse,
      CreateEnvironmentReadingApiIotReadingsEnvironmentPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/readings/environment`,
        method: "POST",
        body: queryArg.reading,
      }),
    }),
    getLatestEnvironmentApiIotReadingsEnvironmentLatestGet: build.query<
      GetLatestEnvironmentApiIotReadingsEnvironmentLatestGetApiResponse,
      GetLatestEnvironmentApiIotReadingsEnvironmentLatestGetApiArg
    >({
      query: () => ({ url: `/api/iot/readings/environment/latest` }),
    }),
    createInfrastructureReadingApiIotReadingsInfrastructurePost: build.mutation<
      CreateInfrastructureReadingApiIotReadingsInfrastructurePostApiResponse,
      CreateInfrastructureReadingApiIotReadingsInfrastructurePostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/readings/infrastructure`,
        method: "POST",
        body: queryArg.reading,
      }),
    }),
    getLatestInfrastructureApiIotReadingsInfrastructureLatestGet: build.query<
      GetLatestInfrastructureApiIotReadingsInfrastructureLatestGetApiResponse,
      GetLatestInfrastructureApiIotReadingsInfrastructureLatestGetApiArg
    >({
      query: () => ({ url: `/api/iot/readings/infrastructure/latest` }),
    }),
    createBranchFlowReadingApiIotReadingsBranchFlowPost: build.mutation<
      CreateBranchFlowReadingApiIotReadingsBranchFlowPostApiResponse,
      CreateBranchFlowReadingApiIotReadingsBranchFlowPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/readings/branch-flow`,
        method: "POST",
        body: queryArg.reading,
        params: {
          branch_id: queryArg.branchId,
          zone_id: queryArg.zoneId,
        },
      }),
    }),
    getLatestBranchFlowApiIotReadingsBranchFlowLatestGet: build.query<
      GetLatestBranchFlowApiIotReadingsBranchFlowLatestGetApiResponse,
      GetLatestBranchFlowApiIotReadingsBranchFlowLatestGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/readings/branch-flow/latest`,
        params: {
          zone_id: queryArg.zoneId,
        },
      }),
    }),
    createSoilMoistureReadingApiIotReadingsSoilMoisturePost: build.mutation<
      CreateSoilMoistureReadingApiIotReadingsSoilMoisturePostApiResponse,
      CreateSoilMoistureReadingApiIotReadingsSoilMoisturePostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/readings/soil-moisture`,
        method: "POST",
        body: queryArg.reading,
        params: {
          branch_id: queryArg.branchId,
          zone_id: queryArg.zoneId,
        },
      }),
    }),
    createZoneHealthReadingApiIotReadingsZoneHealthPost: build.mutation<
      CreateZoneHealthReadingApiIotReadingsZoneHealthPostApiResponse,
      CreateZoneHealthReadingApiIotReadingsZoneHealthPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/readings/zone-health`,
        method: "POST",
        body: queryArg.reading,
        params: {
          zone_id: queryArg.zoneId,
        },
      }),
    }),
    getLatestZoneHealthApiIotReadingsZoneHealthLatestGet: build.query<
      GetLatestZoneHealthApiIotReadingsZoneHealthLatestGetApiResponse,
      GetLatestZoneHealthApiIotReadingsZoneHealthLatestGetApiArg
    >({
      query: () => ({ url: `/api/iot/readings/zone-health/latest` }),
    }),
    getHierarchicalDashboardApiIotDashboardHierarchicalGet: build.query<
      GetHierarchicalDashboardApiIotDashboardHierarchicalGetApiResponse,
      GetHierarchicalDashboardApiIotDashboardHierarchicalGetApiArg
    >({
      query: () => ({ url: `/api/iot/dashboard/hierarchical` }),
    }),
    analyzeZoneHierarchicalApiIotAnalyzeHierarchicalZoneIdGet: build.query<
      AnalyzeZoneHierarchicalApiIotAnalyzeHierarchicalZoneIdGetApiResponse,
      AnalyzeZoneHierarchicalApiIotAnalyzeHierarchicalZoneIdGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/iot/analyze-hierarchical/${queryArg.zoneId}`,
        params: {
          hours: queryArg.hours,
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
    listZonesApiZonesGet: build.query<
      ListZonesApiZonesGetApiResponse,
      ListZonesApiZonesGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/zones`,
        params: {
          farm_id: queryArg.farmId,
        },
      }),
    }),
    createZoneApiZonesPost: build.mutation<
      CreateZoneApiZonesPostApiResponse,
      CreateZoneApiZonesPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/zones`,
        method: "POST",
        body: queryArg.appSchemasZoneZoneCreate,
        params: {
          farm_id: queryArg.farmId,
        },
      }),
    }),
    getAllZonesWithBranchesApiZonesAllWithBranchesGet: build.query<
      GetAllZonesWithBranchesApiZonesAllWithBranchesGetApiResponse,
      GetAllZonesWithBranchesApiZonesAllWithBranchesGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/zones/all-with-branches`,
        params: {
          farm_id: queryArg.farmId,
        },
      }),
    }),
    getZoneApiZonesZoneIdGet: build.query<
      GetZoneApiZonesZoneIdGetApiResponse,
      GetZoneApiZonesZoneIdGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/zones/${queryArg.zoneId}`,
        params: {
          farm_id: queryArg.farmId,
        },
      }),
    }),
    updateZoneApiZonesZoneIdPut: build.mutation<
      UpdateZoneApiZonesZoneIdPutApiResponse,
      UpdateZoneApiZonesZoneIdPutApiArg
    >({
      query: (queryArg) => ({
        url: `/api/zones/${queryArg.zoneId}`,
        method: "PUT",
        body: queryArg.appSchemasZoneZoneUpdate,
        params: {
          farm_id: queryArg.farmId,
        },
      }),
    }),
    deleteZoneApiZonesZoneIdDelete: build.mutation<
      DeleteZoneApiZonesZoneIdDeleteApiResponse,
      DeleteZoneApiZonesZoneIdDeleteApiArg
    >({
      query: (queryArg) => ({
        url: `/api/zones/${queryArg.zoneId}`,
        method: "DELETE",
        params: {
          farm_id: queryArg.farmId,
        },
      }),
    }),
    listBranchesApiZonesZoneIdBranchesGet: build.query<
      ListBranchesApiZonesZoneIdBranchesGetApiResponse,
      ListBranchesApiZonesZoneIdBranchesGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/zones/${queryArg.zoneId}/branches`,
        params: {
          farm_id: queryArg.farmId,
        },
      }),
    }),
    createBranchApiZonesZoneIdBranchesPost: build.mutation<
      CreateBranchApiZonesZoneIdBranchesPostApiResponse,
      CreateBranchApiZonesZoneIdBranchesPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/zones/${queryArg.zoneId}/branches`,
        method: "POST",
        body: queryArg.branchCreate,
        params: {
          farm_id: queryArg.farmId,
        },
      }),
    }),
    updateBranchApiZonesZoneIdBranchesBranchIdPut: build.mutation<
      UpdateBranchApiZonesZoneIdBranchesBranchIdPutApiResponse,
      UpdateBranchApiZonesZoneIdBranchesBranchIdPutApiArg
    >({
      query: (queryArg) => ({
        url: `/api/zones/${queryArg.zoneId}/branches/${queryArg.branchId}`,
        method: "PUT",
        body: queryArg.branchUpdate,
        params: {
          farm_id: queryArg.farmId,
        },
      }),
    }),
    deleteBranchApiZonesZoneIdBranchesBranchIdDelete: build.mutation<
      DeleteBranchApiZonesZoneIdBranchesBranchIdDeleteApiResponse,
      DeleteBranchApiZonesZoneIdBranchesBranchIdDeleteApiArg
    >({
      query: (queryArg) => ({
        url: `/api/zones/${queryArg.zoneId}/branches/${queryArg.branchId}`,
        method: "DELETE",
        params: {
          farm_id: queryArg.farmId,
        },
      }),
    }),
    listZonesApiInfrastructureZonesGet: build.query<
      ListZonesApiInfrastructureZonesGetApiResponse,
      ListZonesApiInfrastructureZonesGetApiArg
    >({
      query: () => ({ url: `/api/infrastructure/zones` }),
    }),
    createZoneApiInfrastructureZonesPost: build.mutation<
      CreateZoneApiInfrastructureZonesPostApiResponse,
      CreateZoneApiInfrastructureZonesPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/zones`,
        method: "POST",
        body: queryArg.appRoutesInfrastructureRoutesZoneCreate,
      }),
    }),
    getZoneApiInfrastructureZonesZoneIdGet: build.query<
      GetZoneApiInfrastructureZonesZoneIdGetApiResponse,
      GetZoneApiInfrastructureZonesZoneIdGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/zones/${queryArg.zoneId}`,
      }),
    }),
    updateZoneApiInfrastructureZonesZoneIdPut: build.mutation<
      UpdateZoneApiInfrastructureZonesZoneIdPutApiResponse,
      UpdateZoneApiInfrastructureZonesZoneIdPutApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/zones/${queryArg.zoneId}`,
        method: "PUT",
        body: queryArg.appRoutesInfrastructureRoutesZoneUpdate,
      }),
    }),
    deleteZoneApiInfrastructureZonesZoneIdDelete: build.mutation<
      DeleteZoneApiInfrastructureZonesZoneIdDeleteApiResponse,
      DeleteZoneApiInfrastructureZonesZoneIdDeleteApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/zones/${queryArg.zoneId}`,
        method: "DELETE",
      }),
    }),
    listReservoirsApiInfrastructureReservoirsGet: build.query<
      ListReservoirsApiInfrastructureReservoirsGetApiResponse,
      ListReservoirsApiInfrastructureReservoirsGetApiArg
    >({
      query: () => ({ url: `/api/infrastructure/reservoirs` }),
    }),
    createReservoirApiInfrastructureReservoirsPost: build.mutation<
      CreateReservoirApiInfrastructureReservoirsPostApiResponse,
      CreateReservoirApiInfrastructureReservoirsPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/reservoirs`,
        method: "POST",
        body: queryArg.reservoirCreate,
      }),
    }),
    getReservoirApiInfrastructureReservoirsReservoirIdGet: build.query<
      GetReservoirApiInfrastructureReservoirsReservoirIdGetApiResponse,
      GetReservoirApiInfrastructureReservoirsReservoirIdGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/reservoirs/${queryArg.reservoirId}`,
      }),
    }),
    updateReservoirApiInfrastructureReservoirsReservoirIdPut: build.mutation<
      UpdateReservoirApiInfrastructureReservoirsReservoirIdPutApiResponse,
      UpdateReservoirApiInfrastructureReservoirsReservoirIdPutApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/reservoirs/${queryArg.reservoirId}`,
        method: "PUT",
        body: queryArg.reservoirUpdate,
      }),
    }),
    deleteReservoirApiInfrastructureReservoirsReservoirIdDelete: build.mutation<
      DeleteReservoirApiInfrastructureReservoirsReservoirIdDeleteApiResponse,
      DeleteReservoirApiInfrastructureReservoirsReservoirIdDeleteApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/reservoirs/${queryArg.reservoirId}`,
        method: "DELETE",
      }),
    }),
    listPipesApiInfrastructurePipesGet: build.query<
      ListPipesApiInfrastructurePipesGetApiResponse,
      ListPipesApiInfrastructurePipesGetApiArg
    >({
      query: () => ({ url: `/api/infrastructure/pipes` }),
    }),
    createPipeApiInfrastructurePipesPost: build.mutation<
      CreatePipeApiInfrastructurePipesPostApiResponse,
      CreatePipeApiInfrastructurePipesPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/pipes`,
        method: "POST",
        body: queryArg.pipeCreate,
      }),
    }),
    getPipeApiInfrastructurePipesPipeIdGet: build.query<
      GetPipeApiInfrastructurePipesPipeIdGetApiResponse,
      GetPipeApiInfrastructurePipesPipeIdGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/pipes/${queryArg.pipeId}`,
      }),
    }),
    updatePipeApiInfrastructurePipesPipeIdPut: build.mutation<
      UpdatePipeApiInfrastructurePipesPipeIdPutApiResponse,
      UpdatePipeApiInfrastructurePipesPipeIdPutApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/pipes/${queryArg.pipeId}`,
        method: "PUT",
        body: queryArg.pipeUpdate,
      }),
    }),
    deletePipeApiInfrastructurePipesPipeIdDelete: build.mutation<
      DeletePipeApiInfrastructurePipesPipeIdDeleteApiResponse,
      DeletePipeApiInfrastructurePipesPipeIdDeleteApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/pipes/${queryArg.pipeId}`,
        method: "DELETE",
      }),
    }),
    listDevicesApiInfrastructureDevicesGet: build.query<
      ListDevicesApiInfrastructureDevicesGetApiResponse,
      ListDevicesApiInfrastructureDevicesGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/devices`,
        params: {
          status: queryArg.status,
          device_type: queryArg.deviceType,
        },
      }),
    }),
    createDeviceApiInfrastructureDevicesPost: build.mutation<
      CreateDeviceApiInfrastructureDevicesPostApiResponse,
      CreateDeviceApiInfrastructureDevicesPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/devices`,
        method: "POST",
        body: queryArg.ioTDeviceCreate,
      }),
    }),
    getDeviceApiInfrastructureDevicesDeviceIdGet: build.query<
      GetDeviceApiInfrastructureDevicesDeviceIdGetApiResponse,
      GetDeviceApiInfrastructureDevicesDeviceIdGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/devices/${queryArg.deviceId}`,
      }),
    }),
    updateDeviceApiInfrastructureDevicesDeviceIdPut: build.mutation<
      UpdateDeviceApiInfrastructureDevicesDeviceIdPutApiResponse,
      UpdateDeviceApiInfrastructureDevicesDeviceIdPutApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/devices/${queryArg.deviceId}`,
        method: "PUT",
        body: queryArg.ioTDeviceUpdate,
      }),
    }),
    deleteDeviceApiInfrastructureDevicesDeviceIdDelete: build.mutation<
      DeleteDeviceApiInfrastructureDevicesDeviceIdDeleteApiResponse,
      DeleteDeviceApiInfrastructureDevicesDeviceIdDeleteApiArg
    >({
      query: (queryArg) => ({
        url: `/api/infrastructure/devices/${queryArg.deviceId}`,
        method: "DELETE",
      }),
    }),
    getMapDataApiInfrastructureMapGet: build.query<
      GetMapDataApiInfrastructureMapGetApiResponse,
      GetMapDataApiInfrastructureMapGetApiArg
    >({
      query: () => ({ url: `/api/infrastructure/map` }),
    }),
    controlZoneApiControlZoneZoneIdPost: build.mutation<
      ControlZoneApiControlZoneZoneIdPostApiResponse,
      ControlZoneApiControlZoneZoneIdPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/control/zone/${queryArg.zoneId}`,
        method: "POST",
        body: queryArg.zoneControlRequest,
      }),
    }),
    controlDeviceApiControlDeviceDeviceIdPost: build.mutation<
      ControlDeviceApiControlDeviceDeviceIdPostApiResponse,
      ControlDeviceApiControlDeviceDeviceIdPostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/control/device/${queryArg.deviceId}`,
        method: "POST",
        body: queryArg.deviceCommandCreate,
      }),
    }),
    setOverrideApiControlZoneZoneIdOverridePost: build.mutation<
      SetOverrideApiControlZoneZoneIdOverridePostApiResponse,
      SetOverrideApiControlZoneZoneIdOverridePostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/control/zone/${queryArg.zoneId}/override`,
        method: "POST",
        body: queryArg.manualOverrideRequest,
      }),
    }),
    getStatesApiControlStatesGet: build.query<
      GetStatesApiControlStatesGetApiResponse,
      GetStatesApiControlStatesGetApiArg
    >({
      query: () => ({ url: `/api/control/states` }),
    }),
    getHistoryApiControlHistoryGet: build.query<
      GetHistoryApiControlHistoryGetApiResponse,
      GetHistoryApiControlHistoryGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/control/history`,
        params: {
          limit: queryArg.limit,
          offset: queryArg.offset,
        },
      }),
    }),
    anomalyDashboardApiAnomaliesDashboardGet: build.query<
      AnomalyDashboardApiAnomaliesDashboardGetApiResponse,
      AnomalyDashboardApiAnomaliesDashboardGetApiArg
    >({
      query: () => ({ url: `/api/anomalies/dashboard` }),
    }),
    listAnomaliesApiAnomaliesGet: build.query<
      ListAnomaliesApiAnomaliesGetApiResponse,
      ListAnomaliesApiAnomaliesGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/anomalies/`,
        params: {
          anomaly_type: queryArg.anomalyType,
          severity: queryArg.severity,
          zone_id: queryArg.zoneId,
          acknowledged: queryArg.acknowledged,
          limit: queryArg.limit,
          offset: queryArg.offset,
        },
      }),
    }),
    acknowledgeApiAnomaliesAcknowledgePost: build.mutation<
      AcknowledgeApiAnomaliesAcknowledgePostApiResponse,
      AcknowledgeApiAnomaliesAcknowledgePostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/anomalies/acknowledge`,
        method: "POST",
        body: queryArg.anomalyAcknowledge,
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
    debugStatusApiDebugStatusGet: build.query<
      DebugStatusApiDebugStatusGetApiResponse,
      DebugStatusApiDebugStatusGetApiArg
    >({
      query: () => ({ url: `/api/debug/status` }),
    }),
    debugToggleApiDebugTogglePost: build.mutation<
      DebugToggleApiDebugTogglePostApiResponse,
      DebugToggleApiDebugTogglePostApiArg
    >({
      query: () => ({ url: `/api/debug/toggle`, method: "POST" }),
    }),
    debugEnableApiDebugEnablePost: build.mutation<
      DebugEnableApiDebugEnablePostApiResponse,
      DebugEnableApiDebugEnablePostApiArg
    >({
      query: () => ({ url: `/api/debug/enable`, method: "POST" }),
    }),
    debugDisableApiDebugDisablePost: build.mutation<
      DebugDisableApiDebugDisablePostApiResponse,
      DebugDisableApiDebugDisablePostApiArg
    >({
      query: () => ({ url: `/api/debug/disable`, method: "POST" }),
    }),
    debugLogsApiDebugLogsGet: build.query<
      DebugLogsApiDebugLogsGetApiResponse,
      DebugLogsApiDebugLogsGetApiArg
    >({
      query: (queryArg) => ({
        url: `/api/debug/logs`,
        params: {
          max_lines: queryArg.maxLines,
        },
      }),
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
export type SeedIotDevicesApiAdminSeedDevicesFarmIdPostApiResponse =
  /** status 201 Successful Response */ any;
export type SeedIotDevicesApiAdminSeedDevicesFarmIdPostApiArg = {
  farmId: string;
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
export type WhatsappWebhookApiWhatsappWebhookPostApiResponse =
  /** status 200 Successful Response */ any;
export type WhatsappWebhookApiWhatsappWebhookPostApiArg = void;
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
export type CreateEnvironmentReadingApiIotReadingsEnvironmentPostApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type CreateEnvironmentReadingApiIotReadingsEnvironmentPostApiArg = {
  reading: {
    [key: string]: any;
  };
};
export type GetLatestEnvironmentApiIotReadingsEnvironmentLatestGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetLatestEnvironmentApiIotReadingsEnvironmentLatestGetApiArg = void;
export type CreateInfrastructureReadingApiIotReadingsInfrastructurePostApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type CreateInfrastructureReadingApiIotReadingsInfrastructurePostApiArg =
  {
    reading: {
      [key: string]: any;
    };
  };
export type GetLatestInfrastructureApiIotReadingsInfrastructureLatestGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetLatestInfrastructureApiIotReadingsInfrastructureLatestGetApiArg =
  void;
export type CreateBranchFlowReadingApiIotReadingsBranchFlowPostApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type CreateBranchFlowReadingApiIotReadingsBranchFlowPostApiArg = {
  /** Branch UUID */
  branchId: string;
  /** Zone UUID */
  zoneId: string;
  reading: {
    [key: string]: any;
  } | null;
};
export type GetLatestBranchFlowApiIotReadingsBranchFlowLatestGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetLatestBranchFlowApiIotReadingsBranchFlowLatestGetApiArg = {
  /** Filter by zone UUID */
  zoneId?: string;
};
export type CreateSoilMoistureReadingApiIotReadingsSoilMoisturePostApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type CreateSoilMoistureReadingApiIotReadingsSoilMoisturePostApiArg = {
  /** Branch UUID */
  branchId: string;
  /** Zone UUID */
  zoneId: string;
  reading: {
    [key: string]: any;
  } | null;
};
export type CreateZoneHealthReadingApiIotReadingsZoneHealthPostApiResponse =
  /** status 200 Successful Response */ {
    [key: string]: any;
  };
export type CreateZoneHealthReadingApiIotReadingsZoneHealthPostApiArg = {
  /** Zone UUID */
  zoneId: string;
  reading: {
    [key: string]: any;
  } | null;
};
export type GetLatestZoneHealthApiIotReadingsZoneHealthLatestGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetLatestZoneHealthApiIotReadingsZoneHealthLatestGetApiArg = void;
export type GetHierarchicalDashboardApiIotDashboardHierarchicalGetApiResponse =
  /** status 200 Successful Response */ any;
export type GetHierarchicalDashboardApiIotDashboardHierarchicalGetApiArg = void;
export type AnalyzeZoneHierarchicalApiIotAnalyzeHierarchicalZoneIdGetApiResponse =
  /** status 200 Successful Response */ any;
export type AnalyzeZoneHierarchicalApiIotAnalyzeHierarchicalZoneIdGetApiArg = {
  zoneId: string;
  /** Lookback period in hours */
  hours?: number;
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
export type ListZonesApiZonesGetApiResponse =
  /** status 200 Successful Response */ ZoneListResponse;
export type ListZonesApiZonesGetApiArg = {
  farmId: string;
};
export type CreateZoneApiZonesPostApiResponse =
  /** status 201 Successful Response */ ZoneResponse;
export type CreateZoneApiZonesPostApiArg = {
  farmId: string;
  appSchemasZoneZoneCreate: ZoneCreate;
};
export type GetAllZonesWithBranchesApiZonesAllWithBranchesGetApiResponse =
  /** status 200 Successful Response */ ZoneWithBranches[];
export type GetAllZonesWithBranchesApiZonesAllWithBranchesGetApiArg = {
  farmId: string;
};
export type GetZoneApiZonesZoneIdGetApiResponse =
  /** status 200 Successful Response */ ZoneWithBranches;
export type GetZoneApiZonesZoneIdGetApiArg = {
  zoneId: string;
  farmId: string;
};
export type UpdateZoneApiZonesZoneIdPutApiResponse =
  /** status 200 Successful Response */ ZoneResponse;
export type UpdateZoneApiZonesZoneIdPutApiArg = {
  zoneId: string;
  farmId: string;
  appSchemasZoneZoneUpdate: ZoneUpdate;
};
export type DeleteZoneApiZonesZoneIdDeleteApiResponse = unknown;
export type DeleteZoneApiZonesZoneIdDeleteApiArg = {
  zoneId: string;
  farmId: string;
};
export type ListBranchesApiZonesZoneIdBranchesGetApiResponse =
  /** status 200 Successful Response */ BranchListResponse;
export type ListBranchesApiZonesZoneIdBranchesGetApiArg = {
  zoneId: string;
  farmId: string;
};
export type CreateBranchApiZonesZoneIdBranchesPostApiResponse =
  /** status 201 Successful Response */ BranchResponse;
export type CreateBranchApiZonesZoneIdBranchesPostApiArg = {
  zoneId: string;
  farmId: string;
  branchCreate: BranchCreate;
};
export type UpdateBranchApiZonesZoneIdBranchesBranchIdPutApiResponse =
  /** status 200 Successful Response */ BranchResponse;
export type UpdateBranchApiZonesZoneIdBranchesBranchIdPutApiArg = {
  zoneId: string;
  branchId: string;
  farmId: string;
  branchUpdate: BranchUpdate;
};
export type DeleteBranchApiZonesZoneIdBranchesBranchIdDeleteApiResponse =
  unknown;
export type DeleteBranchApiZonesZoneIdBranchesBranchIdDeleteApiArg = {
  zoneId: string;
  branchId: string;
  farmId: string;
};
export type ListZonesApiInfrastructureZonesGetApiResponse =
  /** status 200 Successful Response */ ZoneResponse2[];
export type ListZonesApiInfrastructureZonesGetApiArg = void;
export type CreateZoneApiInfrastructureZonesPostApiResponse =
  /** status 201 Successful Response */ ZoneResponse2;
export type CreateZoneApiInfrastructureZonesPostApiArg = {
  appRoutesInfrastructureRoutesZoneCreate: ZoneCreate2;
};
export type GetZoneApiInfrastructureZonesZoneIdGetApiResponse =
  /** status 200 Successful Response */ ZoneResponse2;
export type GetZoneApiInfrastructureZonesZoneIdGetApiArg = {
  zoneId: string;
};
export type UpdateZoneApiInfrastructureZonesZoneIdPutApiResponse =
  /** status 200 Successful Response */ ZoneResponse2;
export type UpdateZoneApiInfrastructureZonesZoneIdPutApiArg = {
  zoneId: string;
  appRoutesInfrastructureRoutesZoneUpdate: ZoneUpdate2;
};
export type DeleteZoneApiInfrastructureZonesZoneIdDeleteApiResponse = unknown;
export type DeleteZoneApiInfrastructureZonesZoneIdDeleteApiArg = {
  zoneId: string;
};
export type ListReservoirsApiInfrastructureReservoirsGetApiResponse =
  /** status 200 Successful Response */ ReservoirResponse[];
export type ListReservoirsApiInfrastructureReservoirsGetApiArg = void;
export type CreateReservoirApiInfrastructureReservoirsPostApiResponse =
  /** status 201 Successful Response */ ReservoirResponse;
export type CreateReservoirApiInfrastructureReservoirsPostApiArg = {
  reservoirCreate: ReservoirCreate;
};
export type GetReservoirApiInfrastructureReservoirsReservoirIdGetApiResponse =
  /** status 200 Successful Response */ ReservoirResponse;
export type GetReservoirApiInfrastructureReservoirsReservoirIdGetApiArg = {
  reservoirId: string;
};
export type UpdateReservoirApiInfrastructureReservoirsReservoirIdPutApiResponse =
  /** status 200 Successful Response */ ReservoirResponse;
export type UpdateReservoirApiInfrastructureReservoirsReservoirIdPutApiArg = {
  reservoirId: string;
  reservoirUpdate: ReservoirUpdate;
};
export type DeleteReservoirApiInfrastructureReservoirsReservoirIdDeleteApiResponse =
  unknown;
export type DeleteReservoirApiInfrastructureReservoirsReservoirIdDeleteApiArg =
  {
    reservoirId: string;
  };
export type ListPipesApiInfrastructurePipesGetApiResponse =
  /** status 200 Successful Response */ PipeResponse[];
export type ListPipesApiInfrastructurePipesGetApiArg = void;
export type CreatePipeApiInfrastructurePipesPostApiResponse =
  /** status 201 Successful Response */ PipeResponse;
export type CreatePipeApiInfrastructurePipesPostApiArg = {
  pipeCreate: PipeCreate;
};
export type GetPipeApiInfrastructurePipesPipeIdGetApiResponse =
  /** status 200 Successful Response */ PipeResponse;
export type GetPipeApiInfrastructurePipesPipeIdGetApiArg = {
  pipeId: string;
};
export type UpdatePipeApiInfrastructurePipesPipeIdPutApiResponse =
  /** status 200 Successful Response */ PipeResponse;
export type UpdatePipeApiInfrastructurePipesPipeIdPutApiArg = {
  pipeId: string;
  pipeUpdate: PipeUpdate;
};
export type DeletePipeApiInfrastructurePipesPipeIdDeleteApiResponse = unknown;
export type DeletePipeApiInfrastructurePipesPipeIdDeleteApiArg = {
  pipeId: string;
};
export type ListDevicesApiInfrastructureDevicesGetApiResponse =
  /** status 200 Successful Response */ IoTDeviceResponse[];
export type ListDevicesApiInfrastructureDevicesGetApiArg = {
  status?: string | null;
  deviceType?: string | null;
};
export type CreateDeviceApiInfrastructureDevicesPostApiResponse =
  /** status 201 Successful Response */ IoTDeviceResponse;
export type CreateDeviceApiInfrastructureDevicesPostApiArg = {
  ioTDeviceCreate: IoTDeviceCreate;
};
export type GetDeviceApiInfrastructureDevicesDeviceIdGetApiResponse =
  /** status 200 Successful Response */ IoTDeviceResponse;
export type GetDeviceApiInfrastructureDevicesDeviceIdGetApiArg = {
  deviceId: string;
};
export type UpdateDeviceApiInfrastructureDevicesDeviceIdPutApiResponse =
  /** status 200 Successful Response */ IoTDeviceResponse;
export type UpdateDeviceApiInfrastructureDevicesDeviceIdPutApiArg = {
  deviceId: string;
  ioTDeviceUpdate: IoTDeviceUpdate;
};
export type DeleteDeviceApiInfrastructureDevicesDeviceIdDeleteApiResponse =
  unknown;
export type DeleteDeviceApiInfrastructureDevicesDeviceIdDeleteApiArg = {
  deviceId: string;
};
export type GetMapDataApiInfrastructureMapGetApiResponse =
  /** status 200 Successful Response */ InfrastructureMapResponse;
export type GetMapDataApiInfrastructureMapGetApiArg = void;
export type ControlZoneApiControlZoneZoneIdPostApiResponse =
  /** status 200 Successful Response */ DeviceCommandResponse;
export type ControlZoneApiControlZoneZoneIdPostApiArg = {
  zoneId: string;
  zoneControlRequest: ZoneControlRequest;
};
export type ControlDeviceApiControlDeviceDeviceIdPostApiResponse =
  /** status 200 Successful Response */ DeviceCommandResponse;
export type ControlDeviceApiControlDeviceDeviceIdPostApiArg = {
  deviceId: string;
  deviceCommandCreate: DeviceCommandCreate;
};
export type SetOverrideApiControlZoneZoneIdOverridePostApiResponse =
  /** status 200 Successful Response */ any;
export type SetOverrideApiControlZoneZoneIdOverridePostApiArg = {
  zoneId: string;
  manualOverrideRequest: ManualOverrideRequest;
};
export type GetStatesApiControlStatesGetApiResponse =
  /** status 200 Successful Response */ FarmControlStates;
export type GetStatesApiControlStatesGetApiArg = void;
export type GetHistoryApiControlHistoryGetApiResponse =
  /** status 200 Successful Response */ CommandHistoryResponse;
export type GetHistoryApiControlHistoryGetApiArg = {
  limit?: number;
  offset?: number;
};
export type AnomalyDashboardApiAnomaliesDashboardGetApiResponse =
  /** status 200 Successful Response */ any;
export type AnomalyDashboardApiAnomaliesDashboardGetApiArg = void;
export type ListAnomaliesApiAnomaliesGetApiResponse =
  /** status 200 Successful Response */ any;
export type ListAnomaliesApiAnomaliesGetApiArg = {
  anomalyType?: string | null;
  severity?: string | null;
  zoneId?: string | null;
  acknowledged?: boolean | null;
  limit?: number;
  offset?: number;
};
export type AcknowledgeApiAnomaliesAcknowledgePostApiResponse =
  /** status 200 Successful Response */ any;
export type AcknowledgeApiAnomaliesAcknowledgePostApiArg = {
  anomalyAcknowledge: AnomalyAcknowledge;
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
export type DebugStatusApiDebugStatusGetApiResponse =
  /** status 200 Successful Response */ any;
export type DebugStatusApiDebugStatusGetApiArg = void;
export type DebugToggleApiDebugTogglePostApiResponse =
  /** status 200 Successful Response */ any;
export type DebugToggleApiDebugTogglePostApiArg = void;
export type DebugEnableApiDebugEnablePostApiResponse =
  /** status 200 Successful Response */ any;
export type DebugEnableApiDebugEnablePostApiArg = void;
export type DebugDisableApiDebugDisablePostApiResponse =
  /** status 200 Successful Response */ any;
export type DebugDisableApiDebugDisablePostApiArg = void;
export type DebugLogsApiDebugLogsGetApiResponse =
  /** status 200 Successful Response */ any;
export type DebugLogsApiDebugLogsGetApiArg = {
  maxLines?: number;
};
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
export type ZoneResponse = {
  id: string;
  farm_id: string;
  zone_number: number;
  name: string;
  description?: string | null;
  area_hectares?: number | null;
  plant_type: string;
  plant_species: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type ZoneListResponse = {
  zones?: ZoneResponse[];
  total?: number;
};
export type ZoneCreate = {
  zone_number: number;
  name: string;
  description?: string | null;
  area_hectares?: number | null;
  plant_type?: string;
  plant_species?: string;
  is_active?: boolean;
};
export type BranchResponse = {
  id: string;
  zone_id: string;
  branch_number: number;
  name: string;
  length_meters?: number | null;
  emitter_count?: number | null;
  emitter_flow_lph: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type ZoneWithBranches = {
  id: string;
  farm_id: string;
  zone_number: number;
  name: string;
  description?: string | null;
  area_hectares?: number | null;
  plant_type: string;
  plant_species: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  branches?: BranchResponse[];
};
export type ZoneUpdate = {
  name?: string | null;
  description?: string | null;
  area_hectares?: number | null;
  plant_type?: string | null;
  plant_species?: string | null;
  is_active?: boolean | null;
};
export type BranchListResponse = {
  branches?: BranchResponse[];
  total?: number;
};
export type BranchCreate = {
  branch_number: number;
  name: string;
  length_meters?: number | null;
  emitter_count?: number | null;
  emitter_flow_lph?: number;
  is_active?: boolean;
};
export type BranchUpdate = {
  name?: string | null;
  length_meters?: number | null;
  emitter_count?: number | null;
  emitter_flow_lph?: number | null;
  is_active?: boolean | null;
};
export type ZoneResponse2 = {
  id: string;
  farm_id: string;
  zone_number: number;
  name: string;
  area_hectares?: number | null;
  geometry?: {
    [key: string]: any;
  } | null;
  center_latitude?: number | null;
  center_longitude?: number | null;
  is_active?: boolean;
};
export type ZoneCreate2 = {
  zone_number: number;
  name: string;
  area_hectares?: number | null;
  geometry?: {
    [key: string]: any;
  } | null;
  center_latitude?: number | null;
  center_longitude?: number | null;
};
export type ZoneUpdate2 = {
  name?: string | null;
  area_hectares?: number | null;
  geometry?: {
    [key: string]: any;
  } | null;
  center_latitude?: number | null;
  center_longitude?: number | null;
};
export type ReservoirResponse = {
  id: string;
  farm_id: string;
  name: string;
  capacity_liters?: number;
  current_level_pct?: number;
  latitude?: number | null;
  longitude?: number | null;
  is_active?: boolean;
};
export type ReservoirCreate = {
  name: string;
  capacity_liters?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};
export type ReservoirUpdate = {
  name?: string | null;
  capacity_liters?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};
export type PipeResponse = {
  id: string;
  farm_id: string;
  name: string;
  pipe_type?: string;
  diameter_mm?: number | null;
  length_meters?: number | null;
  from_latitude?: number | null;
  from_longitude?: number | null;
  to_latitude?: number | null;
  to_longitude?: number | null;
  from_zone_id?: string | null;
  to_zone_id?: string | null;
  from_reservoir_id?: string | null;
  is_active?: boolean;
};
export type PipeCreate = {
  name: string;
  pipe_type?: string | null;
  diameter_mm?: number | null;
  length_meters?: number | null;
  from_latitude?: number | null;
  from_longitude?: number | null;
  to_latitude?: number | null;
  to_longitude?: number | null;
  from_zone_id?: string | null;
  to_zone_id?: string | null;
  from_reservoir_id?: string | null;
};
export type PipeUpdate = {
  name?: string | null;
  pipe_type?: string | null;
  diameter_mm?: number | null;
  length_meters?: number | null;
  from_latitude?: number | null;
  from_longitude?: number | null;
  to_latitude?: number | null;
  to_longitude?: number | null;
};
export type IoTDeviceResponse = {
  id: string;
  farm_id: string;
  device_type: string;
  name?: string | null;
  device_id?: string | null;
  model?: string | null;
  serial_number?: string | null;
  mac_address?: string | null;
  ip_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  zone_id?: string | null;
  reservoir_id?: string | null;
  status?: string;
  last_reading_at?: string | null;
  last_battery_pct?: number | null;
  is_active?: boolean;
};
export type IoTDeviceCreate = {
  device_type: string;
  name: string;
  model?: string | null;
  serial_number?: string | null;
  mac_address?: string | null;
  ip_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  zone_id?: string | null;
  reservoir_id?: string | null;
};
export type IoTDeviceUpdate = {
  name?: string | null;
  model?: string | null;
  serial_number?: string | null;
  mac_address?: string | null;
  ip_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  zone_id?: string | null;
  reservoir_id?: string | null;
  status?: string | null;
};
export type InfrastructureMapResponse = {
  zones: ZoneResponse2[];
  reservoirs: ReservoirResponse[];
  pipes: PipeResponse[];
  devices: IoTDeviceResponse[];
};
export type DeviceCommandResponse = {
  id: string;
  farm_id: string;
  zone_id?: string | null;
  device_id?: string | null;
  command_type: string;
  target_type: string;
  status: string;
  source: string;
  created_at: string;
  executed_at?: string | null;
  result?: {
    [key: string]: any;
  };
};
export type ZoneControlRequest = {
  action: "start_irrigation" | "stop_irrigation";
  duration_minutes?: number | null;
};
export type DeviceCommandCreate = {
  command_type: "valve_open" | "valve_close" | "pump_start" | "pump_stop";
  parameters?: {
    [key: string]: any;
  } | null;
};
export type ManualOverrideRequest = {
  enabled: boolean;
};
export type ZoneControlState = {
  zone_id: string;
  zone_number: number;
  zone_name: string;
  valve_open: boolean;
  mode: "auto" | "manual";
  irrigation_active: boolean;
};
export type FarmControlStates = {
  zones: ZoneControlState[];
  pump_active: boolean;
  reservoir_level_pct: number;
  filter_status: number;
};
export type CommandHistoryResponse = {
  commands: DeviceCommandResponse[];
  total: number;
};
export type AnomalyAcknowledge = {
  anomaly_ids: string[];
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
  useSeedIotDevicesApiAdminSeedDevicesFarmIdPostMutation,
  useSendMessageApiWhatsappSendPostMutation,
  useGetMessagesApiWhatsappMessagesGetQuery,
  useGetDeviceStatusApiWhatsappStatusGetQuery,
  useSendAlertApiWhatsappAlertPostMutation,
  useWhatsappWebhookApiWhatsappWebhookPostMutation,
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
  useCreateEnvironmentReadingApiIotReadingsEnvironmentPostMutation,
  useGetLatestEnvironmentApiIotReadingsEnvironmentLatestGetQuery,
  useCreateInfrastructureReadingApiIotReadingsInfrastructurePostMutation,
  useGetLatestInfrastructureApiIotReadingsInfrastructureLatestGetQuery,
  useCreateBranchFlowReadingApiIotReadingsBranchFlowPostMutation,
  useGetLatestBranchFlowApiIotReadingsBranchFlowLatestGetQuery,
  useCreateSoilMoistureReadingApiIotReadingsSoilMoisturePostMutation,
  useCreateZoneHealthReadingApiIotReadingsZoneHealthPostMutation,
  useGetLatestZoneHealthApiIotReadingsZoneHealthLatestGetQuery,
  useGetHierarchicalDashboardApiIotDashboardHierarchicalGetQuery,
  useAnalyzeZoneHierarchicalApiIotAnalyzeHierarchicalZoneIdGetQuery,
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
  useListZonesApiZonesGetQuery,
  useCreateZoneApiZonesPostMutation,
  useGetAllZonesWithBranchesApiZonesAllWithBranchesGetQuery,
  useGetZoneApiZonesZoneIdGetQuery,
  useUpdateZoneApiZonesZoneIdPutMutation,
  useDeleteZoneApiZonesZoneIdDeleteMutation,
  useListBranchesApiZonesZoneIdBranchesGetQuery,
  useCreateBranchApiZonesZoneIdBranchesPostMutation,
  useUpdateBranchApiZonesZoneIdBranchesBranchIdPutMutation,
  useDeleteBranchApiZonesZoneIdBranchesBranchIdDeleteMutation,
  useListZonesApiInfrastructureZonesGetQuery,
  useCreateZoneApiInfrastructureZonesPostMutation,
  useGetZoneApiInfrastructureZonesZoneIdGetQuery,
  useUpdateZoneApiInfrastructureZonesZoneIdPutMutation,
  useDeleteZoneApiInfrastructureZonesZoneIdDeleteMutation,
  useListReservoirsApiInfrastructureReservoirsGetQuery,
  useCreateReservoirApiInfrastructureReservoirsPostMutation,
  useGetReservoirApiInfrastructureReservoirsReservoirIdGetQuery,
  useUpdateReservoirApiInfrastructureReservoirsReservoirIdPutMutation,
  useDeleteReservoirApiInfrastructureReservoirsReservoirIdDeleteMutation,
  useListPipesApiInfrastructurePipesGetQuery,
  useCreatePipeApiInfrastructurePipesPostMutation,
  useGetPipeApiInfrastructurePipesPipeIdGetQuery,
  useUpdatePipeApiInfrastructurePipesPipeIdPutMutation,
  useDeletePipeApiInfrastructurePipesPipeIdDeleteMutation,
  useListDevicesApiInfrastructureDevicesGetQuery,
  useCreateDeviceApiInfrastructureDevicesPostMutation,
  useGetDeviceApiInfrastructureDevicesDeviceIdGetQuery,
  useUpdateDeviceApiInfrastructureDevicesDeviceIdPutMutation,
  useDeleteDeviceApiInfrastructureDevicesDeviceIdDeleteMutation,
  useGetMapDataApiInfrastructureMapGetQuery,
  useControlZoneApiControlZoneZoneIdPostMutation,
  useControlDeviceApiControlDeviceDeviceIdPostMutation,
  useSetOverrideApiControlZoneZoneIdOverridePostMutation,
  useGetStatesApiControlStatesGetQuery,
  useGetHistoryApiControlHistoryGetQuery,
  useAnomalyDashboardApiAnomaliesDashboardGetQuery,
  useListAnomaliesApiAnomaliesGetQuery,
  useAcknowledgeApiAnomaliesAcknowledgePostMutation,
  useRootGetQuery,
  useHealthCheckHealthGetQuery,
  useDashboardLoginDashboardLoginGetQuery,
  useDashboardLogoutDashboardLogoutGetQuery,
  useLoginPageLoginGetQuery,
  useUsersPageUsersGetQuery,
  useDashboardDashboardGetQuery,
  useDebugStatusApiDebugStatusGetQuery,
  useDebugToggleApiDebugTogglePostMutation,
  useDebugEnableApiDebugEnablePostMutation,
  useDebugDisableApiDebugDisablePostMutation,
  useDebugLogsApiDebugLogsGetQuery,
  useGetLatestApiLatestGetQuery,
  useSseEventsApiEventsGetQuery,
} = injectedRtkApi;
