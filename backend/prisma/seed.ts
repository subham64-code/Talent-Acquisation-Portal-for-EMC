import { PrismaClient } from "@prisma/client";
import { env } from "../src/config/env";
import { codeFromName, hashPassword } from "../src/utils/crypto";
import { ROLE_PERMISSIONS, ROLES, ALL_PERMISSIONS, DEFAULT_DEPARTMENTS, DEFAULT_EMPLOYMENT_TYPES, DOCUMENT_CATEGORIES, EMAIL_TEMPLATE_KEYS } from "../src/config/constants";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Permissions
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key, description: key } });
  }

  // Roles
  for (const [key, name] of Object.entries(ROLES)) {
    await prisma.role.upsert({
      where: { key },
      update: { name },
      create: { key, name },
    });
  }

  // Role permissions
  const permissions = await prisma.permission.findMany();
  const permByKey = new Map(permissions.map((p) => [p.key, p.id]));
  for (const [roleKey, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    if (!role) continue;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const p of perms) {
      const permissionId = permByKey.get(p);
      if (permissionId) await prisma.rolePermission.create({ data: { roleId: role.id, permissionId } });
    }
  }

  // Departments
  const deptCodes: Record<string, string> = {
    "Urban Planning": "UP", "GIS Engineering": "GIS", "IT Department": "IT", "Telecom Engineering": "TEL", BDE: "BDE",
    "Accounts and Finance": "ACCT", Survey: "SVY", Design: "DSN", Drainage: "DRN", "Research and Development": "R&D",
    "Water Supply": "WS", "Civil Engineering": "CIVIL", "Mechanical Engineering": "MECH", "Hydraulics Engineering": "HYD",
    MIS: "MIS", "Data Analytics": "DA", "Human Resources": "HR", Reception: "REC", Security: "SEC", Other: "OTH",
  };
  for (const name of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, code: deptCodes[name] ?? name.slice(0, 4).toUpperCase(), description: `${name} department`, isActive: true },
    });
  }

  // Employment types
  for (const name of DEFAULT_EMPLOYMENT_TYPES) {
    await prisma.employmentType.upsert({ where: { name }, update: {}, create: { name, isActive: true } });
  }

  // Document categories
  for (const c of DOCUMENT_CATEGORIES) {
    await prisma.documentCategory.upsert({ where: { name: c.name }, update: { isRequired: c.isRequired, isActive: true, sortOrder: c.sortOrder }, create: c });
  }

  // Email templates (catalog; HTML bodies rendered in code)
  for (const key of EMAIL_TEMPLATE_KEYS) {
    await prisma.emailTemplate.upsert({ where: { key }, update: { isActive: true }, create: { key, name: key, subject: `EMC - ${key}`, body: `EMC email template for ${key}`, isActive: true } });
  }

  // Programs / projects used when creating vacancies
  const PROGRAMS = [
    "SMART CITY MISSION", "GIS MAPPING PROGRAM", "WATER NETWORK PROGRAM",
    "DRAINAGE MASTER PLAN", "TRANSMISSION NETWORK", "URBAN INFRASTRUCTURE",
  ];
  for (const name of PROGRAMS) {
    await prisma.program.upsert({ where: { name }, update: {}, create: { name, description: `Program ${name}` } });
  }

  // Users
  const itDept = await prisma.department.findFirst({ where: { name: "IT Department" } });
  const hrDept = await prisma.department.findFirst({ where: { name: "Human Resources" } });
  const civilDept = await prisma.department.findFirst({ where: { name: "Civil Engineering" } });

  const superAdmin = await prisma.user.upsert({
    where: { email: env.seedSuperAdminEmail },
    update: { name: env.seedSuperAdminName, isActive: true },
    create: { email: env.seedSuperAdminEmail, name: env.seedSuperAdminName, isActive: true },
  });
  const superAdminRole = await prisma.role.findUnique({ where: { key: ROLES.SUPER_ADMIN } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: superAdminRole!.id } },
    update: {},
    create: { userId: superAdmin.id, roleId: superAdminRole!.id },
  });
  if (hrDept) await prisma.userDepartment.upsert({
    where: { userId_departmentId: { userId: superAdmin.id, departmentId: hrDept.id } },
    update: {}, create: { userId: superAdmin.id, departmentId: hrDept.id },
  });
  await prisma.notificationPreference.upsert({ where: { userId: superAdmin.id }, update: {}, create: { userId: superAdmin.id } });

  const hrAdmin = await prisma.user.upsert({
    where: { email: "hr.admin@emc.example" },
    update: { name: "HR Admin", isActive: true },
    create: { email: "hr.admin@emc.example", name: "HR Admin", isActive: true },
  });
  const hrAdminRole = await prisma.role.findUnique({ where: { key: ROLES.HR_ADMIN } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: hrAdmin.id, roleId: hrAdminRole!.id } },
    update: {}, create: { userId: hrAdmin.id, roleId: hrAdminRole!.id },
  });
  if (hrDept) await prisma.userDepartment.upsert({
    where: { userId_departmentId: { userId: hrAdmin.id, departmentId: hrDept.id } },
    update: {}, create: { userId: hrAdmin.id, departmentId: hrDept.id },
  });

  // IT administrator - can sign in with a password as well as an OTP, and can
  // reset / restore any HR account if something goes wrong.
  const itAdminEmail = env.seedItAdminEmail;
  const itAdmin = await prisma.user.upsert({
    where: { email: itAdminEmail },
    update: { name: "IT Administrator", isActive: true },
    create: { email: itAdminEmail, name: "IT Administrator", isActive: true, passwordHash: hashPassword(env.seedItAdminPassword) },
  });
  if (!itAdmin.passwordHash) {
    await prisma.user.update({ where: { id: itAdmin.id }, data: { passwordHash: hashPassword(env.seedItAdminPassword) } });
  }
  const itAdminRole = await prisma.role.findUnique({ where: { key: ROLES.IT_ADMIN } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: itAdmin.id, roleId: itAdminRole!.id } },
    update: {}, create: { userId: itAdmin.id, roleId: itAdminRole!.id },
  });
  if (itDept) await prisma.userDepartment.upsert({
    where: { userId_departmentId: { userId: itAdmin.id, departmentId: itDept.id } },
    update: {}, create: { userId: itAdmin.id, departmentId: itDept.id },
  });

  // Only create sample data if tables are empty
  const employeeCount = await prisma.employee.count();
  if (employeeCount === 0) {
    const itDep = await prisma.department.findFirst({ where: { name: "IT Department" } });
    const gisDep = await prisma.department.findFirst({ where: { name: "GIS Engineering" } });
    const civilDep = await prisma.department.findFirst({ where: { name: "Civil Engineering" } });
    const waterDep = await prisma.department.findFirst({ where: { name: "Water Supply" } });
    const ft = await prisma.employmentType.findFirst({ where: { name: "Full-Time" } });
    const consultant = await prisma.employmentType.findFirst({ where: { name: "Consultant" } });

    const engDesig = await prisma.designation.create({ data: { name: "GIS Engineer", departmentId: gisDep?.id, isActive: true } });
    const engDesig2 = await prisma.designation.create({ data: { name: "Civil Engineer", departmentId: civilDep?.id, isActive: true } });

    await prisma.employee.create({
      data: {
        employeeCode: "EMP-0001", fullName: "Aanya Sharma", officialEmail: "aanya.sharma@emc.example", personalEmail: "aanya@gmail.example",
        mobile: "+91-98765-00001", departmentId: itDep?.id, designationId: engDesig?.id, qualification: "Graduation", graduationYear: 2016,
        totalExperience: 8, relevantExperience: 6, previousOrganization: "Tech Corp", specialization: "Web Development",
        employmentTypeId: ft?.id, joiningDate: new Date("2018-03-01"), workLocation: "Pune", status: "EXISTING",
      },
    });
    await prisma.employee.create({
      data: {
        employeeCode: "EMP-0002", fullName: "Rohan Verma", officialEmail: "rohan.verma@emc.example", mobile: "+91-98765-00002",
        departmentId: civilDep?.id, designationId: engDesig2?.id, qualification: "Graduation", graduationYear: 2015,
        totalExperience: 9, relevantExperience: 9, previousOrganization: "Build India", specialization: "Structural Design",
        employmentTypeId: ft?.id, joiningDate: new Date("2016-07-10"), workLocation: "Mumbai", status: "EXISTING",
      },
    });
    await prisma.employee.create({
      data: {
        employeeCode: "EMP-0003", fullName: "Sneha Reddy", officialEmail: "sneha.reddy@emc.example", mobile: "+91-98765-00003",
        departmentId: waterDep?.id, qualification: "Post Graduation", graduationYear: 2018, totalExperience: 5,
        relevantExperience: 4, specialization: "Water Resources", employmentTypeId: consultant?.id, joiningDate: new Date("2021-01-15"),
        workLocation: "Hyderabad", status: "EXISTING",
      },
    });
    await prisma.employee.create({
      data: {
        employeeCode: "EMP-0004", fullName: "Karan Singh", officialEmail: "karan.singh@emc.example", mobile: "+91-98765-00004",
        departmentId: gisDep?.id, designationId: engDesig?.id, qualification: "Graduation", graduationYear: 2019,
        totalExperience: 4, relevantExperience: 3, specialization: "GIS Mapping", employmentTypeId: ft?.id, joiningDate: new Date("2020-06-01"),
        workLocation: "Pune", status: "FORMER", leavingDate: new Date("2024-08-31"),
      },
    });
    await prisma.employee.create({
      data: {
        employeeCode: "EMP-0005", fullName: "Meera Joshi", officialEmail: "meera.joshi@emc.example", mobile: "+91-98765-00005",
        departmentId: hrDept?.id, qualification: "Graduation", graduationYear: 2014, totalExperience: 10,
        relevantExperience: 10, specialization: "Human Resources", employmentTypeId: ft?.id, joiningDate: new Date("2015-02-01"),
        workLocation: "Pune", status: "EXISTING",
      },
    });
  }

  const candidateCount = await prisma.candidate.count();
  if (candidateCount === 0) {
    const skillDefs: Array<[string, string[]]> = [
      ["React", ["React", "React.js", "ReactJS"]],
      ["JavaScript", ["JavaScript", "JS"]],
      ["TypeScript", ["TypeScript", "TS"]],
      ["HTML", ["HTML", "HTML5"]],
      ["CSS", ["CSS", "CSS3"]],
      ["Node.js", ["Node.js", "Node", "NodeJS"]],
      ["PostgreSQL", ["PostgreSQL", "Postgres", "PG"]],
      ["AWS", ["AWS", "Amazon Web Services"]],
      ["Docker", ["Docker", "Containerization"]],
      ["GIS", ["GIS", "Geographic Information System"]],
      ["ArcGIS", ["ArcGIS", "ESRI"]],
      ["QGIS", ["QGIS"]],
      ["Python", ["Python"]],
      ["AutoCAD", ["AutoCAD", "Auto CAD"]],
      ["ETABS", ["ETABS"]],
      ["STAAD", ["STAAD", "STAAD.Pro"]],
      ["Civil Engineering", ["Civil Engineering"]],
      ["Drainage", ["Drainage", "Stormwater"]],
      ["Data Analytics", ["Data Analytics", "Analytics"]],
      ["Primavera", ["Primavera", "P6"]],
    ];
    for (const [name, aliases] of skillDefs) {
      await prisma.skill.upsert({ where: { name }, update: { aliases }, create: { name, aliases } });
    }

    const skillByName = async (n: string) => prisma.skill.findUnique({ where: { name: n } });

    await prisma.candidate.create({
      data: { candidateCode: "CAN-0001", fullName: "Priya Nair", email: "priya.nair@example.com", mobile: "+91-90000-00001",
        currentLocation: "Bangalore", qualification: "Graduation", graduationYear: 2020, totalExperience: 3,
        relevantExperience: 2, currentOrganization: "Web Solutions", currentDesignation: "Frontend Developer",
        specialization: "React.js", linkedin: "https://linkedin.com/in/priyanair", emailVerifiedAt: new Date(), status: "ACTIVE",
        skills: { create: (await Promise.all(["React", "JavaScript", "TypeScript", "HTML", "CSS"].map(async (n) => ({ skillId: (await skillByName(n))!.id })))) } },
    });
    await prisma.candidate.create({
      data: { candidateCode: "CAN-0002", fullName: "Arjun Mehta", email: "arjun.mehta@example.com", mobile: "+91-90000-00002",
        currentLocation: "Pune", qualification: "Graduation", graduationYear: 2018, totalExperience: 5,
        relevantExperience: 5, currentOrganization: "Geo Tech", currentDesignation: "GIS Analyst", specialization: "GIS",
        emailVerifiedAt: new Date(), status: "ACTIVE",
        skills: { create: (await Promise.all(["GIS", "ArcGIS", "QGIS", "Python", "PostgreSQL"].map(async (n) => ({ skillId: (await skillByName(n))!.id })))) } },
    });
    await prisma.candidate.create({
      data: { candidateCode: "CAN-0003", fullName: "Divya Iyer", email: "divya.iyer@example.com", mobile: "+91-90000-00003",
        currentLocation: "Chennai", qualification: "Post Graduation", graduationYear: 2019, totalExperience: 4,
        relevantExperience: 3, currentOrganization: "Civil Works", currentDesignation: "Site Engineer", specialization: "Civil Engineering",
        emailVerifiedAt: new Date(), status: "ACTIVE",
        skills: { create: (await Promise.all(["Civil Engineering", "AutoCAD", "ETABS", "STAAD"].map(async (n) => ({ skillId: (await skillByName(n))!.id })))) } },
    });
    await prisma.candidate.create({
      data: { candidateCode: "CAN-0004", fullName: "Vikram Rao", email: "vikram.rao@example.com", mobile: "+91-90000-00004",
        currentLocation: "Remote", qualification: "Graduation", graduationYear: 2021, totalExperience: 2,
        relevantExperience: 1, currentOrganization: "Data Inc", currentDesignation: "Analyst", specialization: "Data Analytics",
        emailVerifiedAt: new Date(), status: "ACTIVE",
        skills: { create: (await Promise.all(["Python", "Data Analytics", "PostgreSQL"].map(async (n) => ({ skillId: (await skillByName(n))!.id })))) } },
    });
  }

  const openingCount = await prisma.jobOpening.count();
  if (openingCount === 0) {
    const itDep = await prisma.department.findFirst({ where: { name: "IT Department" } });
    const gisDep = await prisma.department.findFirst({ where: { name: "GIS Engineering" } });
    const civilDep = await prisma.department.findFirst({ where: { name: "Civil Engineering" } });
    const waterDep = await prisma.department.findFirst({ where: { name: "Water Supply" } });
    const ft = await prisma.employmentType.findFirst({ where: { name: "Full-Time" } });

    await prisma.jobOpening.create({
      data: {
        jobCode: "JOB-101", title: "Senior GIS Engineer", departmentId: gisDep!.id, positions: 2, location: "Pune",
        employmentTypeId: ft!.id, requiredQualification: "Bachelor in GIS or Computer Science", minExperience: 3, maxExperience: 8,
        relevantExperience: 3, requiredSkills: ["GIS", "ArcGIS", "PostgreSQL", "Python"], preferredSkills: ["QGIS", "Remote Sensing"],
        description: "Design and maintain GIS databases and web mapping applications.",
        responsibilities: "Spatial analysis, map production, database management.",
        startDate: new Date(), deadline: new Date(Date.now() + 30 * 86400000), status: "PUBLISHED",
        publishedAt: new Date(), createdById: superAdmin.id,
      },
    });
    await prisma.jobOpening.create({
      data: {
        jobCode: "JOB-102", title: "Civil Engineer (Drainage)", departmentId: civilDep!.id, positions: 3, location: "Mumbai",
        employmentTypeId: ft!.id, requiredQualification: "Bachelor in Civil Engineering", minExperience: 2, maxExperience: 7,
        relevantExperience: 2, requiredSkills: ["AutoCAD", "ETABS", "Civil Engineering", "Drainage"],
        preferredSkills: ["STAAD", "Primavera"],
        description: "Design drainage and stormwater systems for urban projects.",
        responsibilities: "Site surveys, design calculations, coordination.",
        startDate: new Date(), deadline: new Date(Date.now() + 15 * 86400000), status: "PUBLISHED",
        publishedAt: new Date(), createdById: hrAdmin.id,
      },
    });
    await prisma.jobOpening.create({
      data: {
        jobCode: "JOB-103", title: "Full Stack Developer", departmentId: itDep!.id, positions: 2, location: "Remote",
        employmentTypeId: ft!.id, requiredQualification: "Bachelor in Computer Science", minExperience: 2, maxExperience: 6,
        relevantExperience: 2, requiredSkills: ["JavaScript", "React", "Node.js", "PostgreSQL"],
        preferredSkills: ["TypeScript", "AWS"],
        description: "Develop web applications for internal HR and operations.",
        responsibilities: "Feature development, code review, testing.",
        startDate: new Date(), deadline: new Date(Date.now() + 45 * 86400000), status: "PUBLISHED",
        publishedAt: new Date(), createdById: superAdmin.id,
      },
    });
    await prisma.jobOpening.create({
      data: {
        jobCode: "JOB-104", title: "Water Resources Specialist", departmentId: waterDep!.id, positions: 1, location: "Hyderabad",
        employmentTypeId: ft!.id, requiredQualification: "Post Graduation in Water Resources", minExperience: 4, maxExperience: 10,
        relevantExperience: 4, requiredSkills: ["Water Supply", "Hydraulics", "Hydrology"],
        preferredSkills: ["GIS", "AutoCAD"],
        description: "Water supply network design and analysis.",
        responsibilities: "Network modeling, field coordination.",
        startDate: new Date(), deadline: new Date(Date.now() + 60 * 86400000), status: "DRAFT",
        createdById: hrAdmin.id,
      },
    });
  }

  const applicationCount = await prisma.application.count();
  if (applicationCount === 0) {
    const can1 = await prisma.candidate.findFirst({ where: { email: "priya.nair@example.com" } });
    const can2 = await prisma.candidate.findFirst({ where: { email: "arjun.mehta@example.com" } });
    const can3 = await prisma.candidate.findFirst({ where: { email: "divya.iyer@example.com" } });
    const job1 = await prisma.jobOpening.findFirst({ where: { jobCode: "JOB-101" } });
    const job2 = await prisma.jobOpening.findFirst({ where: { jobCode: "JOB-102" } });
    const job3 = await prisma.jobOpening.findFirst({ where: { jobCode: "JOB-103" } });
    if (can1 && job1) await prisma.application.create({ data: { applicationCode: "APP-0001", candidateId: can1.id, jobOpeningId: job1.id, status: "SHORTLISTED", aiMatchScore: 87 } });
    if (can2 && job1) await prisma.application.create({ data: { applicationCode: "APP-0002", candidateId: can2.id, jobOpeningId: job1.id, status: "APPLIED", aiMatchScore: 72 } });
    if (can3 && job2) await prisma.application.create({ data: { applicationCode: "APP-0003", candidateId: can3.id, jobOpeningId: job2.id, status: "INTERVIEW_SCHEDULED", aiMatchScore: 81 } });
    if (can1 && job3) await prisma.application.create({ data: { applicationCode: "APP-0004", candidateId: can1.id, jobOpeningId: job3.id, status: "REJECTED", aiMatchScore: 55 } });
    if (can2 && job3) await prisma.application.create({ data: { applicationCode: "APP-0005", candidateId: can2.id, jobOpeningId: job3.id, status: "ON_HOLD", aiMatchScore: 64 } });
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
