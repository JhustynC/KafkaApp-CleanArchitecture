declare module '@binance/connector' {
  export class Spot {
    constructor(apiKey?: string, apiSecret?: string, options?: {
      baseURL?: string;
      timeout?: number;
      wsURL?: string;
    });

    combinedStreams(
      streams: string | string[],
      callbacks: {
        open?: () => void;
        close?: () => void;
        message: (data: string) => void;
        error?: (error: Error) => void;
      }
    ): WebSocket;

    unsubscribe(wsRef: WebSocket): void;
  }

  export interface WebSocket {
    // WebSocket properties and methods
    close(): void;
  }
}
