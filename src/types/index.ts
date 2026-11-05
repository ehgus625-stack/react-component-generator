export type Provider = 'anthropic' | 'google';

export interface PendingComponent {
  prompt: string;
  code: string;
}

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'reset' }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string; status?: number };

export interface GeneratedComponent {
  id: string;
  prompt: string;
  code: string;
  createdAt: Date;
}
