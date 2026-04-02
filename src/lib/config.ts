export function isCloud(): boolean {
  return process.env.ENVOYER_CLOUD === "true";
}
