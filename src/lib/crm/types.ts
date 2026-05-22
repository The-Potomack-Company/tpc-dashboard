export interface CrmMessage {
  messageId: string;
  from: {
    name: string;
    email: string;
  };
  date: string;
  snippet: string;
  bodyText: string;
  hasAttachments: boolean;
  isForward: boolean;
}
