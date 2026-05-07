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
          company_id: string | null
          content_type: string | null
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          company_id?: string | null
          content_type?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string | null
          content_type?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_company_id_fkey"
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
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
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
          company: string | null
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          pipeline_stage: string | null
          project_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          project_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          project_id?: string | null
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
          color: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          professor: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          professor?: string | null
          user_id?: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
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
      financial_transactions: {
        Row: {
          amount: number
          category: string | null
          company_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          is_recurring: boolean | null
          recurrence_interval: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          description: string
          id?: string
          is_recurring?: boolean | null
          recurrence_interval?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          is_recurring?: boolean | null
          recurrence_interval?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
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
          order_index: number | null
          parent_id: string | null
          progress: number | null
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
          order_index?: number | null
          parent_id?: string | null
          progress?: number | null
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
          order_index?: number | null
          parent_id?: string | null
          progress?: number | null
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
      projects: {
        Row: {
          checklist: Json | null
          client: string | null
          column_order: number | null
          company_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          labels: string[] | null
          notes: string | null
          priority: string | null
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          checklist?: Json | null
          client?: string | null
          column_order?: number | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          labels?: string[] | null
          notes?: string | null
          priority?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          checklist?: Json | null
          client?: string | null
          column_order?: number | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          labels?: string[] | null
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
          order_index: number | null
          parent_task_id: string | null
          priority: string
          project_id: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number | null
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number | null
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string | null
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
