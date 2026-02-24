// Inject / enforce agentId in all agents.* and sessions.* RPCs

export type RequestFrame = {
  type: "req";
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

// Rewrite agent-scoped RPC params to enforce the tenant's agentId
export function scopeAgentRequest(frame: RequestFrame, agentId: string): RequestFrame {
  const method = frame.method;
  const params = { ...frame.params } as Record<string, unknown>;

  // agents.files.* — force agentId
  if (method.startsWith("agents.files.")) {
    params.agentId = agentId;
    return { ...frame, params };
  }

  // web.login.* — inject tenant's WhatsApp accountId
  if (method.startsWith("web.login.")) {
    params.accountId = `${agentId}-wa`;
    return { ...frame, params };
  }

  // sessions.* — inject agent prefix for session keys
  if (method.startsWith("sessions.")) {
    if (typeof params.key === "string" && !params.key.startsWith(`${agentId}/`)) {
      params.key = `${agentId}/${params.key}`;
    }
    if (typeof params.agentId === "string") {
      params.agentId = agentId;
    }
    return { ...frame, params };
  }

  return { ...frame, params };
}

// Filter agents.list response to only show the tenant's agent
export function filterAgentsListResponse(payload: unknown, agentId: string): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const p = payload as Record<string, unknown>;

  if (Array.isArray(p.agents)) {
    p.agents = p.agents.filter(
      (a: unknown) => a && typeof a === "object" && (a as { id: string }).id === agentId,
    );
  }

  return p;
}

// Validate a session key belongs to the tenant
export function validateSessionKey(sessionKey: string, agentId: string): boolean {
  return sessionKey.startsWith(`${agentId}/`);
}
