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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      collaborators: {
        Row: {
          auth_user_id: string | null
          can_access_compras: boolean
          can_access_dashboard: boolean
          can_access_estoque: boolean
          can_access_estoque_producao: boolean
          can_access_fichas: boolean
          can_access_finalizados: boolean
          can_access_producao: boolean
          can_access_produtos_venda: boolean
          created_at: string
          gestor_id: string
          id: string
          is_active: boolean
          name: string
          pin_hash: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          can_access_compras?: boolean
          can_access_dashboard?: boolean
          can_access_estoque?: boolean
          can_access_estoque_producao?: boolean
          can_access_fichas?: boolean
          can_access_finalizados?: boolean
          can_access_producao?: boolean
          can_access_produtos_venda?: boolean
          created_at?: string
          gestor_id: string
          id?: string
          is_active?: boolean
          name: string
          pin_hash?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          can_access_compras?: boolean
          can_access_dashboard?: boolean
          can_access_estoque?: boolean
          can_access_estoque_producao?: boolean
          can_access_fichas?: boolean
          can_access_finalizados?: boolean
          can_access_producao?: boolean
          can_access_produtos_venda?: boolean
          created_at?: string
          gestor_id?: string
          id?: string
          is_active?: boolean
          name?: string
          pin_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finished_productions_stock: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          notes: string | null
          praca: string | null
          quantity: number
          technical_sheet_id: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          praca?: string | null
          quantity?: number
          technical_sheet_id: string
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          praca?: string | null
          quantity?: number
          technical_sheet_id?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finished_productions_stock_technical_sheet_id_fkey"
            columns: ["technical_sheet_id"]
            isOneToOne: false
            referencedRelation: "technical_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      login_rate_limits: {
        Row: {
          attempt_count: number
          key: string
          locked_until: string | null
          updated_at: string
          window_started_at: string
        }
        Insert: {
          attempt_count?: number
          key: string
          locked_until?: string | null
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          attempt_count?: number
          key?: string
          locked_until?: string | null
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      losses: {
        Row: {
          created_at: string
          estimated_value: number | null
          id: string
          notes: string | null
          quantity: number
          source_id: string
          source_name: string
          source_type: string
          unit: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_value?: number | null
          id?: string
          notes?: string | null
          quantity: number
          source_id: string
          source_name: string
          source_type: string
          unit?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_value?: number | null
          id?: string
          notes?: string | null
          quantity?: number
          source_id?: string
          source_name?: string
          source_type?: string
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      preparation_alerts: {
        Row: {
          created_at: string
          id: string
          missing_component_id: string
          missing_component_type: string
          missing_quantity: number
          resolved: boolean | null
          sale_product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          missing_component_id: string
          missing_component_type: string
          missing_quantity: number
          resolved?: boolean | null
          sale_product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          missing_component_id?: string
          missing_component_type?: string
          missing_quantity?: number
          resolved?: boolean | null
          sale_product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preparation_alerts_sale_product_id_fkey"
            columns: ["sale_product_id"]
            isOneToOne: false
            referencedRelation: "sale_products"
            referencedColumns: ["id"]
          },
        ]
      }
      produced_inputs_stock: {
        Row: {
          batch_code: string
          created_at: string
          expiration_date: string | null
          id: string
          notes: string | null
          production_date: string
          quantity: number
          technical_sheet_id: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_code: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          production_date?: string
          quantity?: number
          technical_sheet_id: string
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_code?: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          production_date?: string
          quantity?: number
          technical_sheet_id?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produced_inputs_stock_technical_sheet_id_fkey"
            columns: ["technical_sheet_id"]
            isOneToOne: false
            referencedRelation: "technical_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      production_stage_executions: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          production_id: string
          stage_id: string
          started_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          production_id: string
          stage_id: string
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          production_id?: string
          stage_id?: string
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_stage_executions_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stage_executions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "technical_sheet_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      production_step_executions: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          notes: string | null
          production_id: string
          step_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          production_id: string
          step_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          production_id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_step_executions_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_step_executions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "technical_sheet_stage_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      production_stock: {
        Row: {
          created_at: string
          id: string
          quantity: number
          stock_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quantity?: number
          stock_item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quantity?: number
          stock_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_stock_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      productions: {
        Row: {
          actual_quantity: number | null
          consumed_produced_inputs: Json | null
          created_at: string
          id: string
          name: string
          notes: string | null
          period_type: Database["public"]["Enums"]["production_period"]
          planned_quantity: number
          praca: Database["public"]["Enums"]["production_praca"] | null
          scheduled_date: string
          scheduled_end_date: string | null
          status: Database["public"]["Enums"]["production_status"]
          technical_sheet_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_quantity?: number | null
          consumed_produced_inputs?: Json | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          period_type?: Database["public"]["Enums"]["production_period"]
          planned_quantity?: number
          praca?: Database["public"]["Enums"]["production_praca"] | null
          scheduled_date: string
          scheduled_end_date?: string | null
          status?: Database["public"]["Enums"]["production_status"] | "paused"
          technical_sheet_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_quantity?: number | null
          consumed_produced_inputs?: Json | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          period_type?: Database["public"]["Enums"]["production_period"]
          planned_quantity?: number
          praca?: Database["public"]["Enums"]["production_praca"] | null
          scheduled_date?: string
          scheduled_end_date?: string | null
          status?: Database["public"]["Enums"]["production_status"]
          technical_sheet_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "productions_technical_sheet_id_fkey"
            columns: ["technical_sheet_id"]
            isOneToOne: false
            referencedRelation: "technical_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          gestor_id: string | null
          id: string
          role: Database["public"]["Enums"]["business_role"]
          status: string | null
          status_pagamento: boolean
          trial_start_date: string | null
          subscription_end_date: string | null
          subscription_plan: string | null
          updated_at: string
          pin_hash: string | null
          can_access_dashboard: boolean
          can_access_estoque: boolean
          can_access_estoque_producao: boolean
          can_access_fichas: boolean
          can_access_producao: boolean
          can_access_compras: boolean
          can_access_finalizados: boolean
          can_access_produtos_venda: boolean
          can_access_financeiro: boolean
          can_access_relatorios: boolean
          google_access_token: string | null
          google_refresh_token: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          gestor_id?: string | null
          id: string
          role?: Database["public"]["Enums"]["business_role"]
          status?: string | null
          status_pagamento?: boolean
          trial_start_date?: string | null
          subscription_end_date?: string | null
          subscription_plan?: string | null
          updated_at?: string
          pin_hash?: string | null
          can_access_dashboard?: boolean
          can_access_estoque?: boolean
          can_access_estoque_producao?: boolean
          can_access_fichas?: boolean
          can_access_producao?: boolean
          can_access_compras?: boolean
          can_access_finalizados?: boolean
          can_access_produtos_venda?: boolean
          can_access_financeiro?: boolean
          can_access_relatorios?: boolean
          google_access_token?: string | null
          google_refresh_token?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          gestor_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["business_role"]
          status?: string | null
          status_pagamento?: boolean
          trial_start_date?: string | null
          subscription_end_date?: string | null
          subscription_plan?: string | null
          updated_at?: string
          pin_hash?: string | null
          can_access_dashboard?: boolean
          can_access_estoque?: boolean
          can_access_estoque_producao?: boolean
          can_access_fichas?: boolean
          can_access_producao?: boolean
          can_access_compras?: boolean
          can_access_finalizados?: boolean
          can_access_produtos_venda?: boolean
          can_access_financeiro?: boolean
          can_access_relatorios?: boolean
          google_access_token?: string | null
          google_refresh_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_list_items: {
        Row: {
          actual_delivery_date: string | null
          created_at: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string | null
          ordered_quantity: number | null
          status: Database["public"]["Enums"]["purchase_status"]
          stock_item_id: string
          suggested_quantity: number
          supplier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_delivery_date?: string | null
          created_at?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          ordered_quantity?: number | null
          status?: Database["public"]["Enums"]["purchase_status"]
          stock_item_id: string
          suggested_quantity: number
          supplier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_delivery_date?: string | null
          created_at?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          ordered_quantity?: number | null
          status?: Database["public"]["Enums"]["purchase_status"]
          stock_item_id?: string
          suggested_quantity?: number
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_list_items_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_list_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_schedule: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          notes: string | null
          order_day: boolean
          supplier_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          notes?: string | null
          order_day?: boolean
          supplier_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          notes?: string | null
          order_day?: boolean
          supplier_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_schedule_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_product_components: {
        Row: {
          component_id: string
          component_type: Database["public"]["Enums"]["sale_component_type"]
          created_at: string
          id: string
          quantity: number
          sale_product_id: string
          unit: string
        }
        Insert: {
          component_id: string
          component_type: Database["public"]["Enums"]["sale_component_type"]
          created_at?: string
          id?: string
          quantity: number
          sale_product_id: string
          unit: string
        }
        Update: {
          component_id?: string
          component_type?: Database["public"]["Enums"]["sale_component_type"]
          created_at?: string
          id?: string
          quantity?: number
          sale_product_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_product_components_sale_product_id_fkey"
            columns: ["sale_product_id"]
            isOneToOne: false
            referencedRelation: "sale_products"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          minimum_stock: number | null
          name: string
          ready_quantity: number
          sale_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          minimum_stock?: number | null
          name: string
          ready_quantity?: number
          sale_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          minimum_stock?: number | null
          name?: string
          ready_quantity?: number
          sale_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          quantity_sold: number
          sale_date: string
          sale_product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity_sold: number
          sale_date?: string
          sale_product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity_sold?: number
          sale_date?: string
          sale_product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_sale_product_id_fkey"
            columns: ["sale_product_id"]
            isOneToOne: false
            referencedRelation: "sale_products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          category: Database["public"]["Enums"]["stock_category"]
          created_at: string
          current_quantity: number
          expiration_date: string | null
          id: string
          minimum_quantity: number
          name: string
          notes: string | null
          supplier_id: string | null
          unit: Database["public"]["Enums"]["stock_unit"]
          unit_price: number | null
          updated_at: string
          user_id: string
          waste_factor: number | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["stock_category"]
          created_at?: string
          current_quantity?: number
          expiration_date?: string | null
          id?: string
          minimum_quantity?: number
          name: string
          notes?: string | null
          supplier_id?: string | null
          unit?: Database["public"]["Enums"]["stock_unit"]
          unit_price?: number | null
          updated_at?: string
          user_id: string
          waste_factor?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["stock_category"]
          created_at?: string
          current_quantity?: number
          expiration_date?: string | null
          id?: string
          minimum_quantity?: number
          name?: string
          notes?: string | null
          supplier_id?: string | null
          unit?: Database["public"]["Enums"]["stock_unit"]
          unit_price?: number | null
          updated_at?: string
          user_id?: string
          waste_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_supplier_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          quantity: number
          related_production_id: string | null
          source: Database["public"]["Enums"]["movement_source"]
          stock_item_id: string
          type: Database["public"]["Enums"]["movement_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity: number
          related_production_id?: string | null
          source?: Database["public"]["Enums"]["movement_source"]
          stock_item_id: string
          type: Database["public"]["Enums"]["movement_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number
          related_production_id?: string | null
          source?: Database["public"]["Enums"]["movement_source"]
          stock_item_id?: string
          type?: Database["public"]["Enums"]["movement_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_requests: {
        Row: {
          created_at: string
          delivered_quantity: number | null
          id: string
          notes: string | null
          requested_quantity: number
          status: string
          stock_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_quantity?: number | null
          id?: string
          notes?: string | null
          requested_quantity: number
          status?: string
          stock_item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_quantity?: number | null
          id?: string
          notes?: string | null
          requested_quantity?: number
          status?: string
          stock_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_requests_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          direction: string
          id: string
          notes: string | null
          quantity: number
          stock_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          notes?: string | null
          quantity: number
          stock_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          notes?: string | null
          quantity?: number
          stock_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          average_delivery_days: number | null
          category: string | null
          city: string | null
          cnpj_cpf: string | null
          created_at: string
          delivery_time_days: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_method: string | null
          phone: string | null
          quality_rating: number | null
          state: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
          whatsapp_number: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          average_delivery_days?: number | null
          category?: string | null
          city?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          delivery_time_days?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          quality_rating?: number | null
          state?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
          whatsapp_number?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          average_delivery_days?: number | null
          category?: string | null
          city?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          delivery_time_days?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          quality_rating?: number | null
          state?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
          whatsapp_number?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      supplier_messages: {
        Row: {
          created_at: string
          id: string
          message_text: string
          purchase_list_id: string | null
          sent_at: string | null
          supplier_id: string
          user_id: string
          whatsapp_status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message_text: string
          purchase_list_id?: string | null
          sent_at?: string | null
          supplier_id: string
          user_id: string
          whatsapp_status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message_text?: string
          purchase_list_id?: string | null
          sent_at?: string | null
          supplier_id?: string
          user_id?: string
          whatsapp_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_messages_purchase_list_id_fkey"
            columns: ["purchase_list_id"]
            isOneToOne: false
            referencedRelation: "purchase_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_messages_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_sheet_ingredients: {
        Row: {
          created_at: string
          id: string
          quantity: number
          stage_id: string | null
          stock_item_id: string
          technical_sheet_id: string
          total_cost: number | null
          unit: string
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          quantity: number
          stage_id?: string | null
          stock_item_id: string
          technical_sheet_id: string
          total_cost?: number | null
          unit: string
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          quantity?: number
          stage_id?: string | null
          stock_item_id?: string
          technical_sheet_id?: string
          total_cost?: number | null
          unit?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_sheet_ingredients_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "technical_sheet_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_sheet_ingredients_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_sheet_ingredients_technical_sheet_id_fkey"
            columns: ["technical_sheet_id"]
            isOneToOne: false
            referencedRelation: "technical_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_sheet_stage_steps: {
        Row: {
          created_at: string
          description: string
          duration_minutes: number | null
          id: string
          notes: string | null
          order_index: number
          stage_id: string
        }
        Insert: {
          created_at?: string
          description: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          order_index?: number
          stage_id: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          order_index?: number
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_sheet_stage_steps_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "technical_sheet_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_sheet_stages: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          name: string
          order_index: number
          technical_sheet_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name: string
          order_index?: number
          technical_sheet_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name?: string
          order_index?: number
          technical_sheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_sheet_stages_technical_sheet_id_fkey"
            columns: ["technical_sheet_id"]
            isOneToOne: false
            referencedRelation: "technical_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_sheets: {
        Row: {
          cost_per_unit: number | null
          created_at: string
          description: string | null
          energy_cost: number | null
          id: string
          image_url: string | null
          labor_cost: number | null
          lead_time_hours: number | null
          markup: number | null
          name: string
          minimum_stock: number | null
          other_costs: number | null
          praca: string | null
          preparation_method: string | null
          preparation_time: number | null
          production_type: Database["public"]["Enums"]["production_type"]
          shelf_life_hours: number | null
          target_price: number | null
          total_cost: number | null
          updated_at: string
          user_id: string
          video_url: string | null
          yield_quantity: number
          yield_unit: string
        }
        Insert: {
          cost_per_unit?: number | null
          created_at?: string
          description?: string | null
          energy_cost?: number | null
          id?: string
          image_url?: string | null
          labor_cost?: number | null
          lead_time_hours?: number | null
          markup?: number | null
          minimum_stock?: number | null
          name: string
          other_costs?: number | null
          praca?: string | null
          preparation_method?: string | null
          preparation_time?: number | null
          production_type?: Database["public"]["Enums"]["production_type"]
          shelf_life_hours?: number | null
          target_price?: number | null
          total_cost?: number | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          yield_quantity?: number
          yield_unit?: string
        }
        Update: {
          cost_per_unit?: number | null
          created_at?: string
          description?: string | null
          energy_cost?: number | null
          id?: string
          image_url?: string | null
          labor_cost?: number | null
          lead_time_hours?: number | null
          markup?: number | null
          minimum_stock?: number | null
          name?: string
          other_costs?: number | null
          praca?: string | null
          preparation_method?: string | null
          preparation_time?: number | null
          production_type?: Database["public"]["Enums"]["production_type"]
          shelf_life_hours?: number | null
          target_price?: number | null
          total_cost?: number | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          yield_quantity?: number
          yield_unit?: string
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
      sales_forecasts: {
        Row: {
          id: string
          user_id: string
          sale_product_id: string
          target_date: string
          forecasted_quantity: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sale_product_id: string
          target_date: string
          forecasted_quantity: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          sale_product_id?: string
          target_date?: string
          forecasted_quantity?: number
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_forecasts_sale_product_id_fkey"
            columns: ["sale_product_id"]
            isOneToOne: false
            referencedRelation: "sale_products"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_production_orders: {
        Row: {
          id: string
          user_id: string
          forecast_id: string | null
          technical_sheet_id: string
          production_date: string
          target_consumption_date: string
          required_quantity: number
          existing_stock: number
          net_quantity: number
          praca: Database["public"]["Enums"]["production_praca"] | null
          status: Database["public"]["Enums"]["forecast_order_status"]
          linked_production_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          forecast_id?: string | null
          technical_sheet_id: string
          production_date: string
          target_consumption_date: string
          required_quantity: number
          existing_stock?: number
          net_quantity: number
          praca?: Database["public"]["Enums"]["production_praca"] | null
          status?: Database["public"]["Enums"]["forecast_order_status"]
          linked_production_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          forecast_id?: string | null
          technical_sheet_id?: string
          production_date?: string
          target_consumption_date?: string
          required_quantity?: number
          existing_stock?: number
          net_quantity?: number
          praca?: Database["public"]["Enums"]["production_praca"] | null
          status?: Database["public"]["Enums"]["forecast_order_status"]
          linked_production_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_production_orders_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: false
            referencedRelation: "sales_forecasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_production_orders_technical_sheet_id_fkey"
            columns: ["technical_sheet_id"]
            isOneToOne: false
            referencedRelation: "technical_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_production_orders_linked_production_id_fkey"
            columns: ["linked_production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_owner_data: {
        Args: { data_owner_id: string }
        Returns: boolean
      }
      check_collaborator_login_rate_limit: {
        Args: {
          p_key: string
          p_lockout_seconds?: number
          p_max_attempts?: number
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          minutes_remaining: number
        }[]
      }
      get_owner_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["business_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_collaborator_login_attempt: {
        Args: {
          p_key: string
          p_lockout_seconds?: number
          p_max_attempts?: number
          p_success: boolean
          p_window_seconds?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      business_role: "admin" | "gestor" | "colaborador"
      movement_source: "manual" | "production" | "audio" | "image"
      movement_type: "entry" | "exit" | "adjustment"
      production_period: "day" | "week" | "month" | "year" | "custom"
      production_praca:
      | "gelateria"
      | "confeitaria"
      | "padaria"
      | "praca_quente"
      | "bar"
      forecast_order_status: "pending" | "in_progress" | "completed" | "cancelled"
      production_status:
      | "requested"
      | "planned"
      | "in_progress"
      | "completed"
      | "cancelled"
      | "paused"
      production_type: "insumo" | "final"
      purchase_status: "pending" | "ordered" | "delivered" | "cancelled"
      sale_component_type: "finished_production" | "stock_item" | "sale_product"
      stock_category:
      | "laticinios"
      | "secos_e_graos"
      | "hortifruti"
      | "carnes_e_peixes"
      | "embalagens"
      | "limpeza"
      | "outros"
      stock_unit: "kg" | "g" | "L" | "ml" | "unidade" | "caixa" | "dz"
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
      app_role: ["admin", "user"],
      business_role: ["admin", "gestor", "colaborador"],
      movement_source: ["manual", "production", "audio", "image"],
      movement_type: ["entry", "exit", "adjustment"],
      production_period: ["day", "week", "month", "year", "custom"],
      production_praca: [
        "gelateria",
        "confeitaria",
        "padaria",
        "praca_quente",
        "bar",
      ],
      forecast_order_status: ["pending", "in_progress", "completed", "cancelled"],
      production_status: [
        "requested",
        "planned",
        "in_progress",
        "completed",
        "cancelled",
        "paused",
      ],
      production_type: ["insumo", "final"],
      purchase_status: ["pending", "ordered", "delivered", "cancelled"],
      sale_component_type: [
        "finished_production",
        "stock_item",
        "sale_product",
      ],
      stock_category: [
        "laticinios",
        "secos_e_graos",
        "hortifruti",
        "carnes_e_peixes",
        "embalagens",
        "limpeza",
        "outros",
      ],
      stock_unit: ["kg", "g", "L", "ml", "unidade", "caixa", "dz"],
    },
  },
} as const
