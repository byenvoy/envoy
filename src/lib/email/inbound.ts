import { Inbound } from "inboundemail";

let client: Inbound | null = null;

export function getInboundClient(): Inbound {
  if (!client) {
    client = new Inbound({ apiKey: process.env.INBOUND_API_KEY! });
  }
  return client;
}
