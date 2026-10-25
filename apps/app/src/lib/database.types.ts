export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      areas: {
        Row: {
          archived_at: string | null;
          created_at: string;
          group_id: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          group_id: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          group_id?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'areas_group_id_user_id_fkey';
            columns: ['group_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      goal_versions: {
        Row: {
          created_at: string;
          effective_from: string;
          goal_id: string;
          id: string;
          target_minutes: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          effective_from: string;
          goal_id: string;
          id?: string;
          target_minutes: number;
        };
        Update: {
          created_at?: string;
          effective_from?: string;
          goal_id?: string;
          id?: string;
          target_minutes?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'goal_versions_goal_id_fkey';
            columns: ['goal_id'];
            isOneToOne: false;
            referencedRelation: 'goals';
            referencedColumns: ['id'];
          },
        ];
      };
      goals: {
        Row: {
          archived_at: string | null;
          area_id: string | null;
          created_at: string;
          group_id: string | null;
          id: string;
          period: string;
          target_kind: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          area_id?: string | null;
          created_at?: string;
          group_id?: string | null;
          id?: string;
          period: string;
          target_kind: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          area_id?: string | null;
          created_at?: string;
          group_id?: string | null;
          id?: string;
          period?: string;
          target_kind?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'goals_area_id_user_id_fkey';
            columns: ['area_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'areas';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'goals_group_id_user_id_fkey';
            columns: ['group_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      groups: {
        Row: {
          archived_at: string | null;
          color: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          color: string;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          pomodoro_focus_min: number;
          pomodoro_long_break_min: number;
          pomodoro_long_every: number;
          pomodoro_short_break_min: number;
          theme: string;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id: string;
          pomodoro_focus_min?: number;
          pomodoro_long_break_min?: number;
          pomodoro_long_every?: number;
          pomodoro_short_break_min?: number;
          theme?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          pomodoro_focus_min?: number;
          pomodoro_long_break_min?: number;
          pomodoro_long_every?: number;
          pomodoro_short_break_min?: number;
          theme?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      session_pauses: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          paused_at: string;
          resumed_at: string | null;
          session_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          kind?: string;
          paused_at?: string;
          resumed_at?: string | null;
          session_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          paused_at?: string;
          resumed_at?: string | null;
          session_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_pauses_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      session_tags: {
        Row: {
          created_at: string;
          session_id: string;
          tag_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          session_id: string;
          tag_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          session_id?: string;
          tag_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_tags_session_id_user_id_fkey';
            columns: ['session_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'session_tags_tag_id_user_id_fkey';
            columns: ['tag_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      sessions: {
        Row: {
          area_id: string;
          created_at: string;
          ended_at: string | null;
          id: string;
          mode: string;
          note: string | null;
          pomodoro_config: Json | null;
          source: string;
          started_at: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          area_id: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          mode?: string;
          note?: string | null;
          pomodoro_config?: Json | null;
          source?: string;
          started_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          area_id?: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          mode?: string;
          note?: string | null;
          pomodoro_config?: Json | null;
          source?: string;
          started_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sessions_area_id_user_id_fkey';
            columns: ['area_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'areas';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      shares: {
        Row: {
          created_at: string;
          hide_area_names: boolean;
          id: string;
          payload: NonNullable<Json>;
          period_end: string;
          period_label: string;
          period_start: string;
          revoked_at: string | null;
          token: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          hide_area_names?: boolean;
          id?: string;
          payload: NonNullable<Json>;
          period_end: string;
          period_label: string;
          period_start: string;
          revoked_at?: string | null;
          token?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          hide_area_names?: boolean;
          id?: string;
          payload?: NonNullable<Json>;
          period_end?: string;
          period_label?: string;
          period_start?: string;
          revoked_at?: string | null;
          token?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_pomodoro: {
        Args: {
          p_close_open_at: string;
          p_expected_pauses: number;
          p_new_pauses: Json;
          p_session_id: string;
        };
        Returns: undefined;
      };
      create_goal: {
        Args: {
          p_area_id: string;
          p_effective_from?: string;
          p_group_id: string;
          p_period: string;
          p_target_kind: string;
          p_target_minutes: number;
        };
        Returns: {
          archived_at: string | null;
          area_id: string | null;
          created_at: string;
          group_id: string | null;
          id: string;
          period: string;
          target_kind: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'goals';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      edit_session: {
        Args: {
          p_area_id: string;
          p_ended_at: string;
          p_note: string;
          p_session_id: string;
          p_started_at: string;
        };
        Returns: {
          area_id: string;
          created_at: string;
          ended_at: string | null;
          id: string;
          mode: string;
          note: string | null;
          pomodoro_config: Json | null;
          source: string;
          started_at: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'sessions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_share: {
        Args: { p_token: string };
        Returns: {
          created_at: string;
          hide_area_names: boolean;
          payload: Json;
          period_end: string;
          period_label: string;
          period_start: string;
        }[];
      };
      is_valid_pomodoro_config: { Args: { c: Json }; Returns: boolean };
      is_valid_timezone: { Args: { tz: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
