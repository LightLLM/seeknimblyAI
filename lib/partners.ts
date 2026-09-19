/**
 * Channel-partner surface: accounting firms (highest-leverage ICP) manage
 * many SMB clients under one Seeknimbly login. Partners are leads flagged
 * is_channel_partner; clients link via channel_partner_lead_id.
 */

import { listRows } from "@/lib/store";

export type PartnerFirm = {
  lead_id: string;
  company: string;
  contact_name: string | null;
  contact_email: string | null;
  province: string | null;
  stage: string | null;
  score: number | null;
  clients: {
    id: string;
    legal_name: string;
    status: string | null;
    provinces: string | null;
    employee_count: number | null;
    industry: string | null;
    modules: string[];
  }[];
};

export async function listPartnerPortfolio(): Promise<{
  partners: PartnerFirm[];
  unassigned_clients: number;
  total_clients_under_partners: number;
}> {
  const [leads, clients, modules] = await Promise.all([
    listRows("leads", { limit: 200 }),
    listRows("clients", { limit: 200 }),
    listRows("client_modules", { limit: 400 }),
  ]);

  const partnerLeads = leads.filter((l) => Boolean(l.is_channel_partner));
  const modsFor = (clientId: string) =>
    modules.filter((m) => m.client_id === clientId).map((m) => String(m.module));

  const partners: PartnerFirm[] = partnerLeads.map((p) => {
    const linked = clients.filter((c) => String(c.channel_partner_lead_id ?? "") === String(p.id));
    return {
      lead_id: String(p.id),
      company: String(p.company ?? "Partner"),
      contact_name: (p.contact_name as string) ?? null,
      contact_email: (p.contact_email as string) ?? null,
      province: (p.province as string) ?? null,
      stage: (p.stage as string) ?? null,
      score: typeof p.score === "number" ? p.score : null,
      clients: linked.map((c) => ({
        id: String(c.id),
        legal_name: String(c.legal_name ?? "Client"),
        status: (c.status as string) ?? null,
        provinces: (c.provinces as string) ?? null,
        employee_count: typeof c.employee_count === "number" ? c.employee_count : null,
        industry: (c.industry as string) ?? null,
        modules: modsFor(String(c.id)),
      })),
    };
  });

  const assigned = new Set(
    clients.filter((c) => c.channel_partner_lead_id).map((c) => String(c.id))
  );
  const unassigned_clients = clients.filter((c) => !assigned.has(String(c.id))).length;
  const total_clients_under_partners = partners.reduce((n, p) => n + p.clients.length, 0);

  return { partners, unassigned_clients, total_clients_under_partners };
}
