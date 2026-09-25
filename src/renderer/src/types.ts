export interface ConfigRecord {
  key: string;
  value: string | Record<string, unknown>;
  included: boolean;
  order: number;
}

export interface EndpointSet {
  id: string;
  name: string;
  createdAt: string;
  config: ConfigRecord[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  endpoint: string;
  method: string;
  path: string;
  requestHeaders: Record<string, string | string[] | undefined>;
  requestBody: unknown;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
}

export type Page =
  | 'config-verifyuser'
  | 'config-authorize'
  | 'config-transfer'
  | 'config-cancel'
  | 'config-notification'
  | 'config-lookupuser'
  | 'config-signin'
  | 'logs';
