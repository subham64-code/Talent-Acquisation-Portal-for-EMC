import axios, { type AxiosInstance, type AxiosResponse } from "axios";

const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api/v1";

export const api: AxiosInstance = axios.create({ baseURL, withCredentials: true, headers: { "Content-Type": "application/json" } });

let logoutCallback: (() => void) | null = null;
export const setLogoutCallback = (cb: () => void) => { logoutCallback = cb; };

// Auto-unwrap { success: boolean, data: T } from backend
api.interceptors.response.use(
  (res: AxiosResponse) => {
    const data = res.data;
    if (data && data.success !== undefined && data.data !== undefined) {
      // Return just the inner data so callers get r.data directly
      return { ...res, data: data.data };
    }
    return res;
  },
  (err) => {
    if (err.response && err.response.status === 401) {
      if (logoutCallback) logoutCallback();
    }
    return Promise.reject(err);
  },
);

export interface ApiResponse<T> { success: boolean; data: T; }

export const authApi = {
  requestHrOtp: (email: string) => api.post("/auth/hr/otp/request", { email }),
  verifyHrOtp: (email: string, code: string) => api.post("/auth/hr/otp/verify", { email, code }),
  passwordLogin: (email: string, password: string) => api.post("/auth/password/login", { email, password }),
  passwordAvailable: (email: string) => api.post("/auth/password/available", { email }),
  logout: () => api.post("/auth/logout"),
  me: () => api.post("/auth/me"),
  validateEmployeeInvitation: (token: string) => api.get(`/auth/employee/invitation/${token}`),
  publicEmployeeUpdateDropdowns: () => api.get(`/career/employee-update/dropdowns`),
  saveEmployeeDraft: (token: string, fields: Record<string, unknown>) => api.put(`/auth/employee/invitation/${token}/draft`, fields),
  submitEmployeeUpdate: (token: string, formData: FormData) => api.post(`/auth/employee/invitation/${token}/submit`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
};

export const hrApi = {
  users: (params?: any) => api.get("/users", { params }),
  createUser: (body: any) => api.post("/users", body),
  updateUser: (id: string, body: any) => api.patch(`/users/${id}`, body),
  deactivateUser: (id: string) => api.post(`/users/${id}/deactivate`),
  activateUser: (id: string) => api.post(`/users/${id}/activate`),
  userSessions: (id: string) => api.get(`/users/${id}/sessions`),
  revokeSession: (id: string, sessionId: string) => api.delete(`/users/${id}/sessions/${sessionId}`),
  permissions: () => api.get("/permissions"),
  roles: () => api.get("/roles"),
  resetUser: (id: string, body?: any) => api.post(`/users/${id}/reset`, body ?? {}),
  restoreUser: (id: string) => api.post(`/users/${id}/restore`),
  setUserPassword: (id: string, password?: string | null) => api.post(`/users/${id}/password`, { password: password ?? null }),
  storageOverview: () => api.get("/storage/overview"),
  auditLogs: (params?: any) => api.get("/audit-logs", { params }),
  userAccess: (id: string) => api.get(`/users/${id}/access`),
  updateUserAccess: (id: string, overrides: Array<{ permissionId: string; effect: "GRANT" | "REVOKE" }>) => api.put(`/users/${id}/access`, { overrides }),
  activeSessions: () => api.get("/active-sessions"),
  departments: (params?: any) => api.get("/departments", { params }),
  createDepartment: (body: any) => api.post("/departments", body),
  updateDepartment: (id: string, body: any) => api.patch(`/departments/${id}`, body),
  assignEmployeesToDepartment: (id: string, body: any) => api.post(`/departments/${id}/employees`, body),
  deleteDepartment: (id: string) => api.delete(`/departments/${id}`),
  departmentDropdown: () => api.get("/departments/dropdown"),
  designations: (params?: any) => api.get("/designations", { params }),
  programs: (params?: any) => api.get("/programs", { params }),
  createProgram: (data: any) => api.post("/programs", data),
  employmentTypes: (params?: any) => api.get("/employment-types", { params }),
  employees: (params?: any) => api.get("/employees", { params }),
  employee: (id: string) => api.get(`/employees/${id}`),
  createEmployee: (body: any) => api.post("/employees", body),
  updateEmployee: (id: string, body: any) => api.patch(`/employees/${id}`, body),
  transferEmployee: (id: string, body: any) => api.post(`/employees/${id}/transfer`, body),
  employeeInvitations: (id: string) => api.get(`/employees/${id}/invitations`),
  resendInvitation: (id: string) => api.post(`/employees/${id}/invitations`),
  bulkInvitations: (emails: string[]) => api.post("/employees/bulk-invitations", { emails }),
  deleteEmployee: (id: string) => api.delete(`/employees/${id}`),
  onboardEmployeeFromApplication: (applicationId: string) => api.post(`/employees/from-application/${applicationId}`, {}),
  uploadEmployeeCv: (id: string, formData: FormData) => api.post(`/employees/${id}/cv`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  removeEmployeeCv: (id: string) => api.delete(`/employees/${id}/cv`),
  employeeDropdown: () => api.get("/employees/dropdown"),
  employeeInvitationList: (params?: any) => api.get("/employee-invitations", { params }),
  sendEmployeeInvitation: (body: { email: string; fullName?: string }) => api.post("/employee-invitations/send", body),
  employeeInvitation: (id: string) => api.get(`/employee-invitations/${id}`),
  resendEmployeeInvitation: (id: string) => api.post(`/employee-invitations/${id}/resend`),
  generateEmployeeInvitationLink: (id: string) => api.post(`/employee-invitations/${id}/link`),
  renewEmployeeInvitation: (id: string) => api.post(`/employee-invitations/${id}/renew`),
  removeEmployeeInvitation: (id: string) => api.delete(`/employee-invitations/${id}`),
  remindEmployeeInvitation: (id: string, purpose: "submit" | "reminder" = "reminder") =>
    api.post(`/employee-invitations/${id}/remind`, { purpose }),
  employeeSubmissions: (params?: any) => api.get("/employee-submissions", { params }),
  validateEmployeeSubmission: (id: string) => api.post(`/employee-submissions/${id}/validate`),
  unvalidateEmployeeSubmission: (id: string) => api.post(`/employee-submissions/${id}/unvalidate`),
  rejectEmployeeSubmission: (id: string, reason?: string) => api.post(`/employee-submissions/${id}/reject`, { reason }),
  candidates: (params?: any) => api.get("/candidates", { params }),
  candidate: (id: string) => api.get(`/candidates/${id}`),
  uploadCandidateCV: (id: string, formData: FormData) => api.post(`/candidates/${id}/cv`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  openings: (params?: any) => api.get("/openings", { params }),
  opening: (id: string) => api.get(`/openings/${id}`),
  createOpening: (body: any, file?: File) => {
    const fd = new FormData();
    Object.entries(body).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v)); });
    if (file) fd.append("jdFile", file);
    return api.post("/openings", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  updateOpening: (id: string, body: any, file?: File) => {
    const fd = new FormData();
    Object.entries(body).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v)); });
    if (file) fd.append("jdFile", file);
    return api.patch(`/openings/${id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  publishOpening: (id: string) => api.post(`/openings/${id}/publish`),
  closeOpening: (id: string) => api.post(`/openings/${id}/close`),
  archiveOpening: (id: string) => api.post(`/openings/${id}/archive`),
  reopenOpening: (id: string) => api.post(`/openings/${id}/reopen`),
  deleteOpening: (id: string) => api.delete(`/openings/${id}`),
  openingApplications: (id: string, params?: any) => api.get("/applications", { params: { ...(params||{}), jobOpeningId: id } }),
  applications: (params?: any) => api.get("/applications", { params }),
  application: (id: string) => api.get(`/applications/${id}`),
  applicationStatus: (id: string, body: any) => api.patch(`/applications/${id}/status`, body),
  saveApplicationApproval: (id: string, body: any) => api.patch(`/applications/${id}/approval`, body),
  applicationRemarks: (id: string, body: any) => api.post(`/applications/${id}/remarks`, body),
  applicationHistory: (id: string) => api.get(`/applications/${id}/history`),
  aiRun: (body: any) => api.post("/ai-screening/run", body),
  aiRanked: (jobOpeningId: string, params?: any) => api.get(`/ai-screening/${jobOpeningId}/ranked`, { params }),
  aiMatch: (jobOpeningId: string, candidateId: string) => api.get(`/ai-screening/${jobOpeningId}/candidates/${candidateId}`),
  aiAction: (id: string, body: any) => api.post(`/ai-screening/applications/${id}/action`, body),
  aiConfig: () => api.get("/ai-screening/config"),
  interviews: (params?: any) => api.get("/interviews", { params }),
  interview: (id: string) => api.get(`/interviews/${id}`),
  createInterview: (body: any) => api.post("/interviews", body),
  updateInterview: (id: string, body: any) => api.patch(`/interviews/${id}`, body),
  cancelInterview: (id: string, body: any) => api.post(`/interviews/${id}/cancel`, body),
  interviewFeedback: (id: string, body: any) => api.post(`/interviews/${id}/feedback`, body),
  interviewResult: (id: string, body: any) => api.post(`/interviews/${id}/result`, body),
  offers: (params?: any) => api.get("/offers", { params }),
  offer: (id: string) => api.get(`/offers/${id}`),
  createOffer: (body: any) => api.post("/offers", body),
  updateOffer: (id: string, body: any) => api.patch(`/offers/${id}`, body),
  generateOfferPdf: (id: string) => api.post(`/offers/${id}/generate-pdf`),
  sendOffer: (id: string) => api.post(`/offers/${id}/send`),
  remindOffer: (id: string) => api.post(`/offers/${id}/remind`),
  respondOffer: (body: any) => api.post("/offers/respond", body),
  documentCategories: () => api.get("/documents/categories"),
  createDocumentCategory: (body: any) => api.post("/documents/categories", body),
  updateDocumentCategory: (id: string, body: any) => api.patch(`/documents/categories/${id}`, body),
  documents: (params?: any) => api.get("/documents", { params }),
  document: (id: string) => api.get(`/documents/${id}`),
  pendingDocuments: () => api.get("/documents/pending"),
  uploadDocument: (token: string, formData: FormData) => api.post(`/documents/upload/${token}`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  verifyDocument: (id: string, body: any) => api.post(`/documents/${id}/verify`, body),
  remindDocument: (id: string) => api.post(`/documents/${id}/remind`),
  fileAccessToken: (id: string) => api.post(`/files/${id}/access-token`),
  file: (id: string, token?: string) => api.get(`/files/${id}`, { params: token ? { token } : undefined, responseType: "blob" }),
  filePortal: (id: string, token: string) => api.get(`/files/${id}/portal`, { params: { token }, responseType: "blob" }),
  dashboardOverview: () => api.get("/dashboard/overview"),
  dashboardDepartments: () => api.get("/dashboard/departments"),
  dashboardDepartment: (id: string) => api.get(`/dashboard/departments/${id}`),
  dashboardCharts: () => api.get("/dashboard/charts"),
  reportsTypes: () => api.get("/reports/types"),
  report: (type: string, params?: any) => api.get(`/reports/${type}`, { params }),
  notifications: (params?: any) => api.get("/notifications", { params }),
  emailLogs: () => api.get("/notifications/email-logs"),
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markReadAll: () => api.post("/notifications/read-all"),
  settingsWeights: () => api.get("/settings/weights"),
  updateSettingsWeights: (body: any) => api.put("/settings/weights", body),
  integrationStatus: () => api.get("/settings/integration-status"),
  publicDepartments: () => api.get("/career/departments"),
  publicOpenings: (params?: any) => api.get("/career/openings", { params }),
  publicOpening: (id: string) => api.get(`/career/openings/${id}`),
  publicApply: (formData: FormData, onProgress?: (percent: number) => void) =>
    api.post("/career/applications", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }),
};
