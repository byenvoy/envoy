export interface ShopifyCustomerContext {
  customer: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    created_at: string;
    orders_count: number;
    total_spent: string;
  } | null;
  recent_orders: ShopifyOrder[];
  active_returns: ShopifyReturn[];
}

export interface ShopifyOrder {
  id: string;
  name: string;
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  currency: string;
  line_items: {
    title: string;
    quantity: number;
    variant_title: string | null;
  }[];
  fulfillments: {
    status: string;
    tracking_number: string | null;
    tracking_url: string | null;
    estimated_delivery_at: string | null;
  }[];
}

export interface ShopifyReturn {
  id: string;
  name: string;
  status: string;
}

export type QueryType =
  | "order_status"
  | "return_refund"
  | "product_question"
  | "account_issue"
  | "general_policy"
  | "other";

export interface ClassificationResult {
  query_type: QueryType;
  needs_customer_data: boolean;
  customer_email: string | null;
  order_identifier: string | null;
  reasoning: string;
}
