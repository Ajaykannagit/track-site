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

class VisualSummaryNumberedCanvas(canvas.Canvas):
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
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#0D9488")) # Teal
        self.drawString(54, 11 * inch - 36, "BRICKWELL PVT. LTD.")
        
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#475569"))
        self.drawString(160, 11 * inch - 36, "— Proposed System Updates: Visual Workflow & Permission Guide")
        self.drawRightString(8.5 * inch - 54, 11 * inch - 36, "Executive Summary Document")
        
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)

        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 54, 32, page_text)
        self.drawString(54, 32, "CONFIDENTIAL — FOR MD & DEVELOPER DIRECT REVIEW")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 44, 8.5 * inch - 54, 44)

        self.restoreState()

def build_pdf(filename="Brickwell_System_Updates_Visual_Workflow_Guide.pdf"):
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
    PRIMARY = colors.HexColor("#1E3A8A")      # Navy Blue
    SECONDARY = colors.HexColor("#0D9488")    # Teal Accent
    DARK_TEXT = colors.HexColor("#0F172A")    # Dark Slate
    MUTED_TEXT = colors.HexColor("#475569")   # Muted Slate
    LIGHT_BG = colors.HexColor("#F8FAFC")     # Soft Off-White
    BORDER_COLOR = colors.HexColor("#E2E8F0") # Border Light
    HEADER_BG = colors.HexColor("#1E293B")    # Slate Header
    WORKFLOW_BG = colors.HexColor("#F1F5F9")  # Workflow Step BG
    ARROW_COLOR = colors.HexColor("#0D9488")  # Arrow Color
    PENDING_BG = colors.HexColor("#FEF3C7")   # Amber Alert
    ALLOWED_COLOR = colors.HexColor("#16A34A") # Green Text
    RESTRICTED_COLOR = colors.HexColor("#DC2626") # Red Text

    # Typography Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=28,
        textColor=PRIMARY,
        spaceAfter=8
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=SECONDARY,
        spaceAfter=18
    )

    update_title_style = ParagraphStyle(
        'UpdateTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.white
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=PRIMARY,
        spaceBefore=6,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=DARK_TEXT,
        spaceAfter=4
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=DARK_TEXT,
        leftIndent=8,
        spaceAfter=3
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=0
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=DARK_TEXT
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=DARK_TEXT
    )

    wf_step_style = ParagraphStyle(
        'WfStep',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=PRIMARY,
        alignment=1
    )

    wf_arrow_style = ParagraphStyle(
        'WfArrow',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=12,
        textColor=SECONDARY,
        alignment=1
    )

    pending_style = ParagraphStyle(
        'PendingText',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#B45309")
    )

    story = []

    # =========================================================================
    # COVER TITLE BLOCK
    # =========================================================================
    story.append(Spacer(1, 10))
    story.append(Paragraph("Brickwell Pvt. Ltd. — System Update Reference", ParagraphStyle('CompanyHeader', fontName='Helvetica-Bold', fontSize=12, textColor=SECONDARY, spaceAfter=2)))
    story.append(Paragraph("Proposed Updates: Visual Workflow & Permission Guide", title_style))
    story.append(Paragraph("Executive Overview of Current States, Proposed Changes, Role Permission Matrices, and User Journeys", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=PRIMARY, spaceAfter=12))

    # Document Control Summary
    doc_meta = [
        [
            Paragraph("<b>Target Audience:</b> Managing Director & Development Team", body_style),
            Paragraph("<b>Document Purpose:</b> High-level visual guide & approval roadmap", body_style)
        ],
        [
            Paragraph("<b>Scope:</b> Updates UPD-01 to UPD-06 and ATT-01", body_style),
            Paragraph("<b>Format:</b> Concise 1-Page Summary Per System Update", body_style)
        ]
    ]
    t_doc_meta = Table(doc_meta, colWidths=[3.5*inch, 3.5*inch])
    t_doc_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_doc_meta)
    story.append(Spacer(1, 12))

    # Helper function to render a visual workflow diagram
    def make_workflow_diagram(steps):
        """Builds a horizontal flow diagram of steps separated by arrows."""
        n_steps = len(steps)
        row_items = []
        col_widths = []
        
        # Calculate width dynamically
        step_width = (7.0 - (n_steps - 1) * 0.35) / n_steps
        
        for i, step_text in enumerate(steps):
            # Step Box
            p_step = Paragraph(step_text, wf_step_style)
            t_box = Table([[p_step]], colWidths=[step_width*inch], rowHeights=[0.45*inch])
            t_box.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), WORKFLOW_BG),
                ('BOX', (0,0), (-1,-1), 1, SECONDARY),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('PADDING', (0,0), (-1,-1), 2),
            ]))
            row_items.append(t_box)
            col_widths.append(step_width*inch)
            
            # Arrow (if not last)
            if i < n_steps - 1:
                p_arrow = Paragraph("<b>➔</b>", wf_arrow_style)
                t_arrow = Table([[p_arrow]], colWidths=[0.35*inch], rowHeights=[0.45*inch])
                t_arrow.setStyle(TableStyle([
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                    ('PADDING', (0,0), (-1,-1), 0),
                ]))
                row_items.append(t_arrow)
                col_widths.append(0.35*inch)
                
        t_flow = Table([row_items], colWidths=col_widths)
        t_flow.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('PADDING', (0,0), (-1,-1), 0),
        ]))
        return t_flow

    # Helper function to generate an Update Block
    def add_update_section(upd_id, upd_name, current_state, proposed_update, matrix_rows, workflow_steps, pending_notes=None):
        # 1. Title Banner
        banner_table = Table([[Paragraph(f"<b>{upd_id} — {upd_name}</b>", update_title_style)]], colWidths=[7.0*inch])
        banner_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), HEADER_BG),
            ('PADDING', (0,0), (-1,-1), 6),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(banner_table)
        story.append(Spacer(1, 6))

        # 2. Content & Permission Matrix Split Table
        # Left Side: Current State & Proposed Update
        left_flow = []
        left_flow.append(Paragraph("<b>Current State:</b>", h2_style))
        for bullet in current_state:
            left_flow.append(Paragraph(f"• {bullet}", bullet_style))
        left_flow.append(Spacer(1, 4))
        left_flow.append(Paragraph("<b>Proposed Update:</b>", h2_style))
        for bullet in proposed_update:
            left_flow.append(Paragraph(f"• {bullet}", bullet_style))

        if pending_notes:
            left_flow.append(Spacer(1, 4))
            p_box = Table([[Paragraph(f"<b>Pending Confirmation:</b> {pending_notes}", pending_style)]], colWidths=[3.7*inch])
            p_box.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), PENDING_BG),
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#F59E0B")),
                ('PADDING', (0,0), (-1,-1), 4),
            ]))
            left_flow.append(p_box)

        # Right Side: Permission Matrix
        matrix_header = [Paragraph("Role", table_header_style), Paragraph("Access / Action Permitted", table_header_style)]
        matrix_data = [matrix_header]
        for role, perm in matrix_rows:
            p_perm_style = table_cell_style
            if "Allowed" in perm or "Full" in perm or "View" in perm:
                p_perm = Paragraph(f"<font color='#16A34A'><b>{perm}</b></font>", table_cell_style)
            elif "Restricted" in perm or "Hidden" in perm or "Prohibited" in perm:
                p_perm = Paragraph(f"<font color='#DC2626'><b>{perm}</b></font>", table_cell_style)
            else:
                p_perm = Paragraph(perm, table_cell_style)
            matrix_data.append([Paragraph(f"<b>{role}</b>", table_cell_bold), p_perm])

        t_matrix = Table(matrix_data, colWidths=[1.1*inch, 1.9*inch])
        t_matrix.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), SECONDARY),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('PADDING', (0,0), (-1,-1), 4),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG])
        ]))

        right_flow = [
            Paragraph("<b>Permission Matrix:</b>", h2_style),
            t_matrix
        ]

        split_table = Table([[left_flow, right_flow]], colWidths=[3.9*inch, 3.1*inch])
        split_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('PADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(split_table)
        story.append(Spacer(1, 6))

        # 3. Workflow Diagram
        story.append(Paragraph("<b>User Workflow Journey:</b>", h2_style))
        story.append(Spacer(1, 2))
        story.append(make_workflow_diagram(workflow_steps))
        story.append(Spacer(1, 14))

    # =========================================================================
    # UPD-01
    # =========================================================================
    add_update_section(
        upd_id="UPD-01",
        upd_name="Dashboard Active Projects & Contract Value Summary",
        current_state=[
            "Active Projects StatCard displays total active count as static non-clickable text.",
            "Contract Value StatCard displays overall total quotation amount across all projects as a static summary."
        ],
        proposed_update=[
            "<b>Clickable Active Projects:</b> Clicking launches a modal displaying the 3 active projects with quotation vs cost summary.",
            "<b>Clickable Contract Value:</b> Clicking opens a financial drawer with project-wise breakdown (contract value, material, labour, contractor, petty cash, and margin)."
        ],
        matrix_rows=[
            ("MD / Owner", "Allowed (View & Click Breakdown)"),
            ("Accounts", "Allowed (View & Click Breakdown)"),
            ("Site Supervisor", "Restricted (Hidden / Non-clickable)"),
            ("Viewer", "Restricted (Hidden / Non-clickable)")
        ],
        workflow_steps=[
            "Dashboard",
            "Click StatCard\n(Active / Contract)",
            "Financial Modal /\nBreakdown Drawer",
            "Select Project",
            "View Full Project\nFinancial Details"
        ]
    )

    # =========================================================================
    # UPD-02
    # =========================================================================
    add_update_section(
        upd_id="UPD-02",
        upd_name="Financial Privacy & Role-Based Dashboard Access",
        current_state=[
            "Financial figures (Contract Value, Spend, Cash on Hand) are exposed to all logged-in roles.",
            "Database permissions grant `SELECT` access to all `authenticated` users without role-based column guards."
        ],
        proposed_update=[
            "Restricts sensitive financial amounts exclusively to authorized management roles.",
            "Hides financial StatCards in UI and enforces backend Row-Level Security (RLS) policies to block API inspection for non-management users."
        ],
        matrix_rows=[
            ("MD / Owner", "Allowed (Full Financial Access)"),
            ("Accounts Staff", "Allowed (View & Enter Financials)"),
            ("Site Supervisor", "Restricted (Financials Hidden)"),
            ("Viewer", "Restricted (Financials Hidden)")
        ],
        workflow_steps=[
            "User Login",
            "System Checks\nRole Rights",
            "Financial Guard\nEvaluated",
            "Authorized: Full View\nRestricted: Site Only",
            "Render Tailored\nDashboard Screen"
        ],
        pending_notes="Final confirmation required whether financial access is restricted strictly to MD-only or includes Admin/Accounts."
    )

    # =========================================================================
    # UPD-03
    # =========================================================================
    add_update_section(
        upd_id="UPD-03",
        upd_name="Labour Attendance & Payroll Module Restructuring",
        current_state=[
            "Payroll page handles monthly wage runs, gross pay, deductions (PF/ESIC), net pay, and MD approvals.",
            "Attendance page logs daily working hours and daily calculated wages independently."
        ],
        proposed_update=[
            "Integrates daily Attendance entry with weekly/monthly salary handling.",
            "Auto-populates weekly balances, advances, and monthly settlement runs from daily attendance while preserving payslips, statutory deductions, and MD approvals."
        ],
        matrix_rows=[
            ("MD / Owner", "Allowed (Full Edit & Approve Runs)"),
            ("Accounts Staff", "Allowed (Prepare Runs & Deductions)"),
            ("Site Supervisor", "Enter Daily Site Attendance Only"),
            ("Viewer", "Read-Only (Non-Financial)")
        ],
        workflow_steps=[
            "Log Daily Worker\nAttendance (Site)",
            "System Aggregates\nWeekly Wages",
            "Accounts Inputs\nAdvances/Deductions",
            "Generate Integrated\nPayroll Run",
            "MD Approves Run\n& Payslips"
        ],
        pending_notes="Pending Management Confirmation: Complete removal of Payroll UI vs Integrated Attendance-Payroll Model (Recommended)."
    )

    # =========================================================================
    # UPD-04
    # =========================================================================
    add_update_section(
        upd_id="UPD-04",
        upd_name="Dashboard Spend Breakdown & Material Costs",
        current_state=[
            "Spend StatCard sums expenses + site wages over 6 months as a single static figure.",
            "Material procurement costs are not broken down by material type on the main dashboard."
        ],
        proposed_update=[
            "Makes the Spend StatCard clickable to display a detailed Material Expenditure Breakdown drawer.",
            "Groups material costs by category (Cement, Steel, Sand, Hardware) sourced from Material Receipts (GRN) and tagged expenses."
        ],
        matrix_rows=[
            ("MD / Owner", "Allowed (View & Click Spend Drawer)"),
            ("Accounts Staff", "Allowed (View & Click Spend Drawer)"),
            ("Site Supervisor", "Restricted (Hidden)"),
            ("Viewer", "Restricted (Hidden)")
        ],
        workflow_steps=[
            "Dashboard",
            "Click 'Spend (6M)'\nStatCard",
            "Material Spend\nBreakdown Drawer",
            "Select Category\n(Cement / Steel)",
            "View Detailed Material\nReceipt Invoices"
        ]
    )

    # =========================================================================
    # UPD-05
    # =========================================================================
    add_update_section(
        upd_id="UPD-05",
        upd_name="Dedicated Office Overhead Expenses Section",
        current_state=[
            "Office overheads (stationery, internet, travel, bank charges) are mixed into site expenses or saved with `project_id = NULL`.",
            "No isolated dashboard view exists for administrative corporate expenses."
        ],
        proposed_update=[
            "Adds a dedicated 'Office Expenses' dashboard button and view.",
            "Filters existing expense records where `project_id IS NULL` or category belongs to administrative overhead, preventing duplicate transaction records."
        ],
        matrix_rows=[
            ("MD / Owner", "Allowed (Full Access: Add/Edit/Delete)"),
            ("Accounts Staff", "Allowed (Add & Edit Office Expenses)"),
            ("Site Supervisor", "Prohibited"),
            ("Viewer", "Prohibited")
        ],
        workflow_steps=[
            "Dashboard",
            "Click 'Office Expenses'\nButton",
            "Filtered Overhead\nView (project_id=null)",
            "Filter Category\n(Internet / Travel)",
            "Enter / Edit Office\nExpense Record"
        ]
    )

    # =========================================================================
    # UPD-06
    # =========================================================================
    add_update_section(
        upd_id="UPD-06",
        upd_name="Material Suppliers & Subcontractor Management",
        current_state=[
            "Subcontractors use Work Orders (WO), Measurement Books (MB), and Contractor Bills (CB).",
            "Material suppliers use Indents (MR), POs, GRNs, and Supplier Payments."
        ],
        proposed_update=[
            "Separates subcontractor piece-rate milestone payments from daily wage attendance.",
            "Tracks subcontractor gang attendance for site presence while calculating disbursements strictly against Measurement Books (MB) and approved bills."
        ],
        matrix_rows=[
            ("MD / Owner", "Allowed (Full Approval & Management)"),
            ("Accounts Staff", "Allowed (Record Bills & Payments)"),
            ("Site Supervisor", "Enter MB & Gang Attendance"),
            ("Viewer", "Read-Only (Status Only)")
        ],
        workflow_steps=[
            "Issue Work Order\n(WO) to Subcontractor",
            "Supervisor Logs\nMeasurement Book (MB)",
            "Accounts Generates\nContractor Bill (CB)",
            "MD Approves\nBill Disbursement",
            "Record Contractor\nPayment"
        ],
        pending_notes="Pending Confirmation: Exact meaning of 'two material types', 'ten', and 'contractor in material' from meeting notes."
    )

    # =========================================================================
    # ATT-01
    # =========================================================================
    add_update_section(
        upd_id="ATT-01",
        upd_name="Weekly Construction Labour Attendance & Wage Register",
        current_state=[
            "Attendance page allows logging single-day attendance entries per worker.",
            "No multi-day weekly spreadsheet grid view matching site register sheets."
        ],
        proposed_update=[
            "Implements a 7-day spreadsheet-like Weekly Attendance Register (matching Brickwell reference sheet 13.09.2026 to 19.09.2026).",
            "Supports 7 daily time columns, fractional units (7.5, 8.5), team totals (Vinoth, Sathish, etc.), Bus/Petrol allowances, advance deductions, and Saturday weekly settlements."
        ],
        matrix_rows=[
            ("MD / Owner", "View & Approve Weekly Settlement"),
            ("Accounts Staff", "View, Record Allowances & Advances"),
            ("Site Supervisor", "Select Site/Week & Log Daily Hours"),
            ("Viewer", "Restricted (Financials Hidden)")
        ],
        workflow_steps=[
            "Select Site & Week\n(13.09 to 19.09)",
            "Supervisor Logs 7-Day\nAttendance & Hours",
            "System Calculates\nWages (Wage × Units)",
            "Accounts Enters\nBus/Petrol & Advance",
            "Process Saturday\nSettlement & Print Sheet"
        ]
    )

    doc.build(story, canvasmaker=VisualSummaryNumberedCanvas)
    print(f"Visual Summary PDF successfully generated at: {os.path.abspath(filename)}")

if __name__ == "__main__":
    build_pdf()
