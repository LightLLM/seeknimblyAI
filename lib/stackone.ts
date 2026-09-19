/**
 * StackOne unified HRIS connector — Workday, ADP, Dayforce, etc. via one MCP/API.
 */

export type StackOneVendor = {
  id: string;
  label: string;
  blurb: string;
  docs: string;
};

export const STACKONE_VENDORS: StackOneVendor[] = [
  {
    id: "workday",
    label: "Workday",
    blurb: "HCM, recruiting, and workforce data via StackOne MCP tools.",
    docs: "https://www.stackone.com/connectors/workday/mcp/",
  },
  {
    id: "adp",
    label: "ADP Workforce Now",
    blurb: "Workers, hire/rehire events, and payroll-adjacent HRIS actions.",
    docs: "https://www.stackone.com/connectors/adpworkforcenow/mcp/",
  },
  {
    id: "dayforce",
    label: "Dayforce",
    blurb: "Ceridian Dayforce employees, time, and HRIS objects.",
    docs: "https://www.stackone.com/connectors/dayforce/mcp/",
  },
  {
    id: "sap",
    label: "SAP SuccessFactors",
    blurb: "Enterprise HCM via StackOne’s SAP connector family when enabled.",
    docs: "https://www.stackone.com/",
  },
];

export function isStackOneConfigured(): boolean {
  return Boolean(process.env.STACKONE_API_KEY?.trim());
}

export function getStackOneMcpUrl(accountId: string): string {
  const id = encodeURIComponent(accountId.trim());
  return `https://api.stackone.com/mcp?x-account-id=${id}`;
}
