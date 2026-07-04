import type { IntrospectionQuery } from 'graphql';

export type EnvironmentConfig =
  | string
  | {
      url: string;
      priority?: number;
      headers?: Record<string, string>;
    };

export interface SchemaSyncConfig {
  environments: Record<string, EnvironmentConfig>;
  baseEnvironment: string;
  output: {
    compatSchema: string;
    types: string;
    report: string;
    defaults: string;
  };
  codegen?: {
    documents?: string | string[];
    plugins?: string[];
    config?: Record<string, unknown>;
  };
  headers?: Record<string, string>;
}

export interface ResolvedEnvironment {
  name: string;
  url: string;
  priority: number;
  headers: Record<string, string>;
}

export interface EnvironmentSchema {
  environment: ResolvedEnvironment;
  introspection: IntrospectionQuery;
}

export interface FieldAvailability {
  environments: string[];
  missingIn: string[];
}

export interface CompatField {
  name: string;
  description?: string | null;
  typeSdl: string;
  originalTypeSdl: string;
  args: CompatArg[];
  defaultValue?: string | null;
  availability: FieldAvailability;
  isRequiredInAll: boolean;
}

export interface CompatArg {
  name: string;
  description?: string | null;
  typeSdl: string;
  originalTypeSdl: string;
  defaultValue?: string | null;
  availability: FieldAvailability;
  isRequiredInAll: boolean;
}

export interface CompatType {
  kind: 'OBJECT' | 'INTERFACE' | 'INPUT_OBJECT' | 'ENUM' | 'UNION' | 'SCALAR';
  name: string;
  description?: string | null;
  fields?: CompatField[];
  enumValues?: Array<{
    name: string;
    description?: string | null;
    availability: FieldAvailability;
  }>;
  possibleTypes?: string[];
  interfaces?: string[];
}

export interface CompatSchema {
  types: CompatType[];
  environments: string[];
  baseEnvironment: string;
}

export interface EnvironmentOverview {
  role: 'base';
  types: string[];
  queries: string[];
  mutations: string[];
  subscriptions: string[];
}

export interface MissedTypeEntry {
  name: string;
  kind: CompatType['kind'];
  missedFields?: string[];
  missedEnumValues?: string[];
}

export interface EnvironmentMisses {
  role: 'target';
  missedTypes: MissedTypeEntry[];
  missedQueries: string[];
  missedMutations: string[];
  missedSubscriptions: string[];
}

export type EnvironmentReportEntry = EnvironmentOverview | EnvironmentMisses;

export interface CompatReportEntry {
  type: string;
  field: string;
  availableIn: string[];
  missingIn: string[];
  madeOptional: boolean;
}

export interface CompatReport {
  generatedAt: string;
  baseEnvironment: string;
  environments: string[];
  summary: {
    totalTypes: number;
    typesWithDifferences: number;
    fieldsWithDifferences: number;
  };
  byEnvironment: Record<string, EnvironmentReportEntry>;
  differences: CompatReportEntry[];
}
