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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cart_items: {
        Row: {
          created_at: string
          member_id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          member_id: string
          product_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          member_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      farewell_notes: {
        Row: {
          body: string
          created_at: string
          member_id: string | null
          subscription_id: string
        }
        Insert: {
          body: string
          created_at?: string
          member_id?: string | null
          subscription_id: string
        }
        Update: {
          body?: string
          created_at?: string
          member_id?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farewell_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farewell_notes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
        }
        Update: {
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancel_rejected_at: string | null
          created_at: string
          id: string
          member_id: string | null
          order_number: string
          paid_at: string | null
          ship_address: string
          ship_phone: string
          ship_recipient_name: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          cancel_rejected_at?: string | null
          created_at?: string
          id?: string
          member_id?: string | null
          order_number: string
          paid_at?: string | null
          ship_address: string
          ship_phone: string
          ship_recipient_name: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          cancel_rejected_at?: string | null
          created_at?: string
          id?: string
          member_id?: string | null
          order_number?: string
          paid_at?: string | null
          ship_address?: string
          ship_phone?: string
          ship_recipient_name?: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          approved_at: string | null
          created_at: string
          failure_code: string | null
          id: string
          order_id: string | null
          pg_order_id: string
          pg_payment_key: string | null
          refunded_at: string | null
          round_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          created_at?: string
          failure_code?: string | null
          id?: string
          order_id?: string | null
          pg_order_id: string
          pg_payment_key?: string | null
          refunded_at?: string | null
          round_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          created_at?: string
          failure_code?: string | null
          id?: string
          order_id?: string | null
          pg_order_id?: string
          pg_payment_key?: string | null
          refunded_at?: string | null
          round_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "subscription_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          author: string
          created_at: string
          description: string
          id: string
          image_url: string
          keeper_note: string
          name: string
          price: number
          publisher_description: string | null
          stock: number
          theme: Database["public"]["Enums"]["theme"]
          updated_at: string
        }
        Insert: {
          author: string
          created_at?: string
          description: string
          id?: string
          image_url: string
          keeper_note: string
          name: string
          price: number
          publisher_description?: string | null
          stock: number
          theme: Database["public"]["Enums"]["theme"]
          updated_at?: string
        }
        Update: {
          author?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          keeper_note?: string
          name?: string
          price?: number
          publisher_description?: string | null
          stock?: number
          theme?: Database["public"]["Enums"]["theme"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nickname: string
          role: Database["public"]["Enums"]["member_role"]
        }
        Insert: {
          created_at?: string
          id: string
          nickname?: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Update: {
          created_at?: string
          id?: string
          nickname?: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Relationships: []
      }
      reader_letters: {
        Row: {
          body: string
          created_at: string
          member_id: string | null
          round_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          member_id?: string | null
          round_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          member_id?: string | null
          round_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reader_letters_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reader_letters_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "subscription_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      round_contents: {
        Row: {
          postcard_path: string | null
          product_id: string | null
          reply_letter: string | null
          round_id: string
          updated_at: string
        }
        Insert: {
          postcard_path?: string | null
          product_id?: string | null
          reply_letter?: string | null
          round_id: string
          updated_at?: string
        }
        Update: {
          postcard_path?: string | null
          product_id?: string | null
          reply_letter?: string | null
          round_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_contents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_contents_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "subscription_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      shelf_memos: {
        Row: {
          body: string
          member_id: string
          round_id: string
          updated_at: string
        }
        Insert: {
          body: string
          member_id: string
          round_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          member_id?: string
          round_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelf_memos_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_memos_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "subscription_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_addresses: {
        Row: {
          address: string
          member_id: string
          phone: string
          recipient_name: string
          updated_at: string
        }
        Insert: {
          address: string
          member_id: string
          phone: string
          recipient_name: string
          updated_at?: string
        }
        Update: {
          address?: string
          member_id?: string
          phone?: string
          recipient_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_addresses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_list_downloads: {
        Row: {
          created_at: string
          id: string
          keeper_id: string | null
          row_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          keeper_id?: string | null
          row_count: number
        }
        Update: {
          created_at?: string
          id?: string
          keeper_id?: string | null
          row_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "shipping_list_downloads_keeper_id_fkey"
            columns: ["keeper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_rounds: {
        Row: {
          amount: number
          cancel_rejected_at: string | null
          cancel_requested_at: string | null
          created_at: string
          id: string
          member_id: string | null
          opened_at: string | null
          paid_at: string | null
          ship_address: string
          ship_phone: string
          ship_recipient_name: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["round_status"]
          subscription_id: string | null
          teaser: string | null
          unboxed_at: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          cancel_rejected_at?: string | null
          cancel_requested_at?: string | null
          created_at?: string
          id?: string
          member_id?: string | null
          opened_at?: string | null
          paid_at?: string | null
          ship_address: string
          ship_phone: string
          ship_recipient_name: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["round_status"]
          subscription_id?: string | null
          teaser?: string | null
          unboxed_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cancel_rejected_at?: string | null
          cancel_requested_at?: string | null
          created_at?: string
          id?: string
          member_id?: string | null
          opened_at?: string | null
          paid_at?: string | null
          ship_address?: string
          ship_phone?: string
          ship_recipient_name?: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["round_status"]
          subscription_id?: string | null
          teaser?: string | null
          unboxed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_rounds_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_rounds_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          ended_at: string | null
          id: string
          member_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
        }
        Insert: {
          ended_at?: string | null
          id?: string
          member_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
        }
        Update: {
          ended_at?: string | null
          id?: string
          member_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unboxing_codes: {
        Row: {
          code: string
          created_at: string
          round_id: string
          used_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          round_id: string
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          round_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unboxing_codes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "subscription_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      begin_refund: {
        Args: { p_id: string; p_kind: string }
        Returns: {
          amount: number
          approved_at: string | null
          created_at: string
          failure_code: string | null
          id: string
          order_id: string | null
          pg_order_id: string
          pg_payment_key: string | null
          refunded_at: string | null
          round_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_pending: {
        Args: { p_id: string; p_kind: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      complete_refund: { Args: { p_payment_id: string }; Returns: undefined }
      confirm_payment: {
        Args: { p_amount: number; p_payment_key: string; p_pg_order_id: string }
        Returns: Json
      }
      create_order: {
        Args: { p_ship: Json }
        Returns: {
          cancel_rejected_at: string | null
          created_at: string
          id: string
          member_id: string | null
          order_number: string
          paid_at: string | null
          ship_address: string
          ship_phone: string
          ship_recipient_name: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_payment: {
        Args: { p_order_id: string; p_round_id: string }
        Returns: {
          amount: number
          approved_at: string | null
          created_at: string
          failure_code: string | null
          id: string
          order_id: string | null
          pg_order_id: string
          pg_payment_key: string | null
          refunded_at: string | null
          round_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_round: {
        Args: { p_letter: string; p_ship: Json }
        Returns: {
          amount: number
          cancel_rejected_at: string | null
          cancel_requested_at: string | null
          created_at: string
          id: string
          member_id: string | null
          opened_at: string | null
          paid_at: string | null
          ship_address: string
          ship_phone: string
          ship_recipient_name: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["round_status"]
          subscription_id: string | null
          teaser: string | null
          unboxed_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "subscription_rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      end_subscription: { Args: { p_note: string }; Returns: undefined }
      fail_payment: {
        Args: { p_code: string; p_pg_order_id: string }
        Returns: undefined
      }
      fail_refund: { Args: { p_payment_id: string }; Returns: undefined }
      is_keeper: { Args: never; Returns: boolean }
      keeper_counts: { Args: never; Returns: Json }
      list_shipping_targets: {
        Args: never
        Returns: {
          address: string
          books: string
          kind: string
          order_number: string
          paid_at: string
          phone: string
          recipient_name: string
          target_id: string
        }[]
      }
      open_round: { Args: { p_round_id: string }; Returns: undefined }
      reject_cancel: {
        Args: { p_id: string; p_kind: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      request_cancel: {
        Args: { p_id: string; p_kind: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      ship_order: {
        Args: { p_order_id: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      ship_round: {
        Args: { p_code: string; p_round_id: string; p_teaser: string }
        Returns: string
      }
      unbox_round: {
        Args: { p_code: string; p_round_id: string }
        Returns: boolean
      }
      withdraw_cancel: {
        Args: { p_id: string; p_kind: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      withdraw_member: { Args: never; Returns: Json }
    }
    Enums: {
      member_role: "member" | "keeper"
      order_status:
        | "pending_payment"
        | "paid"
        | "cancel_requested"
        | "shipped"
        | "refunded"
        | "cancelled"
      payment_status: "ready" | "paid" | "refunding" | "refunded" | "failed"
      round_status:
        | "pending_payment"
        | "arrived"
        | "reading"
        | "shipped"
        | "unboxed"
        | "cancelled"
      subscription_status: "active" | "ended"
      theme: "nature" | "food" | "ecology" | "local"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      member_role: ["member", "keeper"],
      order_status: [
        "pending_payment",
        "paid",
        "cancel_requested",
        "shipped",
        "refunded",
        "cancelled",
      ],
      payment_status: ["ready", "paid", "refunding", "refunded", "failed"],
      round_status: [
        "pending_payment",
        "arrived",
        "reading",
        "shipped",
        "unboxed",
        "cancelled",
      ],
      subscription_status: ["active", "ended"],
      theme: ["nature", "food", "ecology", "local"],
    },
  },
} as const
