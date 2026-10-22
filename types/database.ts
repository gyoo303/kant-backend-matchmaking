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
      fail_payment: {
        Args: { p_code: string; p_pg_order_id: string }
        Returns: undefined
      }
      fail_refund: { Args: { p_payment_id: string }; Returns: undefined }
      is_keeper: { Args: never; Returns: boolean }
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
      withdraw_cancel: {
        Args: { p_id: string; p_kind: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
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
