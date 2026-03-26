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
      banned_users: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          device_fingerprint: string | null
          id: string
          user_id: string
        }
        Insert: {
          checkin_date?: string
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          user_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          content: string
          created_at: string | null
          id: string
          media_urls: string[] | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          media_urls?: string[] | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          media_urls?: string[] | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      friend_helps: {
        Row: {
          created_at: string
          helped_user_id: string
          helper_id: string
          id: string
        }
        Insert: {
          created_at?: string
          helped_user_id: string
          helper_id: string
          id?: string
        }
        Update: {
          created_at?: string
          helped_user_id?: string
          helper_id?: string
          id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          receiver_id: string
          room_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id: string
          room_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id?: string
          room_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      mini_games: {
        Row: {
          created_at: string
          created_by: string
          end_time: string
          id: string
          link: string
          logo_url: string
          start_time: string
          title: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_time: string
          id?: string
          link: string
          logo_url: string
          start_time: string
          title?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_time?: string
          id?: string
          link?: string
          logo_url?: string
          start_time?: string
          title?: string
          visibility?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          account_holder: string
          account_number: string
          amount: number | null
          bank_name: string
          created_at: string
          due_day: number
          id: string
          note: string | null
          qr_url: string | null
          receipt_url: string | null
          receiver_id: string
          reviewed_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          account_holder: string
          account_number: string
          amount?: number | null
          bank_name: string
          created_at?: string
          due_day: number
          id?: string
          note?: string | null
          qr_url?: string | null
          receipt_url?: string | null
          receiver_id: string
          reviewed_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          amount?: number | null
          bank_name?: string
          created_at?: string
          due_day?: number
          id?: string
          note?: string | null
          qr_url?: string | null
          receipt_url?: string | null
          receiver_id?: string
          reviewed_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      protection_passwords: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          password_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          password_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          password_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_actions: {
        Row: {
          action_type: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          max_per_day: number
          points: number
        }
        Insert: {
          action_type: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          max_per_day?: number
          points?: number
        }
        Update: {
          action_type?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          max_per_day?: number
          points?: number
        }
        Relationships: []
      }
      reward_history: {
        Row: {
          action_type: string
          created_at: string
          device_fingerprint: string | null
          id: string
          points: number
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          points: number
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          points?: number
          user_id?: string
        }
        Relationships: []
      }
      room_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          message: string | null
          room_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          message?: string | null
          room_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          message?: string | null
          room_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          address_detail: string
          amenities: string[] | null
          approval_status: string
          area: number | null
          created_at: string
          description: string | null
          district: string | null
          id: string
          images: string[] | null
          is_available: boolean
          landlord_id: string
          latitude: number | null
          longitude: number | null
          media_urls: string[] | null
          phone: string
          price: number
          province: string | null
          room_code: string
          room_number: string
          title: string
          updated_at: string
          videos: string[] | null
          ward: string | null
        }
        Insert: {
          address_detail?: string
          amenities?: string[] | null
          approval_status?: string
          area?: number | null
          created_at?: string
          description?: string | null
          district?: string | null
          id?: string
          images?: string[] | null
          is_available?: boolean
          landlord_id: string
          latitude?: number | null
          longitude?: number | null
          media_urls?: string[] | null
          phone?: string
          price?: number
          province?: string | null
          room_code: string
          room_number?: string
          title: string
          updated_at?: string
          videos?: string[] | null
          ward?: string | null
        }
        Update: {
          address_detail?: string
          amenities?: string[] | null
          approval_status?: string
          area?: number | null
          created_at?: string
          description?: string | null
          district?: string | null
          id?: string
          images?: string[] | null
          is_available?: boolean
          landlord_id?: string
          latitude?: number | null
          longitude?: number | null
          media_urls?: string[] | null
          phone?: string
          price?: number
          province?: string | null
          room_code?: string
          room_number?: string
          title?: string
          updated_at?: string
          videos?: string[] | null
          ward?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      submission_files: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type: string
          file_url: string
          id?: string
          submission_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          account_id: string | null
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string
          score: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          phone: string
          score?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
          score?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_points: {
        Row: {
          id: string
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_unlocks: {
        Row: {
          created_at: string
          feature_type: string
          id: string
          points_spent: number
          room_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_type: string
          id?: string
          points_spent?: number
          room_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          feature_type?: string
          id?: string
          points_spent?: number
          room_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_device_reward_today: {
        Args: { _action_type?: string; _fingerprint: string }
        Returns: boolean
      }
      generate_display_id: { Args: never; Returns: string }
      get_admin_user_id: { Args: never; Returns: string }
      handle_new_user_signup: {
        Args: { _full_name: string; _role: string; _user_id: string }
        Returns: undefined
      }
      has_role: { Args: { _role: string; _uid: string }; Returns: boolean }
      is_first_user: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
