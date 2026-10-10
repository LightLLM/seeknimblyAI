/**
 * Manufacturing vertical packs — roles, certifications, OH&S calendar, audit extras.
 * Used by training/compliance agents and skill-pack metadata. Guidance only.
 */

export type MfgRole = {
  id: string;
  title: string;
  department: "production" | "maintenance" | "quality" | "warehouse" | "supervision";
  typical_certs: string[];
  notes?: string;
};

export type MfgCalendarItem = {
  when: string;
  what: string;
  who: string;
  jurisdictions?: string[];
};

/** Core plant roles for recruiting / onboarding / training templates. */
export const MFG_ROLES: MfgRole[] = [
  {
    id: "operator",
    title: "Production Operator",
    department: "production",
    typical_certs: ["WHMIS / HazCom", "Machine-specific lockout awareness", "PPE orientation"],
  },
  {
    id: "machine_operator",
    title: "CNC / Machine Operator",
    department: "production",
    typical_certs: ["WHMIS / HazCom", "Lockout/Tagout (LOTO)", "Hearing conservation (if applicable)"],
  },
  {
    id: "forklift",
    title: "Forklift / Material Handler",
    department: "warehouse",
    typical_certs: ["Forklift / powered industrial truck certification", "WHMIS / HazCom", "Pedestrian safety"],
  },
  {
    id: "warehouse",
    title: "Warehouse Associate",
    department: "warehouse",
    typical_certs: ["WHMIS / HazCom", "Manual handling / ergonomics", "Forklift (if assigned)"],
  },
  {
    id: "maintenance",
    title: "Maintenance Technician",
    department: "maintenance",
    typical_certs: ["Lockout/Tagout (LOTO)", "Electrical safety / arc flash awareness", "Confined space (if applicable)", "WHMIS / HazCom"],
  },
  {
    id: "qa",
    title: "Quality Assurance / Inspector",
    department: "quality",
    typical_certs: ["WHMIS / HazCom", "GMP / food safety (if food plant)", "Document control basics"],
  },
  {
    id: "supervisor",
    title: "Production Supervisor",
    department: "supervision",
    typical_certs: [
      "Supervisor health & safety awareness (provincial)",
      "Incident investigation basics",
      "Harassment & violence prevention",
      "WHMIS / HazCom",
    ],
  },
  {
    id: "ehs",
    title: "EHS / Safety Coordinator",
    department: "supervision",
    typical_certs: ["JHSC certification (where required)", "First aid (site standard)", "Incident investigation", "WHMIS trainer (optional)"],
  },
];

/** Role-keyed training additions beyond provincial mandatory lists. */
export const MFG_ROLE_TRAINING: Record<string, string[]> = {
  operator: ["Plant orientation & emergency exits", "PPE requirements", "Machine guarding awareness", "WHMIS / HazCom"],
  machine_operator: ["Lockout/Tagout (LOTO)", "Machine-specific SOP sign-off", "WHMIS / HazCom"],
  forklift: ["Forklift / PIT practical + theory certification", "Pedestrian & aisle rules", "WHMIS / HazCom"],
  warehouse: ["Manual material handling", "Rack & storage safety", "WHMIS / HazCom"],
  maintenance: ["Lockout/Tagout (LOTO) authorized", "Hot work permit process (if used)", "Confined space entry (if applicable)"],
  qa: ["GMP / hygiene (food plants)", "Nonconformance & CAPA basics", "WHMIS / HazCom"],
  supervisor: ["Supervisor OHS legal duties", "Refusal of unsafe work process", "Incident reporting & investigation"],
  ehs: ["Internal audit / inspection cadence", "Workers' compensation claim intake", "Emergency response plan drill"],
};

/** Plant OH&S / workers' comp recurring items (additive to general CRA calendar). */
export const MFG_COMPLIANCE_CALENDAR: MfgCalendarItem[] = [
  {
    when: "On hire / before unsupervised work",
    what: "New / young worker orientation (OHS) + role-specific safety training recorded",
    who: "All manufacturing employers",
  },
  {
    when: "Before operating PIT",
    what: "Forklift / powered industrial truck certification current",
    who: "Sites with forklifts / reach trucks",
  },
  {
    when: "Before servicing equipment",
    what: "Lockout/Tagout (LOTO) authorized training for maintenance",
    who: "Maintenance and authorized operators",
  },
  {
    when: "Annual / per JHSC rules",
    what: "Joint Health & Safety Committee meetings + workplace inspections",
    who: "ON/BC/AB/QC plants meeting headcount thresholds",
    jurisdictions: ["ON", "BC", "AB", "QC"],
  },
  {
    when: "When SDS / chemicals change",
    what: "WHMIS / HazCom label + SDS access + worker training refresh",
    who: "Plants with hazardous products",
  },
  {
    when: "After recordable incident",
    what: "Incident investigation + corrective actions logged; regulator notice if required",
    who: "All manufacturing employers",
  },
  {
    when: "Mar 31 (ON)",
    what: "WSIB annual reconciliation / premium reporting",
    who: "Ontario manufacturers",
    jurisdictions: ["ON"],
  },
  {
    when: "Feb 28 / Mar (BC)",
    what: "WorkSafeBC annual payroll / classification review",
    who: "BC manufacturers",
    jurisdictions: ["BC"],
  },
  {
    when: "Ongoing",
    what: "Workers' compensation rate group / classification matches actual operations (misclass risk)",
    who: "All plants",
  },
];

/** Extra audit lines for manufacturing clients (appended to 12-point SMB checklist). */
export const MFG_AUDIT_EXTRAS: string[] = [
  "13. Manufacturing: forklift / PIT certifications current for assigned operators",
  "14. Manufacturing: Lockout/Tagout program documented; authorized workers trained",
  "15. Manufacturing: WHMIS/HazCom — SDS accessible; training records on file",
  "16. Manufacturing: JHSC / health & safety rep structure meets provincial thresholds",
  "17. Manufacturing: new/young worker orientations completed before unsupervised work",
  "18. Manufacturing: workers' comp classification matches plant operations (not under-classified)",
  "19. Manufacturing: machine guarding / PPE policies acknowledged",
  "20. Manufacturing: supervisor OHS duty training completed",
];

export function resolveMfgRoleId(roleOrId: string | undefined | null): string | null {
  if (!roleOrId) return null;
  const raw = roleOrId.trim().toLowerCase();
  if (MFG_ROLE_TRAINING[raw]) return raw;
  const byTitle = MFG_ROLES.find(
    (r) => r.id === raw || r.title.toLowerCase() === raw || r.title.toLowerCase().includes(raw)
  );
  return byTitle?.id ?? null;
}

export function manufacturingTrainingForRole(roleOrId: string | undefined | null): string[] {
  const id = resolveMfgRoleId(roleOrId);
  if (!id) return ["Plant orientation", "WHMIS / HazCom (if hazardous materials)", "Emergency exits & muster"];
  return MFG_ROLE_TRAINING[id] ?? [];
}

export function isManufacturingVertical(vertical: string | undefined | null): boolean {
  if (!vertical) return false;
  const v = vertical.trim().toLowerCase();
  return (
    v.includes("manufactur") ||
    v.includes("plant") ||
    v.includes("factory") ||
    v.includes("industrial") ||
    v === "mfg"
  );
}
