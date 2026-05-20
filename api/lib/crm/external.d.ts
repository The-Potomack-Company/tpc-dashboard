declare module '@google/generative-ai' {
  export type Part =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } };

  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(config: { model: string }): {
      generateContent(input: string | Part[]): Promise<{
        response: {
          text(): string;
        };
      }>;
    };
  }
}

declare module 'googleapis' {
  export const google: {
    auth: {
      OAuth2: new (clientId: string, clientSecret: string) => {
        setCredentials(credentials: { refresh_token: string }): void;
      };
    };
    gmail(config: { version: 'v1'; auth: unknown }): {
      users: {
        messages: {
          list(params: { userId: string; q: string }): Promise<{
            data: {
              messages?: Array<{ id?: string | null }>;
            };
          }>;
          get(params: { userId: string; id: string; format: 'full' }): Promise<{
            data: unknown;
          }>;
          attachments: {
            get(params: { userId: string; messageId: string; id: string }): Promise<{
              data: { data?: string | null; size?: number | null };
            }>;
          };
        };
      };
    };
  };
}
