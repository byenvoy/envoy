export function isCloud(): boolean {
  return process.env.ENVOY_CLOUD === "true";
}
