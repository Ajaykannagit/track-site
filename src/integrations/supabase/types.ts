export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      attendance: {
        Row: {
          attendance_date: string
          calculated_wage: number
          contractor_id: string | null
          created_at: string
          created_by: string | null
          employee_id: string | null
          id: string
          is_demo: boolean
          kind: Database["public"]["Enums"]["attendance_kind"]
          ot_hours: number
          photo_path: string | null
          project_id: string | null
          remarks: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          updated_by: string | null
          wage_rate: number
          workforce_count: number | null
          working_hours: number
        }
        Insert: {
          attendance_date: string
          calculated_wage?: number
          contractor_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          id?: string
          is_demo?: boolean
          kind: Database["public"]["Enums"]["attendance_kind"]
          ot_hours?: number
          photo_path?: string | null
          project_id?: string | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          updated_by?: string | null
          wage_rate?: number
          workforce_count?: number | null
          working_hours?: number
        }
        Update: {
          attendance_date?: string
          calculated_wage?: number
          contractor_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          id?: string
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["attendance_kind"]
          ot_hours?: number
          photo_path?: string | null
          project_id?: string | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          updated_by?: string | null
          wage_rate?: number
          workforce_count?: number | null
          working_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          details: Json
          id: string
          performed_at: string
          performed_by: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          details?: Json
          id?: string
          performed_at?: string
          performed_by?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          details?: Json
          id?: string
          performed_at?: string
          performed_by?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      cash_closing: {
        Row: {
          cash_expenses: number
          cash_received: number
          closing_cash: number
          closing_date: string
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          opening_cash: number
          other_transactions: number
          project_id: string | null
          remarks: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cash_expenses?: number
          cash_received?: number
          closing_cash?: number
          closing_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          opening_cash?: number
          other_transactions?: number
          project_id?: string | null
          remarks?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cash_expenses?: number
          cash_received?: number
          closing_cash?: number
          closing_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          opening_cash?: number
          other_transactions?: number
          project_id?: string | null
          remarks?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_closing_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_demo: boolean
          name: string
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          name: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      contractor_bills: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bill_date: string
          bill_number: string
          contractor_id: string
          created_at: string
          created_by: string | null
          deductions: number
          document_path: string | null
          gross_amount: number
          id: string
          is_demo: boolean
          mb_ids: string[]
          net_amount: number
          payment_approved_at: string | null
          payment_approved_by: string | null
          project_id: string
          remarks: string | null
          status: Database["public"]["Enums"]["doc_status"]
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
          work_order_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bill_date?: string
          bill_number: string
          contractor_id: string
          created_at?: string
          created_by?: string | null
          deductions?: number
          document_path?: string | null
          gross_amount?: number
          id?: string
          is_demo?: boolean
          mb_ids?: string[]
          net_amount?: number
          payment_approved_at?: string | null
          payment_approved_by?: string | null
          project_id: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bill_date?: string
          bill_number?: string
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          deductions?: number
          document_path?: string | null
          gross_amount?: number
          id?: string
          is_demo?: boolean
          mb_ids?: string[]
          net_amount?: number
          payment_approved_at?: string | null
          payment_approved_by?: string | null
          project_id?: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_bills_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_bills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_bills_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_payments: {
        Row: {
          amount: number
          bill_id: string | null
          contractor_id: string
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          payment_date: string
          payment_method: string | null
          project_id: string
          reference_number: string | null
          remarks: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          bill_id?: string | null
          contractor_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          payment_date?: string
          payment_method?: string | null
          project_id: string
          reference_number?: string | null
          remarks?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string | null
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          payment_date?: string
          payment_method?: string | null
          project_id?: string
          reference_number?: string | null
          remarks?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "contractor_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_payments_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          active: boolean
          address: string | null
          bank_details: string | null
          contractor_code: string
          contractor_type: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_demo: boolean
          name: string
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          bank_details?: string | null
          contractor_code: string
          contractor_type?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          name: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          bank_details?: string | null
          contractor_code?: string
          contractor_type?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          created_by: string | null
          designation: string | null
          employee_code: string
          employee_type: Database["public"]["Enums"]["employee_type"]
          full_name: string
          id: string
          is_demo: boolean
          ot_rate_per_hour: number | null
          phone: string | null
          updated_at: string
          updated_by: string | null
          wage_rate: number
          wage_type: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          created_by?: string | null
          designation?: string | null
          employee_code: string
          employee_type?: Database["public"]["Enums"]["employee_type"]
          full_name: string
          id?: string
          is_demo?: boolean
          ot_rate_per_hour?: number | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
          wage_rate?: number
          wage_type?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          created_by?: string | null
          designation?: string | null
          employee_code?: string
          employee_type?: Database["public"]["Enums"]["employee_type"]
          full_name?: string
          id?: string
          is_demo?: boolean
          ot_rate_per_hour?: number | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
          wage_rate?: number
          wage_type?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          active: boolean
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          is_demo: boolean
          payment_method: string | null
          project_id: string | null
          receipt_path: string | null
          remarks: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_demo?: boolean
          payment_method?: string | null
          project_id?: string | null
          receipt_path?: string | null
          remarks?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_demo?: boolean
          payment_method?: string | null
          project_id?: string | null
          receipt_path?: string | null
          remarks?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_movements: {
        Row: {
          created_at: string
          created_by: string | null
          hours: number | null
          id: string
          inward_at: string | null
          is_demo: boolean
          machine_id: string
          outward_at: string | null
          project_id: string | null
          quantity: number | null
          remarks: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hours?: number | null
          id?: string
          inward_at?: string | null
          is_demo?: boolean
          machine_id: string
          outward_at?: string | null
          project_id?: string | null
          quantity?: number | null
          remarks?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hours?: number | null
          id?: string
          inward_at?: string | null
          is_demo?: boolean
          machine_id?: string
          outward_at?: string | null
          project_id?: string | null
          quantity?: number | null
          remarks?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_movements_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_demo: boolean
          machine_code: string | null
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          machine_code?: string | null
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          machine_code?: string | null
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      material_receipt_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          material: string
          ordered_quantity: number
          po_item_id: string | null
          rate: number
          receipt_id: string
          received_quantity: number
          unit: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          material: string
          ordered_quantity?: number
          po_item_id?: string | null
          rate?: number
          receipt_id: string
          received_quantity?: number
          unit?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          material?: string
          ordered_quantity?: number
          po_item_id?: string | null
          rate?: number
          receipt_id?: string
          received_quantity?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_receipt_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "material_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      material_receipts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          photo_path: string | null
          po_id: string | null
          project_id: string
          receipt_date: string
          receipt_number: string
          remarks: string | null
          supplier_id: string | null
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          photo_path?: string | null
          po_id?: string | null
          project_id: string
          receipt_date?: string
          receipt_number: string
          remarks?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          photo_path?: string | null
          po_id?: string | null
          project_id?: string
          receipt_date?: string
          receipt_number?: string
          remarks?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_request_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          material: string
          quantity: number
          rate: number
          request_id: string
          specification: string | null
          unit: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          material: string
          quantity?: number
          rate?: number
          request_id: string
          specification?: string | null
          unit?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          material?: string
          quantity?: number
          rate?: number
          request_id?: string
          specification?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          photo_path: string | null
          project_id: string
          remarks: string | null
          request_date: string
          request_number: string
          required_date: string | null
          status: Database["public"]["Enums"]["doc_status"]
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          photo_path?: string | null
          project_id: string
          remarks?: string | null
          request_date?: string
          request_number: string
          required_date?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          photo_path?: string | null
          project_id?: string
          remarks?: string | null
          request_date?: string
          request_number?: string
          required_date?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_books: {
        Row: {
          contractor_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          mb_date: string
          mb_number: string
          photo_path: string | null
          project_id: string
          remarks: string | null
          status: Database["public"]["Enums"]["doc_status"]
          total_amount: number
          updated_at: string
          updated_by: string | null
          work_order_id: string | null
        }
        Insert: {
          contractor_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          mb_date?: string
          mb_number: string
          photo_path?: string | null
          project_id: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          contractor_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          mb_date?: string
          mb_number?: string
          photo_path?: string | null
          project_id?: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_books_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_books_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_books_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          mb_id: string
          measurement: string | null
          quantity: number
          rate: number
          unit: string | null
          work_description: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          mb_id: string
          measurement?: string | null
          quantity?: number
          rate?: number
          unit?: string | null
          work_description: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          mb_id?: string
          measurement?: string | null
          quantity?: number
          rate?: number
          unit?: string | null
          work_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_items_mb_id_fkey"
            columns: ["mb_id"]
            isOneToOne: false
            referencedRelation: "measurement_books"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          period_month: number
          period_year: number
          project_id: string | null
          remarks: string | null
          status: Database["public"]["Enums"]["doc_status"]
          total_deductions: number
          total_gross: number
          total_net: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          period_month: number
          period_year: number
          project_id?: string | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          period_month?: number
          period_year?: number
          project_id?: string | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          created_at: string
          deductions: number
          employee_id: string | null
          gross_amount: number
          id: string
          leave_days: number
          net_amount: number
          ot_hours: number
          payroll_id: string
          present_days: number
          remarks: string | null
          wage_rate: number
          working_days: number
        }
        Insert: {
          created_at?: string
          deductions?: number
          employee_id?: string | null
          gross_amount?: number
          id?: string
          leave_days?: number
          net_amount?: number
          ot_hours?: number
          payroll_id: string
          present_days?: number
          remarks?: string | null
          wage_rate?: number
          working_days?: number
        }
        Update: {
          created_at?: string
          deductions?: number
          employee_id?: string | null
          gross_amount?: number
          id?: string
          leave_days?: number
          net_amount?: number
          ot_hours?: number
          payroll_id?: string
          present_days?: number
          remarks?: string | null
          wage_rate?: number
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budgets: {
        Row: {
          budget_amount: number
          category: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          project_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          budget_amount?: number
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          budget_amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          created_at: string
          created_by: string | null
          doc_type: string
          file_name: string | null
          file_path: string
          id: string
          mime_type: string | null
          project_id: string
          size_bytes: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doc_type: string
          file_name?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          project_id: string
          size_bytes?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doc_type?: string
          file_name?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          project_id?: string
          size_bytes?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          agreement_details: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          details: string | null
          expected_completion_date: string | null
          house_number: string | null
          id: string
          is_demo: boolean
          latitude: number | null
          longitude: number | null
          name: string
          project_code: string
          quotation_amount: number
          site_address: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agreement_details?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          expected_completion_date?: string | null
          house_number?: string | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          project_code: string
          quotation_amount?: number
          site_address?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agreement_details?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          expected_completion_date?: string | null
          house_number?: string | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          project_code?: string
          quotation_amount?: number
          site_address?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          material: string
          po_id: string
          quantity: number
          rate: number
          specification: string | null
          unit: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          material: string
          po_id: string
          quantity?: number
          rate?: number
          specification?: string | null
          unit?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          material?: string
          po_id?: string
          quantity?: number
          rate?: number
          specification?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          po_date: string
          po_number: string
          project_id: string
          remarks: string | null
          request_id: string | null
          status: Database["public"]["Enums"]["doc_status"]
          subtotal: number
          supplier_id: string | null
          tax_amount: number
          tax_percent: number
          terms: string | null
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          po_date?: string
          po_number: string
          project_id: string
          remarks?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          tax_percent?: number
          terms?: string | null
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          po_date?: string
          po_number?: string
          project_id?: string
          remarks?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          tax_percent?: number
          terms?: string | null
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          gst_number: string | null
          id: string
          is_demo: boolean
          name: string
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          is_demo?: boolean
          name: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          conditions: Json
          contract_amount: number
          contractor_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          is_demo: boolean
          project_id: string
          quantity: number
          rate: number
          remarks: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["doc_status"]
          unit: string | null
          updated_at: string
          updated_by: string | null
          wo_date: string
          work_description: string | null
          work_order_number: string
        }
        Insert: {
          conditions?: Json
          contract_amount?: number
          contractor_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          is_demo?: boolean
          project_id: string
          quantity?: number
          rate?: number
          remarks?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          wo_date?: string
          work_description?: string | null
          work_order_number: string
        }
        Update: {
          conditions?: Json
          contract_amount?: number
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          is_demo?: boolean
          project_id?: string
          quantity?: number
          rate?: number
          remarks?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          wo_date?: string
          work_description?: string | null
          work_order_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write_finance: { Args: never; Returns: boolean }
      can_write_site: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "md" | "supervisor" | "accounts" | "viewer"
      attendance_kind: "labour" | "office" | "contractor"
      attendance_status: "present" | "absent" | "half_day" | "leave" | "holiday"
      doc_status:
        | "draft"
        | "submitted"
        | "verified"
        | "approved"
        | "md_approved"
        | "payment_approved"
        | "ordered"
        | "partially_received"
        | "received"
        | "paid"
        | "closed"
        | "rejected"
      employee_type: "labour" | "office"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["md", "supervisor", "accounts", "viewer"],
      attendance_kind: ["labour", "office", "contractor"],
      attendance_status: ["present", "absent", "half_day", "leave", "holiday"],
      doc_status: [
        "draft",
        "submitted",
        "verified",
        "approved",
        "md_approved",
        "payment_approved",
        "ordered",
        "partially_received",
        "received",
        "paid",
        "closed",
        "rejected",
      ],
      employee_type: ["labour", "office"],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
