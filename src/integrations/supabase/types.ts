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
      agile_implementation_steps: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          checklist: Json | null
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          order_index: number | null
          sprint_number: number | null
          status: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          checklist?: Json | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number | null
          sprint_number?: number | null
          status?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          checklist?: Json | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number | null
          sprint_number?: number | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agile_implementation_steps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agile_implementation_steps_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generations: {
        Row: {
          company_id: string | null
          content: string
          created_at: string
          id: string
          metadata: Json | null
          tags: string[] | null
          title: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          title?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          title?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          company: string | null
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          phone: string
          status: string | null
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          company?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          phone: string
          status?: string | null
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          status?: string | null
        }
        Relationships: []
      }
      attachments: {
        Row: {
          alert_days: number | null
          client_company_id: string | null
          company_id: string | null
          content_type: string | null
          created_at: string
          document_type: string | null
          entity_id: string
          entity_type: string
          expires_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          governance_item_id: string | null
          id: string
          notes: string | null
          project_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          alert_days?: number | null
          client_company_id?: string | null
          company_id?: string | null
          content_type?: string | null
          created_at?: string
          document_type?: string | null
          entity_id: string
          entity_type: string
          expires_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          governance_item_id?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          alert_days?: number | null
          client_company_id?: string | null
          company_id?: string | null
          content_type?: string | null
          created_at?: string
          document_type?: string | null
          entity_id?: string
          entity_type?: string
          expires_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          governance_item_id?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_governance_item_id_fkey"
            columns: ["governance_item_id"]
            isOneToOne: false
            referencedRelation: "governance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_events: {
        Row: {
          action_type: string | null
          company_id: string | null
          created_at: string
          id: string
          result: string | null
          rule_id: string | null
          source_id: string | null
          source_type: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          result?: string | null
          rule_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          result?: string | null
          rule_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_payload: Json
          action_type: string
          company_id: string | null
          conditions: Json
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          last_run_at: string | null
          name: string
          trigger_type: string
          user_id: string | null
        }
        Insert: {
          action_payload?: Json
          action_type: string
          company_id?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name: string
          trigger_type: string
          user_id?: string | null
        }
        Update: {
          action_payload?: Json
          action_type?: string
          company_id?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name?: string
          trigger_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      board_category_documents: {
        Row: {
          category: string
          company_id: string | null
          content_type: string | null
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          notes: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          company_id?: string | null
          content_type?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          company_id?: string | null
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          notes?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          color: string | null
          company_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          start_date: string
          title: string
          user_id: string | null
        }
        Insert: {
          all_day?: boolean | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          start_date: string
          title: string
          user_id?: string | null
        }
        Update: {
          all_day?: boolean | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_checkins: {
        Row: {
          checkin_date: string
          company_id: string | null
          created_at: string
          energy: number
          focus: number
          id: string
          mood: string | null
          notes: string | null
          user_id: string | null
          workload: number
        }
        Insert: {
          checkin_date?: string
          company_id?: string | null
          created_at?: string
          energy?: number
          focus?: number
          id?: string
          mood?: string | null
          notes?: string | null
          user_id?: string | null
          workload?: number
        }
        Update: {
          checkin_date?: string
          company_id?: string | null
          created_at?: string
          energy?: number
          focus?: number
          id?: string
          mood?: string | null
          notes?: string | null
          user_id?: string | null
          workload?: number
        }
        Relationships: [
          {
            foreignKeyName: "capacity_checkins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_contact_meta: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          last_contact_date: string | null
          next_action_date: string | null
          next_action_description: string | null
          priority: string | null
          tags: string[] | null
          temperature: string | null
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          last_contact_date?: string | null
          next_action_date?: string | null
          next_action_description?: string | null
          priority?: string | null
          tags?: string[] | null
          temperature?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          last_contact_date?: string | null
          next_action_date?: string | null
          next_action_description?: string | null
          priority?: string | null
          tags?: string[] | null
          temperature?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_contact_meta_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_items: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          order_index: number
          parent_item_id: string | null
          phase_id: string
          title: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          parent_item_id?: string | null
          phase_id: string
          title: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          parent_item_id?: string | null
          phase_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "commercial_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_items_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "commercial_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_phases: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          icon: string
          id: string
          order_index: number
          title: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          order_index?: number
          title: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          order_index?: number
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_phases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_prospects: {
        Row: {
          company_id: string | null
          company_name: string
          contacts: Json
          created_at: string
          extracted_tasks: Json
          id: string
          job_about: string | null
          job_title: string | null
          linkedin_job_url: string | null
          location: string | null
          meeting_date: string | null
          notes: string | null
          operational_diagnosis: Json
          priority: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          company_name: string
          contacts?: Json
          created_at?: string
          extracted_tasks?: Json
          id?: string
          job_about?: string | null
          job_title?: string | null
          linkedin_job_url?: string | null
          location?: string | null
          meeting_date?: string | null
          notes?: string | null
          operational_diagnosis?: Json
          priority?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          company_name?: string
          contacts?: Json
          created_at?: string
          extracted_tasks?: Json
          id?: string
          job_about?: string | null
          job_title?: string | null
          linkedin_job_url?: string | null
          location?: string | null
          meeting_date?: string | null
          notes?: string | null
          operational_diagnosis?: Json
          priority?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_prospects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_structure_items: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          category: string
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          order_index: number | null
          status: string | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string | null
          value_after: string | null
          value_before: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          category: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number | null
          status?: string | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id?: string | null
          value_after?: string | null
          value_before?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number | null
          status?: string | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string | null
          value_after?: string | null
          value_before?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_structure_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          relationship_health: string | null
          relationship_next_action_date: string | null
          relationship_notes: string | null
          relationship_priority: string | null
          relationship_stage: string | null
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          relationship_health?: string | null
          relationship_next_action_date?: string | null
          relationship_notes?: string | null
          relationship_priority?: string | null
          relationship_stage?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          relationship_health?: string | null
          relationship_next_action_date?: string | null
          relationship_notes?: string | null
          relationship_priority?: string | null
          relationship_stage?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      company_commercial_structure: {
        Row: {
          company_id: string
          content: Json
          created_at: string
          id: string
          section: string
          updated_at: string
        }
        Insert: {
          company_id: string
          content?: Json
          created_at?: string
          id?: string
          section: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          content?: Json
          created_at?: string
          id?: string
          section?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_commercial_structure_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      conference_items: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          company_id: string | null
          content: string | null
          created_at: string
          id: string
          order_index: number | null
          project_id: string | null
          stage_id: string
          tags: string[] | null
          title: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          company_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          order_index?: number | null
          project_id?: string | null
          stage_id: string
          tags?: string[] | null
          title: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          company_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          order_index?: number | null
          project_id?: string | null
          stage_id?: string
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conference_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conference_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conference_items_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "conference_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      conference_stages: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          order_index: number | null
          project_id: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          order_index?: number | null
          project_id?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          order_index?: number | null
          project_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conference_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conference_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_commercial_tracking: {
        Row: {
          company_id: string | null
          completed_at: string | null
          contact_id: string
          created_at: string
          id: string
          item_id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          contact_id: string
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_commercial_tracking_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_commercial_tracking_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_commercial_tracking_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "commercial_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_interactions: {
        Row: {
          contact_id: string
          created_at: string
          date: string
          description: string
          id: string
          type: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          date?: string
          description: string
          id?: string
          type: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_onboarding_documents: {
        Row: {
          contact_id: string
          created_at: string
          document_id: string
          file_url: string | null
          id: string
          notes: string | null
          received_at: string | null
          sent_at: string | null
          signed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          document_id: string
          file_url?: string | null
          id?: string
          notes?: string | null
          received_at?: string | null
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          document_id?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          received_at?: string | null
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_onboarding_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_onboarding_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "onboarding_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_onboarding_tracking: {
        Row: {
          completed_at: string | null
          contact_id: string
          created_at: string
          id: string
          notes: string | null
          status: string
          step_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contact_id: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          step_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_onboarding_tracking_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_onboarding_tracking_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "onboarding_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          challenge: string
          company: string
          created_at: string
          email: string
          id: string
          message: string | null
          model: string | null
          name: string
          phone: string
          segment: string
        }
        Insert: {
          challenge: string
          company: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          model?: string | null
          name: string
          phone: string
          segment: string
        }
        Update: {
          challenge?: string
          company?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          model?: string | null
          name?: string
          phone?: string
          segment?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          company: string | null
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          phone: string | null
          pipeline_stage: string | null
          project_id: string | null
          relationship_health: string | null
          relationship_next_action_date: string | null
          relationship_notes: string | null
          relationship_priority: string | null
          relationship_stage: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          project_id?: string | null
          relationship_health?: string | null
          relationship_next_action_date?: string | null
          relationship_notes?: string | null
          relationship_priority?: string | null
          relationship_stage?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          project_id?: string | null
          relationship_health?: string | null
          relationship_next_action_date?: string | null
          relationship_notes?: string | null
          relationship_priority?: string | null
          relationship_stage?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          area: string | null
          blockers: string | null
          company_id: string | null
          created_at: string
          decisions: string | null
          id: string
          notes: string | null
          project_id: string | null
          report_date: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          area?: string | null
          blockers?: string | null
          company_id?: string | null
          created_at?: string
          decisions?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          report_date: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          area?: string | null
          blockers?: string | null
          company_id?: string | null
          created_at?: string
          decisions?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          report_date?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_reminders: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          phrase: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          phrase: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          phrase?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_logs: {
        Row: {
          company_id: string | null
          context: string | null
          created_at: string
          decision: string | null
          expected_result: string | null
          governance_item_id: string | null
          id: string
          options_considered: string | null
          outcome: string | null
          project_id: string | null
          review_date: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          context?: string | null
          created_at?: string
          decision?: string | null
          expected_result?: string | null
          governance_item_id?: string | null
          id?: string
          options_considered?: string | null
          outcome?: string | null
          project_id?: string | null
          review_date?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          context?: string | null
          created_at?: string
          decision?: string | null
          expected_result?: string | null
          governance_item_id?: string | null
          id?: string
          options_considered?: string | null
          outcome?: string | null
          project_id?: string | null
          review_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_logs_governance_item_id_fkey"
            columns: ["governance_item_id"]
            isOneToOne: false
            referencedRelation: "governance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_records: {
        Row: {
          action_taken: string
          company_id: string | null
          created_at: string
          id: string
          lessons_learned: string
          project_id: string | null
          result_obtained: string
          tags: string[] | null
          user_id: string | null
        }
        Insert: {
          action_taken: string
          company_id?: string | null
          created_at?: string
          id?: string
          lessons_learned: string
          project_id?: string | null
          result_obtained: string
          tags?: string[] | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string
          company_id?: string | null
          created_at?: string
          id?: string
          lessons_learned?: string
          project_id?: string | null
          result_obtained?: string
          tags?: string[] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      faculdade_disciplinas: {
        Row: {
          address: string | null
          color: string | null
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          professor: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          professor?: string | null
          user_id?: string
        }
        Update: {
          address?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          professor?: string | null
          user_id?: string
        }
        Relationships: []
      }
      faculdade_provas: {
        Row: {
          created_at: string | null
          disciplina_id: string | null
          exam_date: string
          grade: number | null
          id: string
          notes: string | null
          priority: string | null
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          disciplina_id?: string | null
          exam_date: string
          grade?: number | null
          id?: string
          notes?: string | null
          priority?: string | null
          status?: string | null
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string | null
          disciplina_id?: string | null
          exam_date?: string
          grade?: number | null
          id?: string
          notes?: string | null
          priority?: string | null
          status?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faculdade_provas_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "faculdade_disciplinas"
            referencedColumns: ["id"]
          },
        ]
      }
      faculdade_tarefas: {
        Row: {
          created_at: string | null
          description: string | null
          disciplina_id: string | null
          due_date: string | null
          id: string
          priority: string | null
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          disciplina_id?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          disciplina_id?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faculdade_tarefas_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "faculdade_disciplinas"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_accounts: {
        Row: {
          account_type: string
          closing_day: number | null
          color: string | null
          company_id: string | null
          created_at: string
          credit_limit: number | null
          due_day: number | null
          entity_id: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          opening_balance: number
          opening_balance_date: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_type?: string
          closing_day?: number | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          credit_limit?: number | null
          due_day?: number | null
          entity_id: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          opening_balance?: number
          opening_balance_date?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_type?: string
          closing_day?: number | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          credit_limit?: number | null
          due_day?: number | null
          entity_id?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          opening_balance?: number
          opening_balance_date?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_accounts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "finance_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_card_invoices: {
        Row: {
          amount: number
          card_account_id: string
          closing_date: string
          company_id: string | null
          created_at: string
          due_date: string
          id: string
          paid_at: string | null
          payment_transfer_id: string | null
          period_end: string
          period_start: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          card_account_id: string
          closing_date: string
          company_id?: string | null
          created_at?: string
          due_date: string
          id?: string
          paid_at?: string | null
          payment_transfer_id?: string | null
          period_end: string
          period_start: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          card_account_id?: string
          closing_date?: string
          company_id?: string | null
          created_at?: string
          due_date?: string
          id?: string
          paid_at?: string | null
          payment_transfer_id?: string | null
          period_end?: string
          period_start?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_card_invoices_card_account_id_fkey"
            columns: ["card_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_card_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_card_invoices_payment_transfer_id_fkey"
            columns: ["payment_transfer_id"]
            isOneToOne: false
            referencedRelation: "finance_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entities: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string
          entity_type: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          entity_type: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          entity_type?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_entities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_monthly_plans: {
        Row: {
          account_id: string | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          id: string
          month: number
          notes: string | null
          status: string
          updated_at: string
          user_id: string | null
          year: number
        }
        Insert: {
          account_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          month: number
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          year: number
        }
        Update: {
          account_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          month?: number
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_monthly_plans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_monthly_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_monthly_plans_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "finance_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_plan_items: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          company_id: string | null
          created_at: string
          description: string
          due_date: string
          entity_id: string | null
          goal_kind: string
          id: string
          metadata: Json | null
          notes: string | null
          plan_id: string
          status: string
          transaction_id: string | null
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          due_date: string
          entity_id?: string | null
          goal_kind?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          plan_id: string
          status?: string
          transaction_id?: string | null
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          due_date?: string
          entity_id?: string | null
          goal_kind?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          plan_id?: string
          status?: string
          transaction_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_plan_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_plan_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_plan_items_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "finance_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "finance_monthly_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_saved_installments: {
        Row: {
          account_id: string | null
          added_to_flow_at: string | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          id: string
          installments: number
          item_name: string
          item_price: number
          metadata: Json | null
          monthly_expenses: number | null
          monthly_income: number | null
          monthly_payment: number
          option_label: string
          percent_of_income: number | null
          remains_after: number | null
          risk_level: string | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          added_to_flow_at?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          installments?: number
          item_name: string
          item_price?: number
          metadata?: Json | null
          monthly_expenses?: number | null
          monthly_income?: number | null
          monthly_payment?: number
          option_label: string
          percent_of_income?: number | null
          remains_after?: number | null
          risk_level?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          added_to_flow_at?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          installments?: number
          item_name?: string
          item_price?: number
          metadata?: Json | null
          monthly_expenses?: number | null
          monthly_income?: number | null
          monthly_payment?: number
          option_label?: string
          percent_of_income?: number | null
          remains_after?: number | null
          risk_level?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_saved_installments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_saved_installments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_saved_installments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "finance_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_scenarios: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          history_window: number
          id: string
          items: Json
          name: string
          recurring_expense: number
          recurring_income: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          history_window?: number
          id?: string
          items?: Json
          name: string
          recurring_expense?: number
          recurring_income?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          history_window?: number
          id?: string
          items?: Json
          name?: string
          recurring_expense?: number
          recurring_income?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_transfers: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          description: string | null
          from_account_id: string
          id: string
          status: string
          to_account_id: string
          transfer_date: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string
          description?: string | null
          from_account_id: string
          id?: string
          status?: string
          to_account_id: string
          transfer_date?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          description?: string | null
          from_account_id?: string
          id?: string
          status?: string
          to_account_id?: string
          transfer_date?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_travel_profile: {
        Row: {
          company_id: string | null
          created_at: string
          debts: number
          food: number
          housing: number
          id: string
          metadata: Json
          monthly_salary: number
          other_income: number
          subscriptions: number
          transport: number
          updated_at: string
          user_id: string | null
          variable_income: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          debts?: number
          food?: number
          housing?: number
          id?: string
          metadata?: Json
          monthly_salary?: number
          other_income?: number
          subscriptions?: number
          transport?: number
          updated_at?: string
          user_id?: string | null
          variable_income?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          debts?: number
          food?: number
          housing?: number
          id?: string
          metadata?: Json
          monthly_salary?: number
          other_income?: number
          subscriptions?: number
          transport?: number
          updated_at?: string
          user_id?: string | null
          variable_income?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_travel_profile_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_trip_categories: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_per_person: boolean
          key: string
          label: string
          limit_pct: number | null
          metadata: Json
          multiply_by_nights: boolean
          sort_order: number
          trip_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          is_per_person?: boolean
          key: string
          label: string
          limit_pct?: number | null
          metadata?: Json
          multiply_by_nights?: boolean
          sort_order?: number
          trip_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_per_person?: boolean
          key?: string
          label?: string
          limit_pct?: number | null
          metadata?: Json
          multiply_by_nights?: boolean
          sort_order?: number
          trip_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_trip_categories_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "finance_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_trips: {
        Row: {
          adults: number
          children: number
          company_id: string | null
          created_at: string
          destination: string | null
          emergency_pct: number
          end_date: string | null
          exchange_rate: number | null
          id: string
          is_international: boolean
          metadata: Json
          name: string
          notes: string | null
          profile: string
          start_date: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          adults?: number
          children?: number
          company_id?: string | null
          created_at?: string
          destination?: string | null
          emergency_pct?: number
          end_date?: string | null
          exchange_rate?: number | null
          id?: string
          is_international?: boolean
          metadata?: Json
          name: string
          notes?: string | null
          profile?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          adults?: number
          children?: number
          company_id?: string | null
          created_at?: string
          destination?: string | null
          emergency_pct?: number
          end_date?: string | null
          exchange_rate?: number | null
          id?: string
          is_international?: boolean
          metadata?: Json
          name?: string
          notes?: string | null
          profile?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_trips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          card_invoice_id: string | null
          category: string | null
          company_id: string | null
          created_at: string
          date: string
          description: string
          due_date: string | null
          finance_account_id: string | null
          id: string
          import_fingerprint: string | null
          installment_group_id: string | null
          installment_number: number | null
          installment_total: number | null
          is_recurring: boolean | null
          project_id: string | null
          recurrence_end_date: string | null
          recurrence_interval: string | null
          settled_at: string | null
          source_id: string | null
          source_type: string | null
          status: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          amount: number
          card_invoice_id?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          description: string
          due_date?: string | null
          finance_account_id?: string | null
          id?: string
          import_fingerprint?: string | null
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_recurring?: boolean | null
          project_id?: string | null
          recurrence_end_date?: string | null
          recurrence_interval?: string | null
          settled_at?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          card_invoice_id?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          description?: string
          due_date?: string | null
          finance_account_id?: string | null
          id?: string
          import_fingerprint?: string | null
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_recurring?: boolean | null
          project_id?: string | null
          recurrence_end_date?: string | null
          recurrence_interval?: string | null
          settled_at?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_card_invoice_id_fkey"
            columns: ["card_invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_card_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_finance_account_id_fkey"
            columns: ["finance_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_items: {
        Row: {
          category: string
          company_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          metadata: Json
          owner: string | null
          priority: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json
          owner?: string | null
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json
          owner?: string | null
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_logs: {
        Row: {
          category: string
          company_id: string | null
          created_at: string
          happened_at: string
          id: string
          item_id: string | null
          notes: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          category: string
          company_id?: string | null
          created_at?: string
          happened_at?: string
          id?: string
          item_id?: string | null
          notes?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          category?: string
          company_id?: string | null
          created_at?: string
          happened_at?: string
          id?: string
          item_id?: string | null
          notes?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "governance_items"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_metrics: {
        Row: {
          category: string
          company_id: string | null
          created_at: string
          id: string
          metric_date: string
          name: string
          notes: string | null
          unit: string | null
          user_id: string | null
          value: number | null
        }
        Insert: {
          category: string
          company_id?: string | null
          created_at?: string
          id?: string
          metric_date?: string
          name: string
          notes?: string | null
          unit?: string | null
          user_id?: string | null
          value?: number | null
        }
        Update: {
          category?: string
          company_id?: string | null
          created_at?: string
          id?: string
          metric_date?: string
          name?: string
          notes?: string | null
          unit?: string | null
          user_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gratitude_entries: {
        Row: {
          company_id: string | null
          content: string
          created_at: string
          entry_date: string
          id: string
          mood: string | null
          tags: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          content: string
          created_at?: string
          entry_date?: string
          id?: string
          mood?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          mood?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gratitude_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string
          id: string
          order_index: number
          title: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          order_index?: number
          title: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          order_index?: number
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_import_logs: {
        Row: {
          company_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          extracted_summary: Json | null
          id: string
          linkedin_url: string | null
          prospect_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          extracted_summary?: Json | null
          id?: string
          linkedin_url?: string | null
          prospect_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          extracted_summary?: Json | null
          id?: string
          linkedin_url?: string | null
          prospect_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_import_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      media_plans: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          notes: string | null
          posts_target: number | null
          project_id: string | null
          reels_target: number | null
          stories_target: number | null
          updated_at: string
          user_id: string | null
          videos_target: number | null
          week_start: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          posts_target?: number | null
          project_id?: string | null
          reels_target?: number | null
          stories_target?: number | null
          updated_at?: string
          user_id?: string | null
          videos_target?: number | null
          week_start: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          posts_target?: number | null
          project_id?: string | null
          reels_target?: number | null
          stories_target?: number | null
          updated_at?: string
          user_id?: string | null
          videos_target?: number | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      media_posts: {
        Row: {
          approach: string | null
          comments: number | null
          company_id: string | null
          copy: string | null
          created_at: string
          format: string
          id: string
          likes: number | null
          notes: string | null
          plan_id: string | null
          posted_at: string
          project_id: string | null
          reach: number | null
          saves: number | null
          shares: number | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approach?: string | null
          comments?: number | null
          company_id?: string | null
          copy?: string | null
          created_at?: string
          format?: string
          id?: string
          likes?: number | null
          notes?: string | null
          plan_id?: string | null
          posted_at?: string
          project_id?: string | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approach?: string | null
          comments?: number | null
          company_id?: string | null
          copy?: string | null
          created_at?: string
          format?: string
          id?: string
          likes?: number | null
          notes?: string | null
          plan_id?: string | null
          posted_at?: string
          project_id?: string | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_posts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "media_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_posts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_focus: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          month: number
          title: string
          user_id: string | null
          year: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          month: number
          title: string
          user_id?: string | null
          year: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          month?: number
          title?: string
          user_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_focus_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      okrs: {
        Row: {
          company_id: string | null
          created_at: string
          current_value: number
          description: string | null
          end_date: string | null
          id: string
          period: string | null
          start_date: string | null
          target_value: number
          title: string
          unit: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          current_value?: number
          description?: string | null
          end_date?: string | null
          id?: string
          period?: string | null
          start_date?: string | null
          target_value?: number
          title: string
          unit?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          current_value?: number
          description?: string | null
          end_date?: string | null
          id?: string
          period?: string | null
          start_date?: string | null
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "okrs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_documents: {
        Row: {
          created_at: string
          description: string | null
          document_url: string | null
          id: string
          order_index: number
          step_id: string
          template_url: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_url?: string | null
          id?: string
          order_index?: number
          step_id: string
          template_url?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          document_url?: string | null
          id?: string
          order_index?: number
          step_id?: string
          template_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_documents_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "onboarding_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          icon: string
          id: string
          order_index: number
          title: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          order_index?: number
          title: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          order_index?: number
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_steps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_focus: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          focus_date: string
          id: string
          priority: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          focus_date?: string
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          focus_date?: string
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_focus_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_chart_nodes: {
        Row: {
          avatar_url: string | null
          color: string | null
          company_id: string | null
          created_at: string
          department: string | null
          email: string | null
          id: string
          name: string
          order_index: number | null
          parent_id: string | null
          phone: string | null
          position: string
          project_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          name: string
          order_index?: number | null
          parent_id?: string | null
          phone?: string | null
          position: string
          project_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          name?: string
          order_index?: number | null
          parent_id?: string | null
          phone?: string | null
          position?: string
          project_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_chart_nodes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_chart_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "org_chart_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_chart_nodes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      persuasion_notes: {
        Row: {
          category: string | null
          company_id: string | null
          content: string | null
          created_at: string
          id: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persuasion_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_assumptions: {
        Row: {
          assumption: string
          company_id: string | null
          confidence: string | null
          created_at: string
          goal_id: string | null
          id: string
          project_id: string | null
          user_id: string | null
        }
        Insert: {
          assumption: string
          company_id?: string | null
          confidence?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          project_id?: string | null
          user_id?: string | null
        }
        Update: {
          assumption?: string
          company_id?: string | null
          confidence?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          project_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planning_assumptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_assumptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_goals: {
        Row: {
          category: string
          company_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          okr_id: string | null
          order_index: number | null
          parent_id: string | null
          progress: number | null
          project_id: string | null
          start_date: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          okr_id?: string | null
          order_index?: number | null
          parent_id?: string | null
          progress?: number | null
          project_id?: string | null
          start_date?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          okr_id?: string | null
          order_index?: number | null
          parent_id?: string | null
          progress?: number | null
          project_id?: string | null
          start_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planning_goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_goals_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "planning_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_milestones: {
        Row: {
          company_id: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          goal_id: string | null
          id: string
          order_index: number | null
          title: string
        }
        Insert: {
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          order_index?: number | null
          title: string
        }
        Update: {
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          order_index?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_milestones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "planning_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_risks: {
        Row: {
          company_id: string | null
          created_at: string
          goal_id: string | null
          id: string
          mitigation: string | null
          project_id: string | null
          risk: string
          severity: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          mitigation?: string | null
          project_id?: string | null
          risk: string
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          mitigation?: string | null
          project_id?: string | null
          risk?: string
          severity?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planning_risks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_financial_impacts: {
        Row: {
          amount: number | null
          company_id: string | null
          created_at: string
          goal_id: string | null
          id: string
          impact_type: string | null
          notes: string | null
          project_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          impact_type?: string | null
          notes?: string | null
          project_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          impact_type?: string | null
          notes?: string | null
          project_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_financial_impacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_financial_impacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_opportunities: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_value: number | null
          id: string
          project_id: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_value?: number | null
          id?: string
          project_id?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_value?: number | null
          id?: string
          project_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          checklist: Json | null
          client: string | null
          column_order: number | null
          company_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          invoice_alert_days: number | null
          invoice_notes: string | null
          labels: string[] | null
          latitude: number | null
          longitude: number | null
          next_invoice_date: string | null
          notes: string | null
          priority: string | null
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          checklist?: Json | null
          client?: string | null
          column_order?: number | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_alert_days?: number | null
          invoice_notes?: string | null
          labels?: string[] | null
          latitude?: number | null
          longitude?: number | null
          next_invoice_date?: string | null
          notes?: string | null
          priority?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          checklist?: Json | null
          client?: string | null
          column_order?: number | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_alert_days?: number | null
          invoice_notes?: string | null
          labels?: string[] | null
          latitude?: number | null
          longitude?: number | null
          next_invoice_date?: string | null
          notes?: string | null
          priority?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_notes: {
        Row: {
          color: string | null
          company_id: string | null
          content: string
          created_at: string
          id: string
          pinned: boolean | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          content: string
          created_at?: string
          id?: string
          pinned?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          company_id?: string | null
          content?: string
          created_at?: string
          id?: string
          pinned?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      review_cycles: {
        Row: {
          agenda: string | null
          company_id: string | null
          created_at: string
          cycle_type: string
          decisions: string | null
          id: string
          next_actions: string | null
          period_end: string
          period_start: string
          project_id: string | null
          summary: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agenda?: string | null
          company_id?: string | null
          created_at?: string
          cycle_type: string
          decisions?: string | null
          id?: string
          next_actions?: string | null
          period_end: string
          period_start: string
          project_id?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agenda?: string | null
          company_id?: string | null
          created_at?: string
          cycle_type?: string
          decisions?: string | null
          id?: string
          next_actions?: string | null
          period_end?: string
          period_start?: string
          project_id?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_cycles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_cycles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmaps: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          paths: Json | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          paths?: Json | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          paths?: Json | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmaps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_checklist_items: {
        Row: {
          active: boolean
          client_id: string | null
          created_at: string
          id: string
          kind: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          client_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          sort_order?: number
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          client_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_checklist_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "routine_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_checklist_logs: {
        Row: {
          client_id: string | null
          created_at: string
          done: boolean
          done_at: string
          id: string
          item_id: string | null
          log_date: string
          notes: string | null
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          done?: boolean
          done_at?: string
          id?: string
          item_id?: string | null
          log_date?: string
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          done?: boolean
          done_at?: string
          id?: string
          item_id?: string | null
          log_date?: string
          notes?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_checklist_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "routine_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_checklist_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "routine_checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_clients: {
        Row: {
          color: string | null
          created_at: string
          id: string
          invoice_day: number | null
          invoice_notes: string | null
          name: string
          notes: string | null
          segment_id: string | null
          sort_order: number
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          invoice_day?: number | null
          invoice_notes?: string | null
          name: string
          notes?: string | null
          segment_id?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          invoice_day?: number | null
          invoice_notes?: string | null
          name?: string
          notes?: string | null
          segment_id?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_clients_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "routine_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_segments: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      routine_tasks: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          sort_order: number
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "routine_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_pillars: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          order_index: number | null
          title: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          order_index?: number | null
          title: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          order_index?: number | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_pillars_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      task_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_weekly: boolean
          order_index: number | null
          parent_task_id: string | null
          priority: string
          priority_order: number
          project_id: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string | null
          week_start: string | null
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_weekly?: boolean
          order_index?: number | null
          parent_task_id?: string | null
          priority?: string
          priority_order?: number
          project_id?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id?: string | null
          week_start?: string | null
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_weekly?: boolean
          order_index?: number | null
          parent_task_id?: string | null
          priority?: string
          priority_order?: number
          project_id?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string | null
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          company_id: string | null
          created_at: string
          date: string
          description: string | null
          hours: number
          id: string
          project_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          hours?: number
          id?: string
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          hours?: number
          id?: string
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      true_north: {
        Row: {
          company_id: string | null
          created_at: string
          current_focus: string | null
          decision_principles: string[] | null
          id: string
          three_year_goal: string | null
          updated_at: string
          user_id: string | null
          values: string[] | null
          vision: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          current_focus?: string | null
          decision_principles?: string[] | null
          id?: string
          three_year_goal?: string | null
          updated_at?: string
          user_id?: string | null
          values?: string[] | null
          vision?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          current_focus?: string | null
          decision_principles?: string[] | null
          id?: string
          three_year_goal?: string | null
          updated_at?: string
          user_id?: string | null
          values?: string[] | null
          vision?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "true_north_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_inbox: {
        Row: {
          company_id: string | null
          content: string | null
          created_at: string
          due_date: string | null
          id: string
          priority: string | null
          source: string | null
          status: string | null
          target_id: string | null
          target_type: string | null
          title: string
          triaged_at: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          content?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: string | null
          source?: string | null
          status?: string | null
          target_id?: string | null
          target_type?: string | null
          title: string
          triaged_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          content?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: string | null
          source?: string | null
          status?: string | null
          target_id?: string | null
          target_type?: string | null
          title?: string
          triaged_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_inbox_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access: {
        Args: { _resource_company_id: string; _resource_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
