export interface HarnessRequest {
  prompt: string;
  taskId?: string;
  agentId: string;
}

export interface HarnessResponse {
  output: string;
}

export interface HarnessClient {
  kind: string;
  run(req: HarnessRequest): Promise<HarnessResponse>;
}
