import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Skip header/footer on cover page

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#475569"))

        # Header
        self.drawString(54, 11 * inch - 36, "Brickwell Pvt. Ltd. — Construction Project Management System")
        self.drawRightString(8.5 * inch - 54, 11 * inch - 36, "Change Impact Assessment Report")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)

        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 54, 36, page_text)
        self.drawString(54, 36, "CONFIDENTIAL — FOR MANAGEMENT & MD APPROVAL ONLY")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 48, 8.5 * inch - 54, 48)

        self.restoreState()

def build_pdf(filename="Construction_Project_Management_System_Proposed_Changes_and_Impact_Assessment.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Color Palette
    PRIMARY = colors.HexColor("#1E3A8A")      # Deep Navy / Slate
    SECONDARY = colors.HexColor("#0D9488")    # Teal Accent
    DARK_TEXT = colors.HexColor("#0F172A")    # Dark Slate Text
    MUTED_TEXT = colors.HexColor("#475569")   # Muted Slate
    LIGHT_BG = colors.HexColor("#F8FAFC")     # Soft Off-White
    BORDER_COLOR = colors.HexColor("#E2E8F0") # Light Border
    ALERT_BG = colors.HexColor("#EFF6FF")     # Soft Blue Alert
    WARNING_BG = colors.HexColor("#FEF3C7")   # Amber Alert
    SUCCESS_BG = colors.HexColor("#DCFCE7")   # Green Alert

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=30,
        textColor=PRIMARY,
        spaceAfter=12
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=SECONDARY,
        spaceAfter=24
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=PRIMARY,
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=SECONDARY,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=DARK_TEXT,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=DARK_TEXT,
        leftIndent=12,
        spaceAfter=4
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=PRIMARY
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
        alignment=0
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=DARK_TEXT
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=DARK_TEXT
    )

    story = []

    # =========================================================================
    # COVER / HEADER TITLE BLOCK
    # =========================================================================
    story.append(Spacer(1, 15))
    story.append(Paragraph("Brickwell Pvt. Ltd.", ParagraphStyle('CompanyHeader', fontName='Helvetica-Bold', fontSize=14, textColor=SECONDARY, spaceAfter=4)))
    story.append(Paragraph("Construction Project Management System", title_style))
    story.append(Paragraph("Comprehensive Requirements Audit, Change Impact Analysis & Company Approval Report", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=PRIMARY, spaceAfter=15))

    # Meta Table
    meta_data = [
        [Paragraph("<b>Document Type:</b> Formal Change Impact Audit Report", body_style), Paragraph("<b>Audit Status:</b> STRICTLY READ-ONLY (No Code/Data Altered)", body_style)],
        [Paragraph("<b>Prepared For:</b> Company Owner & Management (Brickwell Pvt. Ltd.)", body_style), Paragraph("<b>Date:</b> October 2, 2026", body_style)],
        [Paragraph("<b>Author:</b> Senior Lead Systems Architect & AI Pair Programmer", body_style), Paragraph("<b>Target Stack:</b> React 19, Vite, TanStack Router, Supabase RLS", body_style)]
    ]
    t_meta = Table(meta_data, colWidths=[3.25*inch, 3.75*inch])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 15))

    # Executive Warning Alert
    alert_content = [
        [Paragraph("<b>CRITICAL AUDIT DIRECTIVE & ASSURANCE:</b><br/>This document constitutes a thorough, non-destructive audit of the requested application updates. In full compliance with Phase 6 execution rules, <b>NO SOURCE CODE, DATABASE SCHEMAS, RLS POLICIES, FINANCIAL CALCULATIONS, OR PRODUCTION RECORDS HAVE BEEN ALTERED</b>. Implementation remains frozen pending formal management approval.", callout_style)]
    ]
    t_alert = Table(alert_content, colWidths=[7.0*inch])
    t_alert.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), WARNING_BG),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#F59E0B")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_alert)
    story.append(Spacer(1, 15))

    # =========================================================================
    # SECTION 1: EXECUTIVE SUMMARY
    # =========================================================================
    story.append(Paragraph("1. Executive Summary", h1_style))
    story.append(Paragraph(
        "Following feedback from company management at Brickwell Pvt. Ltd., this technical audit was commissioned to evaluate six major system update requests and a comprehensive overhaul of the labour attendance and wage tracking module. The primary goal is to ensure that requested enhancements—such as interactive dashboard drill-downs, role-based financial privacy, payroll restructuring, and detailed expense breakdowns—are implemented without compromising database integrity, financial accuracy, auditability, or existing business logic.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Key Takeaways of the Audit:</b>", body_style
    ))
    story.append(Paragraph("• <b>High Architectural Integrity:</b> The current application leverages a modern React 19 + TanStack Router frontend paired with a robust Supabase PostgreSQL backend enforced by Row-Level Security (RLS). Changes must align with this decoupled architecture.", bullet_style))
    story.append(Paragraph("• <b>Financial Privacy Gap Identified:</b> Sensitivity analysis reveals that dashboard financial figures (Contract Value, 6-Month Spend, Cash on Hand) are currently visible to all authenticated roles (`viewer`, `supervisor`, `accounts`, `md`). Restricted role-based access requires backend RLS updates in addition to UI conditional rendering.", bullet_style))
    story.append(Paragraph("• <b>Payroll Removal Risk:</b> Deleting the Payroll module entirely would eliminate monthly compliance records, statutory deduction tracking (PF/ESIC), payslip generation, and formal MD approval workflows. We strongly recommend an <b>integrated Attendance-Payroll model</b> over complete deletion.", bullet_style))
    story.append(Paragraph("• <b>Labour Attendance Standardized:</b> The proposed weekly Attendance and Wage Register perfectly matches the Brickwell reference sheet (13.09.2026 to 19.09.2026), supporting daily worker time tracking, fractional units, team summaries, allowances, advances, and dynamic balances.", bullet_style))

    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 2: EXISTING SYSTEM OVERVIEW
    # =========================================================================
    story.append(Paragraph("2. Existing System Overview", h1_style))
    story.append(Paragraph(
        "A comprehensive code and schema inspection of the codebase (Corpus: <code>Ajaykannagit/track-site</code>) established the actual application architecture across all major functional areas:",
        body_style
    ))

    arch_data = [
        [Paragraph("Module / Domain", table_header_style), Paragraph("Source Files & Code Locations", table_header_style), Paragraph("Database Tables & Helper Functions", table_header_style), Paragraph("Current Operational Logic & Roles", table_header_style)],
        [
            Paragraph("<b>Auth & Roles</b>", table_cell_bold),
            Paragraph("<code>src/lib/auth.tsx</code><br/><code>src/routes/_authenticated/route.tsx</code>", table_cell_style),
            Paragraph("<code>user_roles</code> table<br/><code>public.can_write_finance()</code><br/><code>public.can_write_site()</code>", table_cell_style),
            Paragraph("Roles: <code>md</code>, <code>supervisor</code>, <code>accounts</code>, <code>viewer</code>. Gate checks session; RLS policies govern SQL mutations.", table_cell_style)
        ],
        [
            Paragraph("<b>Dashboard & P&L</b>", table_cell_bold),
            Paragraph("<code>src/routes/_authenticated/dashboard.tsx</code><br/><code>src/routes/_authenticated/reports.tsx</code>", table_cell_style),
            Paragraph("<code>projects</code>, <code>expenses</code>, <code>attendance</code>, <code>contractor_bills</code>, <code>cash_closing</code>, <code>v_project_summary</code>", table_cell_style),
            Paragraph("Computes live project values, 6-month site spend, cash on hand, monthly cost trends, and project-wise profit margins.", table_cell_style)
        ],
        [
            Paragraph("<b>Labour & Attendance</b>", table_cell_bold),
            Paragraph("<code>src/routes/_authenticated/attendance.tsx</code><br/><code>src/routes/_authenticated/payroll.tsx</code>", table_cell_style),
            Paragraph("<code>attendance</code>, <code>employees</code>, <code>payroll</code>, <code>payroll_items</code>", table_cell_style),
            Paragraph("Logs daily working hours, OT, status (present/absent/half_day/leave). Payroll stores monthly gross, deductions, net pay.", table_cell_style)
        ],
        [
            Paragraph("<b>Procurement & Supply</b>", table_cell_bold),
            Paragraph("<code>src/routes/_authenticated/materials.tsx</code>", table_cell_style),
            Paragraph("<code>suppliers</code>, <code>material_requests</code>, <code>purchase_orders</code>, <code>material_receipts</code>, <code>supplier_payments</code>", table_cell_style),
            Paragraph("Full procurement pipeline: Indent (MR) -> Purchase Order (PO) -> Material Receipt (GRN) -> Supplier Payment.", table_cell_style)
        ],
        [
            Paragraph("<b>Subcontractors</b>", table_cell_bold),
            Paragraph("<code>src/routes/_authenticated/contractors.tsx</code>", table_cell_style),
            Paragraph("<code>contractors</code>, <code>work_orders</code>, <code>measurement_books</code>, <code>contractor_bills</code>, <code>contractor_payments</code>", table_cell_style),
            Paragraph("Tracks piece-rate/lump-sum work orders (WO), physical measurements (MB), net billing (CB), and disbursements.", table_cell_style)
        ],
        [
            Paragraph("<b>Accounts & Cash</b>", table_cell_bold),
            Paragraph("<code>src/routes/_authenticated/accounts.tsx</code>", table_cell_style),
            Paragraph("<code>expenses</code>, <code>expense_categories</code>, <code>cash_closing</code>, <code>account_transfers</code>", table_cell_style),
            Paragraph("Records site consumables & overheads, daily cash closings (petty cash vs bank account), and account transfers.", table_cell_style)
        ]
    ]
    t_arch = Table(arch_data, colWidths=[1.1*inch, 2.0*inch, 2.0*inch, 1.9*inch])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG])
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 15))

    # =========================================================================
    # SECTION 3: INDIVIDUAL REQUIREMENT ASSESSMENTS
    # =========================================================================
    story.append(Paragraph("3. Individual Requirement Assessments", h1_style))

    # Requirement 1
    story.append(Paragraph("UPDATE 1 — Dashboard Active Projects and Contract Value", h2_style))
    story.append(Paragraph("<b>Current State:</b> Active Projects count is calculated dynamically as <code>projects.data.filter(p => p.status === 'active').length</code>. Contract Value is <code>sum(projects.quotation_amount)</code>. Currently, these StatCards are non-interactive summaries.", body_style))
    story.append(Paragraph("<b>Proposed Technical Changes:</b><br/>"
                           "1. Make 'Active Projects' StatCard clickable, opening a filtered list or modal displaying active projects (code, name, start date, contract value, cost so far).<br/>"
                           "2. Make 'Contract Value' clickable, triggering a detailed financial modal/drawer showing project-wise breakdown: Quotation Value, Material Cost, Labour Cost, Contractor Cost, Petty Cash Expenses, Loans/Advances, and Net Margin.<br/>"
                           "<b>Dependencies & Double-Counting Safeguards:</b> Must avoid double-counting transactions between <code>material_receipts</code> (GRN value) and <code>supplier_payments</code> (cash paid out), or <code>attendance</code> (wages earned) and <code>payroll</code> (salary paid).", body_style))
    story.append(Paragraph("<b>Complexity:</b> Low–Medium. <b>Risk:</b> Low (read-only UI aggregation).", body_style))

    story.append(Spacer(1, 8))

    # Requirement 2
    story.append(Paragraph("UPDATE 2 — Financial Privacy and Role-Based Dashboard Access", h2_style))
    story.append(Paragraph("<b>Current State:</b> Database RLS policies for `projects`, `expenses`, `attendance`, and `cash_closing` grant `SELECT` access to all `authenticated` users. Consequently, any logged-in user (`viewer`, `supervisor`, `accounts`, `md`) can view financial totals.", body_style))
    story.append(Paragraph("<b>Proposed Technical Changes & Permission Matrix:</b><br/>"
                           "The owner requests hiding financial metrics from non-management staff. We propose a strict role matrix where financial totals are suppressed in UI components for `supervisor` and `viewer`, and backend RLS column security or filtered API endpoints prevent direct inspection.", body_style))

    # Proposed Matrix Table
    matrix_data = [
        [Paragraph("Role Name", table_header_style), Paragraph("Project Info", table_header_style), Paragraph("Financial Figures", table_header_style), Paragraph("Transaction Entry", table_header_style), Paragraph("Approval & Edits", table_header_style), Paragraph("Deletion", table_header_style)],
        [Paragraph("<b>Company Owner / MD</b>", table_cell_bold), Paragraph("Full Access", table_cell_style), Paragraph("Full Access", table_cell_style), Paragraph("Full Access", table_cell_style), Paragraph("Full Approver", table_cell_style), Paragraph("Allowed", table_cell_style)],
        [Paragraph("<b>Admin</b>", table_cell_bold), Paragraph("Full Access", table_cell_style), Paragraph("Full Access", table_cell_style), Paragraph("Full Access", table_cell_style), Paragraph("Full Approver", table_cell_style), Paragraph("Allowed", table_cell_style)],
        [Paragraph("<b>Accounts Staff</b>", table_cell_bold), Paragraph("Full Access", table_cell_style), Paragraph("Full Access", table_cell_style), Paragraph("Enter Payments/Expenses", table_cell_style), Paragraph("Edit Drafts", table_cell_style), Paragraph("Restricted", table_cell_style)],
        [Paragraph("<b>Site Supervisor</b>", table_cell_bold), Paragraph("Assigned Projects", table_cell_style), Paragraph("<b>HIDDEN</b>", table_cell_bold), Paragraph("Enter Attendance/Indents", table_cell_style), Paragraph("Submit Drafts", table_cell_style), Paragraph("Prohibited", table_cell_style)],
        [Paragraph("<b>Ordinary Employee / Viewer</b>", table_cell_bold), Paragraph("Read-Only General", table_cell_style), Paragraph("<b>HIDDEN</b>", table_cell_bold), Paragraph("Prohibited", table_cell_style), Paragraph("Prohibited", table_cell_style), Paragraph("Prohibited", table_cell_style)]
    ]
    t_matrix = Table(matrix_data, colWidths=[1.4*inch, 1.1*inch, 1.1*inch, 1.2*inch, 1.1*inch, 1.1*inch])
    t_matrix.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG])
    ]))
    story.append(t_matrix)
    story.append(Spacer(1, 8))

    # Requirement 3
    story.append(Paragraph("UPDATE 3 — Labour Attendance, Wages, and Payroll Removal Evaluation", h2_style))
    story.append(Paragraph("<b>Current State:</b> Payroll (`src/routes/_authenticated/payroll.tsx`) manages monthly salary runs (`payroll`) and payslip lines (`payroll_items`), calculating gross pay, deductions (PF/ESIC/advances), and net pay with MD approval buttons. Attendance (`src/routes/_authenticated/attendance.tsx`) logs daily attendance hours and daily wages.", body_style))
    story.append(Paragraph("<b>Analysis of Alternatives:</b>", body_style))
    story.append(Paragraph("• <b>Option A (Complete Removal of Payroll):</b> Move advance tracking and weekly settlement directly into Attendance. <i>Disadvantages:</i> Destroys monthly statutory compliance records, eliminates payslip generation, loses historical audit trails, and removes formal payroll run approvals.", bullet_style))
    story.append(Paragraph("• <b>Option B (Integrated Attendance-Payroll Model — RECOMMENDED):</b> Keep Attendance as the single source of daily wage entry, and auto-populate weekly/monthly settlement reports in Payroll for settlement and disbursement. <i>Advantages:</i> Zero data loss, total financial compliance, streamlined UI.", bullet_style))
    story.append(Paragraph("<b>Complexity:</b> High. <b>Risk:</b> High if data is deleted; Low if integrated.", body_style))

    story.append(Spacer(1, 8))

    # Requirement 4
    story.append(Paragraph("UPDATE 4 — Dashboard Spend Breakdown", h2_style))
    story.append(Paragraph("<b>Current State:</b> StatCard 'Spend (6 months)' sums `expenses.amount` + `attendance.calculated_wage`. It currently represents recorded site operational costs + labour wages, NOT raw material purchases.", body_style))
    story.append(Paragraph("<b>Proposed Technical Changes:</b> Make 'Spend' clickable to open a Material Expenditure Breakdown drawer, showing material costs grouped by item/category (e.g. Cement, Steel, Sand, Hardware) sourced from `material_receipts` or tagged `expenses.material_name`. Ensure clear UI distinction between operational expenses and material purchases.", body_style))
    story.append(Paragraph("<b>Complexity:</b> Medium. <b>Risk:</b> Low (prevents misinterpretation of financial figures).", body_style))

    story.append(Spacer(1, 8))

    # Requirement 5
    story.append(Paragraph("UPDATE 5 — Office Expenses Section", h2_style))
    story.append(Paragraph("<b>Current State:</b> `expenses` table supports categories like 'Stationery', 'Telephone/Internet', 'Travel', 'Professional Fees', 'Bank Charges'. Unallocated office costs have `project_id = NULL`.", body_style))
    story.append(Paragraph("<b>Proposed Technical Changes:</b> Add a dedicated 'Office Expenses' filter/dashboard widget querying `expenses` where `project_id IS NULL` or category belongs to administrative overhead. This reuses existing schema and avoids creating duplicate transaction structures.", body_style))
    story.append(Paragraph("<b>Complexity:</b> Low. <b>Risk:</b> Low.", body_style))

    story.append(Spacer(1, 8))

    # Requirement 6
    story.append(Paragraph("UPDATE 6 — Materials, Suppliers, Contractors & Subcontractors", h2_style))
    story.append(Paragraph("<b>Current State:</b> Materials and Contractors have separate data workflows. Subcontractors use `work_orders` and `contractor_bills` (lump-sum/unit-rate billing), while daily labour uses `attendance`.", body_style))
    story.append(Paragraph("<b>Analysis & Ambiguity Findings:</b>", body_style))
    story.append(Paragraph("• <i>Subcontractor Attendance vs Billing:</i> Subcontractors are paid per Work Order milestones/measurements, not daily wages. Subcontractor attendance should be tracked as 'Gang Presence' without generating daily wage liabilities.", bullet_style))
    story.append(Paragraph("• <i>Material Supply Categories:</i> Notes mention dividing material supply into two types (e.g. Ordinary Suppliers vs Subcontract-inclusive Material Suppliers). Clarification required from management.", bullet_style))
    story.append(Paragraph("<b>Complexity:</b> High. <b>Risk:</b> Medium (requires strict separation of contractor billing models).", body_style))

    story.append(Spacer(1, 12))

    # =========================================================================
    # SECTION 4: PHASE 3 — LABOUR ATTENDANCE AND WAGE REGISTER AUDIT
    # =========================================================================
    story.append(Paragraph("4. Labour Attendance & Wage Register (Brickwell Specification)", h1_style))
    story.append(Paragraph("Using the official reference document (<b>'Brickwell Pvt Ltd 13.09.2026 to 19.09.2026'</b>), we have audited the exact specifications for the requested weekly construction labour register:", body_style))

    ref_data = [
        [Paragraph("Worker Name", table_header_style), Paragraph("Designation", table_header_style), Paragraph("Daily Wage (₹)", table_header_style), Paragraph("Reference Team", table_header_style), Paragraph("7-Day Sample Attendance & Units", table_header_style), Paragraph("Calculated Wage (₹)", table_header_style)],
        [Paragraph("Vinoth", table_cell_bold), Paragraph("Mason old", table_cell_style), Paragraph("1,100", table_cell_style), Paragraph("Vinoth Team", table_cell_style), Paragraph("7.5 days (worked overtime)", table_cell_style), Paragraph("₹8,250", table_cell_style)],
        [Paragraph("Krishna", table_cell_bold), Paragraph("Mason", table_cell_style), Paragraph("1,100", table_cell_style), Paragraph("Vinoth Team", table_cell_style), Paragraph("7.0 days", table_cell_style), Paragraph("₹7,700", table_cell_style)],
        [Paragraph("Errana", table_cell_bold), Paragraph("Helper", table_cell_style), Paragraph("750", table_cell_style), Paragraph("Errana Team", table_cell_style), Paragraph("8.0 days (inc. Sunday shift)", table_cell_style), Paragraph("₹6,000", table_cell_style)],
        [Paragraph("Ragunath", table_cell_bold), Paragraph("Helper", table_cell_style), Paragraph("750", table_cell_style), Paragraph("Errana Team", table_cell_style), Paragraph("8.0 days", table_cell_style), Paragraph("₹6,000", table_cell_style)],
        [Paragraph("Sanjay", table_cell_bold), Paragraph("Mason", table_cell_style), Paragraph("1,100", table_cell_style), Paragraph("Sathish Team", table_cell_style), Paragraph("7.0 days", table_cell_style), Paragraph("₹7,700", table_cell_style)],
        [Paragraph("Gowtham", table_cell_bold), Paragraph("Helper", table_cell_style), Paragraph("750", table_cell_style), Paragraph("Sathish Team", table_cell_style), Paragraph("8.0 days", table_cell_style), Paragraph("₹6,000", table_cell_style)],
        [Paragraph("Narasamma", table_cell_bold), Paragraph("Helper", table_cell_style), Paragraph("500", table_cell_style), Paragraph("Narasamma Team", table_cell_style), Paragraph("8.5 days", table_cell_style), Paragraph("₹4,250", table_cell_style)],
        [Paragraph("Ravi", table_cell_bold), Paragraph("Mason", table_cell_style), Paragraph("1,100", table_cell_style), Paragraph("Vinoth Team", table_cell_style), Paragraph("7.0 days", table_cell_style), Paragraph("₹7,700", table_cell_style)],
        [Paragraph("Madesh", table_cell_bold), Paragraph("Helper", table_cell_style), Paragraph("750", table_cell_style), Paragraph("Errana Team", table_cell_style), Paragraph("8.0 days", table_cell_style), Paragraph("₹6,000", table_cell_style)],
        [Paragraph("Sathish", table_cell_bold), Paragraph("Mason", table_cell_style), Paragraph("1,100", table_cell_style), Paragraph("Sathish Team", table_cell_style), Paragraph("7.0 days", table_cell_style), Paragraph("₹7,700", table_cell_style)],
        [Paragraph("Beema", table_cell_bold), Paragraph("Helper", table_cell_style), Paragraph("750", table_cell_style), Paragraph("Sathish Team", table_cell_style), Paragraph("8.0 days", table_cell_style), Paragraph("₹6,000", table_cell_style)],
        [Paragraph("Rammapppa", table_cell_bold), Paragraph("Helper", table_cell_style), Paragraph("750", table_cell_style), Paragraph("Sathish Team", table_cell_style), Paragraph("8.0 days", table_cell_style), Paragraph("₹6,000", table_cell_style)]
    ]
    t_ref = Table(ref_data, colWidths=[1.1*inch, 1.0*inch, 1.0*inch, 1.1*inch, 1.6*inch, 1.2*inch])
    t_ref.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG])
    ]))
    story.append(t_ref)
    story.append(Spacer(1, 10))

    # Reference Reconciliation Box
    recon_box = [
        [Paragraph("<b>OFFICIAL REGISTER RECONCILIATION TOTALS (13.09.2026 to 19.09.2026):</b><br/>"
                   "• <b>Total Attendance Units:</b> 94.5 Units<br/>"
                   "• <b>Gross Calculated Wages:</b> ₹64,425<br/>"
                   "• <b>Bus / Petrol Allowances:</b> ₹320<br/>"
                   "• <b>Advances Deducted:</b> ₹0<br/>"
                   "• <b>Net Wage Balance Due:</b> <b>₹64,745</b> (Formula: <code>Calculated Wage + Bus/Petrol - Advance</code>)", callout_style)]
    ]
    t_recon = Table(recon_box, colWidths=[7.0*inch])
    t_recon.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SUCCESS_BG),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#16A34A")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_recon)
    story.append(Spacer(1, 15))

    # =========================================================================
    # SECTION 5: BEFORE-AND-AFTER WORKFLOW EXPLANATIONS
    # =========================================================================
    story.append(Paragraph("5. Before-and-After Workflow Explanations", h1_style))
    story.append(Paragraph("To help non-technical management visualize the changes, the table below illustrates how primary operations currently function versus how they will operate post-approval:", body_style))

    wf_data = [
        [Paragraph("Workflow Area", table_header_style), Paragraph("Current Workflow Implementation", table_header_style), Paragraph("Proposed Post-Approval Workflow", table_header_style)],
        [
            Paragraph("<b>Dashboard Financial Drill-down</b>", table_cell_bold),
            Paragraph("Static StatCards displaying total active projects, contract value, and spend. No drill-down available.", table_cell_style),
            Paragraph("Authorized users click StatCards to launch detailed financial modals (project breakdown, material expenditure, net margins).", table_cell_style)
        ],
        [
            Paragraph("<b>Role-Based Financial Privacy</b>", table_cell_bold),
            Paragraph("All logged-in users see financial cards and project values on dashboard and reports.", table_cell_style),
            Paragraph("Strict UI & RLS restrictions hide financial metrics from `supervisor` and `viewer` roles, reserving them for `md`, `admin`, and `accounts`.", table_cell_style)
        ],
        [
            Paragraph("<b>Labour Attendance & Weekly Wages</b>", table_cell_bold),
            Paragraph("Single daily entry form per worker/contractor. Weekly spreadsheet register not present.", table_cell_style),
            Paragraph("Spreadsheet-like 7-day Weekly Attendance Register with site allocation, fractional units, team totals, allowances, and Saturday payment tracking.", table_cell_style)
        ],
        [
            Paragraph("<b>Payroll & Monthly Settlement</b>", table_cell_bold),
            Paragraph("Standalone Monthly Payroll module with manual gross/deduction inputs and MD approval.", table_cell_style),
            Paragraph("Integrated Model: Weekly attendance auto-populates monthly settlement runs in Payroll, preserving statutory records and MD approvals.", table_cell_style)
        ],
        [
            Paragraph("<b>Office Overhead Expenses</b>", table_cell_bold),
            Paragraph("Office costs mixed into site expenses or unallocated records.", table_cell_style),
            Paragraph("Dedicated 'Office Expenses' dashboard widget filtering overheads (`project_id IS NULL`), preventing duplicate transactions.", table_cell_style)
        ]
    ]
    t_wf = Table(wf_data, colWidths=[1.5*inch, 2.7*inch, 2.8*inch])
    t_wf.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG])
    ]))
    story.append(t_wf)
    story.append(Spacer(1, 15))

    # =========================================================================
    # SECTION 6: DEPENDENCY AND IMPACT MATRIX
    # =========================================================================
    story.append(Paragraph("6. Dependency and Impact Matrix", h1_style))
    story.append(Paragraph("The matrix below maps each requested update to affected codebase modules, database tables, financial calculations, and security policies:", body_style))

    dep_data = [
        [Paragraph("Req ID", table_header_style), Paragraph("Requirement Description", table_header_style), Paragraph("Affected Code Modules", table_header_style), Paragraph("Affected DB Tables / RLS", table_header_style), Paragraph("Financial / Calculation Impact", table_header_style)],
        [
            Paragraph("<b>UPD-01</b>", table_cell_bold),
            Paragraph("Clickable Dashboard Projects & Contract Value", table_cell_style),
            Paragraph("`dashboard.tsx`, `StatCard.tsx`", table_cell_style),
            Paragraph("`projects`, `v_project_summary`", table_cell_style),
            Paragraph("Requires accurate non-double-counted aggregation of GRNs, wages, bills, and expenses.", table_cell_style)
        ],
        [
            Paragraph("<b>UPD-02</b>", table_cell_bold),
            Paragraph("Financial Privacy & Role-Based Dashboard", table_cell_style),
            Paragraph("`auth.tsx`, `dashboard.tsx`, `reports.tsx`", table_cell_style),
            Paragraph("RLS policies on `projects`, `expenses`, `attendance`", table_cell_style),
            Paragraph("Prevents unauthorized viewing of financial assets, cash on hand, and revenue.", table_cell_style)
        ],
        [
            Paragraph("<b>UPD-03</b>", table_cell_bold),
            Paragraph("Payroll vs Attendance Restructuring", table_cell_style),
            Paragraph("`attendance.tsx`, `payroll.tsx`", table_cell_style),
            Paragraph("`attendance`, `payroll`, `payroll_items`", table_cell_style),
            Paragraph("Impacts wage calculations, advance recovery, statutory deductions, and payslips.", table_cell_style)
        ],
        [
            Paragraph("<b>UPD-04</b>", table_cell_bold),
            Paragraph("Clickable Spend & Material Cost Breakdown", table_cell_style),
            Paragraph("`dashboard.tsx`, `materials.tsx`", table_cell_style),
            Paragraph("`material_receipts`, `expenses`", table_cell_style),
            Paragraph("Distinguishes material procurement (GRN) from site operational expenses.", table_cell_style)
        ],
        [
            Paragraph("<b>UPD-05</b>", table_cell_bold),
            Paragraph("Dedicated Office Expenses Section", table_cell_style),
            Paragraph("`dashboard.tsx`, `accounts.tsx`", table_cell_style),
            Paragraph("`expenses`, `expense_categories`", table_cell_style),
            Paragraph("Isolates corporate administrative costs from direct project expenditure.", table_cell_style)
        ],
        [
            Paragraph("<b>UPD-06</b>", table_cell_bold),
            Paragraph("Material Suppliers & Subcontractors", table_cell_style),
            Paragraph("`contractors.tsx`, `materials.tsx`", table_cell_style),
            Paragraph("`contractors`, `work_orders`, `suppliers`", table_cell_style),
            Paragraph("Separates piece-rate milestone payments from daily wage attendance.", table_cell_style)
        ],
        [
            Paragraph("<b>ATT-01</b>", table_cell_bold),
            Paragraph("Weekly Attendance & Wage Register", table_cell_style),
            Paragraph("`attendance.tsx`", table_cell_style),
            Paragraph("`attendance`, `employees`", table_cell_style),
            Paragraph("Standardizes `Wage Balance = Wage + Allowance - Advance` across weekly Saturday runs.", table_cell_style)
        ]
    ]
    t_dep = Table(dep_data, colWidths=[0.7*inch, 1.6*inch, 1.5*inch, 1.5*inch, 1.7*inch])
    t_dep.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG])
    ]))
    story.append(t_dep)
    story.append(Spacer(1, 15))

    # =========================================================================
    # SECTION 7: COMPLEXITY, RISK SUMMARY & ALTERNATIVES
    # =========================================================================
    story.append(Paragraph("7. Complexity, Risk Summary & Alternatives", h1_style))
    story.append(Paragraph("Each requested update has been assigned a technical complexity rating based on codebase impact, risk profile, and recommended mitigation:", body_style))

    risk_data = [
        [Paragraph("Req ID", table_header_style), Paragraph("Complexity Level", table_header_style), Paragraph("Identified Technical & Business Risks", table_header_style), Paragraph("Recommended Risk Mitigation Strategy", table_header_style)],
        [
            Paragraph("UPD-01", table_cell_bold),
            Paragraph("<font color='#D97706'><b>Medium</b></font>", table_cell_style),
            Paragraph("Double-counting when combining GRN costs and expense lines.", table_cell_style),
            Paragraph("Use explicit SQL views (`v_project_summary`) with strict single-source joins.", table_cell_style)
        ],
        [
            Paragraph("UPD-02", table_cell_bold),
            Paragraph("<font color='#DC2626'><b>High</b></font>", table_cell_style),
            Paragraph("UI hiding without backend RLS enforcement allows API data leaks.", table_cell_style),
            Paragraph("Implement Database RLS policies restricting financial columns by user role.", table_cell_style)
        ],
        [
            Paragraph("UPD-03", table_cell_bold),
            Paragraph("<font color='#DC2626'><b>Critical</b></font>", table_cell_style),
            Paragraph("Deleting Payroll causes loss of statutory records and payslips.", table_cell_style),
            Paragraph("<b>Adopt Option B:</b> Integrate Attendance daily entry with Payroll monthly runs.", table_cell_style)
        ],
        [
            Paragraph("UPD-04", table_cell_bold),
            Paragraph("<font color='#D97706'><b>Medium</b></font>", table_cell_style),
            Paragraph("Confusing general operational spend with material receipts.", table_cell_style),
            Paragraph("Label dashboard cards clearly (e.g. 'Site Spend' vs 'Material GRN Purchases').", table_cell_style)
        ],
        [
            Paragraph("UPD-05", table_cell_bold),
            Paragraph("<font color='#16A34A'><b>Low</b></font>", table_cell_style),
            Paragraph("Creating duplicate expense records for office overheads.", table_cell_style),
            Paragraph("Filter existing `expenses` table where `project_id IS NULL`.", table_cell_style)
        ],
        [
            Paragraph("UPD-06", table_cell_bold),
            Paragraph("<font color='#DC2626'><b>High</b></font>", table_cell_style),
            Paragraph("Misapplying daily wage calculations to milestone subcontracts.", table_cell_style),
            Paragraph("Keep Work Orders (`work_orders`) distinct from daily attendance wages.", table_cell_style)
        ],
        [
            Paragraph("ATT-01", table_cell_bold),
            Paragraph("<font color='#D97706'><b>Medium</b></font>", table_cell_style),
            Paragraph("Performance degradation when loading 7-day grids for large worker teams.", table_cell_style),
            Paragraph("Use memoized React grid tables with paginated weekly date ranges.", table_cell_style)
        ]
    ]
    t_risk = Table(risk_data, colWidths=[0.8*inch, 1.2*inch, 2.5*inch, 2.5*inch])
    t_risk.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG])
    ]))
    story.append(t_risk)
    story.append(Spacer(1, 15))

    # =========================================================================
    # SECTION 8: QUESTIONS REQUIRING COMPANY CLARIFICATION
    # =========================================================================
    story.append(Paragraph("8. Questions Requiring Company Clarification", h1_style))
    story.append(Paragraph("Before implementation can begin, company management must provide formal written clarification on the following unresolved business rules:", body_style))

    q_data = [
        [Paragraph("No.", table_header_style), Paragraph("Unresolved Requirement / Ambiguity", table_header_style), Paragraph("Specific Business Decision Needed from Management", table_header_style), Paragraph("Management Decision / Selection", table_header_style)],
        [
            Paragraph("1", table_cell_bold),
            Paragraph("<b>Financial Privacy Access Rights</b>", table_cell_style),
            Paragraph("Meeting notes mention both 'MD-only' and 'Admin-only'. Exactly which roles are allowed to view financial totals, contract values, and cash on hand?", table_cell_style),
            Paragraph("[ ] MD Only<br/>[ ] MD + Admin<br/>[ ] MD + Admin + Accounts", table_cell_style)
        ],
        [
            Paragraph("2", table_cell_bold),
            Paragraph("<b>Payroll Module Architecture</b>", table_cell_style),
            Paragraph("Should the Payroll module be completely removed, or integrated with Attendance to preserve monthly payslips, PF/ESIC deductions, and MD approval workflows?", table_cell_style),
            Paragraph("[ ] Remove Payroll<br/>[ ] <b>Integrate with Attendance (Rec.)</b><br/>[ ] Retain Standalone", table_cell_style)
        ],
        [
            Paragraph("3", table_cell_bold),
            Paragraph("<b>Subcontractor Payment Formula</b>", table_cell_style),
            Paragraph("Are subcontractors paid based on daily attendance hours, work order milestone completion (MB), or a fixed contract amount?", table_cell_style),
            Paragraph("[ ] Work Order Milestones<br/>[ ] Daily Attendance<br/>[ ] Combination", table_cell_style)
        ],
        [
            Paragraph("4", table_cell_bold),
            Paragraph("<b>Material Supply Categories</b>", table_cell_style),
            Paragraph("Meeting notes refer to dividing material supply into 'two types' and mention the number 'ten'. What does the second type represent?", table_cell_style),
            Paragraph("[ ] Bulk vs Consumable<br/>[ ] Supply vs Subcontract<br/>[ ] Other: _____________", table_cell_style)
        ],
        [
            Paragraph("5", table_cell_bold),
            Paragraph("<b>Fractional Attendance & Overtime Rules</b>", table_cell_style),
            Paragraph("Does 1.5 attendance units represent 1.5 shifts of normal rate, or standard working hours + 1.5x overtime multiplier?", table_cell_style),
            Paragraph("[ ] 1.5 Shifts at Normal Rate<br/>[ ] Standard + Overtime Rate<br/>[ ] Configurable Rule", table_cell_style)
        ]
    ]
    t_q = Table(q_data, colWidths=[0.4*inch, 2.0*inch, 2.6*inch, 2.0*inch])
    t_q.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG])
    ]))
    story.append(t_q)
    story.append(Spacer(1, 15))

    # =========================================================================
    # SECTION 9: COMPANY APPROVAL CHECKLIST
    # =========================================================================
    story.append(Paragraph("9. Company Approval Checklist", h1_style))
    story.append(Paragraph("Management may individually Approve, Reject, or Request Revision for each item below:", body_style))

    app_data = [
        [Paragraph("Req ID", table_header_style), Paragraph("Requirement Description", table_header_style), Paragraph("Management Decision", table_header_style), Paragraph("Company Comments / Modification Notes", table_header_style), Paragraph("Approver Signature & Date", table_header_style)],
        [Paragraph("UPD-01", table_cell_bold), Paragraph("Clickable Active Projects & Contract Value Summary", table_cell_style), Paragraph("[ ] Approve<br/>[ ] Reject<br/>[ ] Revise", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)],
        [Paragraph("UPD-02", table_cell_bold), Paragraph("Financial Privacy & Role-Based Access Controls", table_cell_style), Paragraph("[ ] Approve<br/>[ ] Reject<br/>[ ] Revise", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)],
        [Paragraph("UPD-03", table_cell_bold), Paragraph("Labour Attendance & Payroll Restructuring", table_cell_style), Paragraph("[ ] Approve<br/>[ ] Reject<br/>[ ] Revise", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)],
        [Paragraph("UPD-04", table_cell_bold), Paragraph("Clickable Dashboard Spend & Material Breakdown", table_cell_style), Paragraph("[ ] Approve<br/>[ ] Reject<br/>[ ] Revise", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)],
        [Paragraph("UPD-05", table_cell_bold), Paragraph("Dedicated Office Overhead Expenses Section", table_cell_style), Paragraph("[ ] Approve<br/>[ ] Reject<br/>[ ] Revise", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)],
        [Paragraph("UPD-06", table_cell_bold), Paragraph("Subcontractor & Material Supplier Management", table_cell_style), Paragraph("[ ] Approve<br/>[ ] Reject<br/>[ ] Revise", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)],
        [Paragraph("ATT-01", table_cell_bold), Paragraph("Weekly 7-Day Attendance Register & Wage Sheet", table_cell_style), Paragraph("[ ] Approve<br/>[ ] Reject<br/>[ ] Revise", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)]
    ]
    t_app = Table(app_data, colWidths=[0.7*inch, 2.0*inch, 1.3*inch, 1.6*inch, 1.4*inch])
    t_app.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG])
    ]))
    story.append(t_app)
    story.append(Spacer(1, 15))

    # =========================================================================
    # SECTION 10 & 11: IMPLEMENTATION PLAN & TECHNICAL EVIDENCE
    # =========================================================================
    story.append(Paragraph("10. Proposed Implementation Sequence (Post-Approval)", h1_style))
    story.append(Paragraph("Once management approvals and clarifications are received, implementation will follow a strict 4-phase technical roadmap:", body_style))
    story.append(Paragraph("<b>Phase A — Foundation & Security (Week 1):</b> Implement Role-Based Financial Privacy (UPD-02) across RLS policies and UI components. Update role definitions in <code>src/lib/auth.tsx</code>.", bullet_style))
    story.append(Paragraph("<b>Phase B — Attendance & Payroll Integration (Week 2):</b> Build the spreadsheet-like 7-Day Weekly Attendance Register (ATT-01). Connect wage calculations directly to monthly Payroll runs (UPD-03).", bullet_style))
    story.append(Paragraph("<b>Phase C — Subcontractor & Procurement Workflows (Week 3):</b> Enhance Subcontractor Work Order tracking (UPD-06) and configure Office Overhead filtering (UPD-05).", bullet_style))
    story.append(Paragraph("<b>Phase D — Interactive Dashboard & Drill-downs (Week 4):</b> Connect clickable StatCards (UPD-01, UPD-04) for Active Projects, Contract Values, and Material Spend breakdowns.", bullet_style))

    story.append(Spacer(1, 10))

    story.append(Paragraph("11. Technical Evidence & Verification Log", h1_style))
    story.append(Paragraph("This audit was performed strictly on the local repository (Corpus: <code>Ajaykannagit/track-site</code>). Key inspected files and artifacts:", body_style))
    story.append(Paragraph("• <code>src/lib/auth.tsx</code> — Authentication context & role permission flags (`isMD`, `canWriteFinance`, `canWriteSite`).", bullet_style))
    story.append(Paragraph("• <code>src/routes/_authenticated/dashboard.tsx</code> — Dashboard metrics and StatCard components.", bullet_style))
    story.append(Paragraph("• <code>src/routes/_authenticated/attendance.tsx</code> — Daily attendance logging & wage calculations.", bullet_style))
    story.append(Paragraph("• <code>src/routes/_authenticated/payroll.tsx</code> — Payroll runs, payslip lines & MD approval logic.", bullet_style))
    story.append(Paragraph("• <code>supabase/migrations/20260918040000_production_enhancements.sql</code> — Database helper views (`v_project_summary`, `v_contractor_outstanding`).", bullet_style))

    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=1, color=SECONDARY, spaceAfter=10))
    story.append(Paragraph("<b>REPORT END — BRICKWELL PVT. LTD. MANAGEMENT AUDIT</b>", ParagraphStyle('EndReport', fontName='Helvetica-Bold', fontSize=10, textColor=PRIMARY, alignment=1)))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully generated at: {os.path.abspath(filename)}")

if __name__ == "__main__":
    build_pdf()
