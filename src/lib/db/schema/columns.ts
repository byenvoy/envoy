import { customType } from "drizzle-orm/pg-core";

export const vector1536 = customType<{ data: string; driverParam: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return value as string;
  },
});
