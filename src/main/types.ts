export interface ThreeDS2Field {
  value: string;
  included: boolean;
}

export interface ThreeDS2PhoneField {
  value: { cc: string; subscriber: string };
  included: boolean;
}

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
