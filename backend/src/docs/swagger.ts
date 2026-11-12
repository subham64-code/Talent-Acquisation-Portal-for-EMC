import { env } from "../config/env";

export const swaggerDocument: any = {
  openapi: "3.0.0",
  info: {
    title: "EMC Talent Acquisition Portal API",
    version: "1.0.0",
    description: "REST API for Ecometrics Consultant Pvt. Ltd. Talent Acquisition, CV Databank and Employee Management System.",
  },
  servers: [{ url: env.apiUrl, description: "API server" }],
  tags: [
    { name: "Auth", description: "HR/candidate OTP authentication and employee update invitations" },
    { name: "Users", description: "HR user management and RBAC" },
    { name: "Departments", description: "Department management" },
    { name: "Employees", description: "Employee records" },
    { name: "Candidates", description: "Candidate profiles" },
    { name: "Openings", description: "Job vacancy management" },
    { name: "Applications", description: "Job applications" },
    { name: "AI Screening", description: "AI-powered CV screening and recommendations" },
    { name: "Interviews", description: "Interview scheduling and feedback" },
    { name: "Offers", description: "Offer letter management" },
    { name: "Documents", description: "Document collection and verification" },
    { name: "CV Databank", description: "Centralized CV repository" },
    { name: "Dashboard", description: "Dashboard analytics" },
    { name: "Reports", description: "PDF/Excel/CSV reports" },
    { name: "Notifications", description: "In-app notifications" },
    { name: "Settings", description: "System settings" },
    { name: "Files", description: "Secure document access" },
    { name: "Public", description: "Public career portal" },
  ],
  paths: {},
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
  security: [{ bearerAuth: [] }],
};
