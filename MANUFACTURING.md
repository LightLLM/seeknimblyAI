# Seeknimbly for Manufacturing — Roadmap

**Goal:** Become the Workday / Dayforce equivalent for mid-market manufacturing — agent-first workforce + safety/compliance — without cloning the full HCM suite on day one.

**Positioning:** Works *with* Dayforce / Workday / ADP (StackOne); wins on plant-floor staffing, certs, OH&S, and human-approved automation.

## ICP

- Plants: 50–500 employees (later 500–2,000)
- Discrete manufacturing + food/packaging first
- Geographies: ON, BC, AB, QC → US Midwest
- Buyer: plant HR / EHS / ops leader; influencer: fractional CHRO / PE ops

## Coded vertical packs (shipped)

| Pack id | Agent | Contents |
|---------|--------|----------|
| `recruiting.manufacturing` | recruiting | Plant role templates |
| `onboarding.manufacturing` | onboarding | Pre-floor safety gate concepts |
| `training.manufacturing` | training | Forklift, LOTO, WHMIS, supervisor OHS |
| `compliance.manufacturing` | compliance | OH&S calendar + audit extras |

Domain data: `lib/manufacturing/catalog.ts`  
Tools: `get_mandatory_training` (role/vertical), `list_compliance_calendar`, `run_audit_checklist`  
Skill metadata: `lib/agents/skill-packs.ts`

## Phased roadmap

### Phase 0 — Focus (0–60 days)
- [x] Manufacturing skill packs + catalog
- [x] Training/compliance tools accept `vertical=manufacturing`
- [ ] Freeze GTM messaging to manufacturing plants
- [ ] 3 design-partner plants
- [ ] Metrics: cert expiry, compliance events, time-to-fill operators

### Phase 1 — Wedge beside Dayforce/Workday (months 2–6)
- [ ] Plant org fields: shift, department, cost center, job code on jobs/hires
- [ ] StackOne live sync (Dayforce *or* Workday employees)
- [ ] HR Specialist desk: `hr_cases` + handoff card + daily plant digest automation
- [ ] Widen `requiresApproval` for hire/exit/policy mutations
- [ ] Supervisor-facing approvals UX (mobile-friendly)

### Phase 2 — Workforce (months 6–12)
- [ ] Time & attendance lite (punch import, absences, OT rules)
- [ ] Open-shift / internal mobility via Recruiting agent
- [ ] Union / CBA rule pack (optional module)
- [ ] Partner payroll tax filing (do not build full payroll yet)

### Phase 3 — System of record (months 12–24)
- [ ] Core HRIS employee master for mid-market plants
- [ ] Benefits workflows or partner
- [ ] Selective payroll for plants that want a simpler stack
- [ ] Multi-site / multi-province
- [ ] SOC2 Type II

### Phase 4 — Platform (months 24–36)
- [ ] Plant analytics: OT cost, turnover by shift, training gaps, incidents
- [ ] Channel: PE manufacturing groups, staffing firms
- [ ] Adjacent verticals only after manufacturing playbook repeats

## Success metrics

- Time-to-fill for operators
- % workforce with valid mandatory certs
- Overtime / classification exceptions caught
- Supervisor approval turnaround
- NRR on manufacturing logos
- “Would replace Dayforce module X” from design partners

## Hard rules (unchanged)

Draft-never-send · guidance not legal advice · human gates on consequential actions · audit everything · escalate live disputes · no filing with regulators.
