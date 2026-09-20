export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          role: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      daily_goals: {
        Row: {
          calorias: number;
          carbs_g: number;
          gordura_g: number;
          proteina_g: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          calorias?: number;
          carbs_g?: number;
          gordura_g?: number;
          proteina_g?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          calorias?: number;
          carbs_g?: number;
          gordura_g?: number;
          proteina_g?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      food_entries: {
        Row: {
          calorias: number;
          carbs: number;
          created_at: string;
          data: string;
          foto_url: string | null;
          gord: number;
          id: string;
          nome: string;
          porcoes: number;
          prot: number;
          user_id: string;
        };
        Insert: {
          calorias?: number;
          carbs?: number;
          created_at?: string;
          data?: string;
          foto_url?: string | null;
          gord?: number;
          id?: string;
          nome: string;
          porcoes?: number;
          prot?: number;
          user_id: string;
        };
        Update: {
          calorias?: number;
          carbs?: number;
          created_at?: string;
          data?: string;
          foto_url?: string | null;
          gord?: number;
          id?: string;
          nome?: string;
          porcoes?: number;
          prot?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      food_images: {
        Row: {
          nome: string;
          updated_at: string;
          url: string;
        };
        Insert: {
          nome: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          nome?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [];
      };
      foods_basic: {
        Row: {
          cal: number;
          carb: number;
          created_at: string;
          foto_url: string | null;
          gord: number;
          id: string;
          nome: string;
          prot: number;
        };
        Insert: {
          cal: number;
          carb: number;
          created_at?: string;
          foto_url?: string | null;
          gord: number;
          id?: string;
          nome: string;
          prot: number;
        };
        Update: {
          cal?: number;
          carb?: number;
          created_at?: string;
          foto_url?: string | null;
          gord?: number;
          id?: string;
          nome?: string;
          prot?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          altura: number | null;
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          fcm_token: string | null;
          id: string;
          idade: number | null;
          nome: string | null;
          objetivo: Database["public"]["Enums"]["objetivo_tipo"] | null;
          onboarding_done: boolean;
          peso: number | null;
          updated_at: string;
        };
        Insert: {
          altura?: number | null;
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          fcm_token?: string | null;
          id: string;
          idade?: number | null;
          nome?: string | null;
          objetivo?: Database["public"]["Enums"]["objetivo_tipo"] | null;
          onboarding_done?: boolean;
          peso?: number | null;
          updated_at?: string;
        };
        Update: {
          altura?: number | null;
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          fcm_token?: string | null;
          id?: string;
          idade?: number | null;
          nome?: string | null;
          objetivo?: Database["public"]["Enums"]["objetivo_tipo"] | null;
          onboarding_done?: boolean;
          peso?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      rewards: {
        Row: {
          bonus_aplicado: boolean;
          bonus_scans: number;
          created_at: string;
          descricao: string | null;
          id: string;
          lida: boolean;
          titulo: string;
          user_id: string;
        };
        Insert: {
          bonus_aplicado?: boolean;
          bonus_scans?: number;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          lida?: boolean;
          titulo: string;
          user_id: string;
        };
        Update: {
          bonus_aplicado?: boolean;
          bonus_scans?: number;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          lida?: boolean;
          titulo?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      scan_usage: {
        Row: {
          bonus: number;
          count: number;
          data: string;
          user_id: string;
        };
        Insert: {
          bonus?: number;
          count?: number;
          data?: string;
          user_id: string;
        };
        Update: {
          bonus?: number;
          count?: number;
          data?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          ai_agent_enabled: boolean;
          current_period_end: string | null;
          plan: string | null;
          scans_credits: number;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_end: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_agent_enabled?: boolean;
          current_period_end?: string | null;
          plan?: string | null;
          scans_credits?: number;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_end?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_agent_enabled?: boolean;
          current_period_end?: string | null;
          plan?: string | null;
          scans_credits?: number;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_end?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      water_intake: {
        Row: {
          created_at: string;
          data: string;
          id: string;
          ml: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          data?: string;
          id?: string;
          ml: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          data?: string;
          id?: string;
          ml?: number;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_reward: {
        Args: { _reward_id: string };
        Returns: {
          scans_added: number;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "user";
      objetivo_tipo: "perder" | "manter" | "ganhar";
      subscription_status: "free" | "trialing" | "active" | "expired";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      objetivo_tipo: ["perder", "manter", "ganhar"],
      subscription_status: ["free", "trialing", "active", "expired"],
    },
  },
} as const;
