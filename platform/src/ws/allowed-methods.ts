// Allowlist / strategy for each gateway RPC method
// Strategies:
//   "allow"    — pass through as-is
//   "block"    — reject with error
//   "rewrite"  — proxy rewrites params (agentId injection, etc.)
//   "filter"   — allow but filter response
//   "transform"— proxy transforms the request

export type MethodStrategy = "allow" | "block" | "rewrite" | "filter" | "transform";

const METHOD_RULES: Record<string, MethodStrategy> = {
  // Connection — proxy sends its own connect
  connect: "block",

  // Config
  "config.get": "block",
  "config.set": "block",
  "config.apply": "block",
  "config.patch": "transform",
  "config.schema": "allow",

  // Health + Models
  health: "allow",
  "models.list": "allow",

  // Agents — rewrite to enforce agentId
  "agents.list": "filter",
  "agents.files.list": "rewrite",
  "agents.files.get": "rewrite",
  "agents.files.set": "rewrite",

  // Sessions — rewrite to validate prefix
  "sessions.list": "rewrite",
  "sessions.get": "rewrite",
  "sessions.create": "rewrite",
  "sessions.delete": "rewrite",

  // Chat — allow with session key validation
  "chat.send": "allow",
  "chat.stop": "allow",

  // Skills — read-only
  "skills.list": "allow",
  "skills.install": "block",
  "skills.update": "block",
  "skills.remove": "block",

  // Channels — scoped to tenant's account
  "channels.status": "allow",
  "channels.accounts": "block",
  "channels.config": "block",

  // WhatsApp login — rewrite to inject tenant's accountId
  "web.login.start": "rewrite",
  "web.login.wait": "rewrite",
  "node.list": "block",
  "node.approve": "block",
  "node.reject": "block",
  "node.remove": "block",
  "device.list": "block",
  "device.approve": "block",
  "device.reject": "block",
  "device.remove": "block",
  "exec.run": "block",
  "logs.tail": "block",
  "update.run": "block",
  "update.check": "block",
};

export function getMethodStrategy(method: string): MethodStrategy {
  return METHOD_RULES[method] ?? "block";
}

export function isBlocked(method: string): boolean {
  return getMethodStrategy(method) === "block";
}
