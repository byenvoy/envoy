import type {
  ShopifyCustomerContext,
  ShopifyOrder,
  ShopifyReturn,
} from "@/lib/types/shopify";

const API_VERSION = "2025-01";

interface GraphQLResponse<T> {
  data: T;
  errors?: { message: string }[];
}

export class ShopifyClient {
  private endpoint: string;
  private headers: Record<string, string>;

  constructor(shopDomain: string, accessToken: string) {
    this.endpoint = `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`;
    this.headers = {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    };
  }

  async query<T>(graphql: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ query: graphql, variables }),
    });

    if (!res.ok) {
      throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
    }

    const json: GraphQLResponse<T> = await res.json();
    if (json.errors?.length) {
      throw new Error(`Shopify GraphQL error: ${json.errors[0].message}`);
    }
    return json.data;
  }

  async getShop(): Promise<{ name: string }> {
    const data = await this.query<{ shop: { name: string } }>(`{ shop { name } }`);
    return data.shop;
  }

  async lookupCustomerByEmail(email: string): Promise<ShopifyCustomerContext["customer"]> {
    const data = await this.query<{
      customers: {
        edges: {
          node: {
            id: string;
            email: string;
            firstName: string | null;
            lastName: string | null;
            createdAt: string;
            numberOfOrders: string;
            amountSpent: { amount: string; currencyCode: string };
          };
        }[];
      };
    }>(
      `query($query: String!) {
        customers(first: 1, query: $query) {
          edges {
            node {
              id
              email
              firstName
              lastName
              createdAt
              numberOfOrders
              amountSpent { amount currencyCode }
            }
          }
        }
      }`,
      { query: `email:${email}` }
    );

    const node = data.customers.edges[0]?.node;
    if (!node) return null;

    return {
      id: node.id,
      email: node.email,
      first_name: node.firstName,
      last_name: node.lastName,
      created_at: node.createdAt,
      orders_count: parseInt(node.numberOfOrders, 10) || 0,
      total_spent: node.amountSpent.amount,
    };
  }

  async getRecentOrders(email: string, limit = 5): Promise<ShopifyOrder[]> {
    const data = await this.query<{
      orders: {
        edges: {
          node: {
            id: string;
            name: string;
            createdAt: string;
            displayFinancialStatus: string;
            displayFulfillmentStatus: string;
            totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
            lineItems: {
              edges: {
                node: { title: string; quantity: number; variantTitle: string | null };
              }[];
            };
            fulfillments: {
              status: string;
              trackingInfo: { number: string | null; url: string | null }[];
              estimatedDeliveryAt: string | null;
            }[];
          };
        }[];
      };
    }>(
      `query($query: String!, $limit: Int!) {
        orders(first: $limit, query: $query, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus
              totalPriceSet { shopMoney { amount currencyCode } }
              lineItems(first: 10) {
                edges {
                  node { title quantity variantTitle }
                }
              }
              fulfillments {
                status
                trackingInfo { number url }
                estimatedDeliveryAt
              }
            }
          }
        }
      }`,
      { query: `email:${email}`, limit }
    );

    return data.orders.edges.map(({ node }) => ({
      id: node.id,
      name: node.name,
      created_at: node.createdAt,
      financial_status: node.displayFinancialStatus,
      fulfillment_status: node.displayFulfillmentStatus,
      total_price: node.totalPriceSet.shopMoney.amount,
      currency: node.totalPriceSet.shopMoney.currencyCode,
      line_items: node.lineItems.edges.map(({ node: li }) => ({
        title: li.title,
        quantity: li.quantity,
        variant_title: li.variantTitle,
      })),
      fulfillments: node.fulfillments.map((f) => ({
        status: f.status,
        tracking_number: f.trackingInfo[0]?.number ?? null,
        tracking_url: f.trackingInfo[0]?.url ?? null,
        estimated_delivery_at: f.estimatedDeliveryAt,
      })),
    }));
  }

  async getOrderByName(orderName: string): Promise<ShopifyOrder | null> {
    const data = await this.query<{
      orders: {
        edges: {
          node: {
            id: string;
            name: string;
            createdAt: string;
            displayFinancialStatus: string;
            displayFulfillmentStatus: string;
            totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
            lineItems: {
              edges: {
                node: { title: string; quantity: number; variantTitle: string | null };
              }[];
            };
            fulfillments: {
              status: string;
              trackingInfo: { number: string | null; url: string | null }[];
              estimatedDeliveryAt: string | null;
            }[];
          };
        }[];
      };
    }>(
      `query($query: String!) {
        orders(first: 1, query: $query) {
          edges {
            node {
              id
              name
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus
              totalPriceSet { shopMoney { amount currencyCode } }
              lineItems(first: 10) {
                edges {
                  node { title quantity variantTitle }
                }
              }
              fulfillments {
                status
                trackingInfo { number url }
                estimatedDeliveryAt
              }
            }
          }
        }
      }`,
      { query: `name:${orderName}` }
    );

    const node = data.orders.edges[0]?.node;
    if (!node) return null;

    return {
      id: node.id,
      name: node.name,
      created_at: node.createdAt,
      financial_status: node.displayFinancialStatus,
      fulfillment_status: node.displayFulfillmentStatus,
      total_price: node.totalPriceSet.shopMoney.amount,
      currency: node.totalPriceSet.shopMoney.currencyCode,
      line_items: node.lineItems.edges.map(({ node: li }) => ({
        title: li.title,
        quantity: li.quantity,
        variant_title: li.variantTitle,
      })),
      fulfillments: node.fulfillments.map((f) => ({
        status: f.status,
        tracking_number: f.trackingInfo[0]?.number ?? null,
        tracking_url: f.trackingInfo[0]?.url ?? null,
        estimated_delivery_at: f.estimatedDeliveryAt,
      })),
    };
  }

  async getCustomerContext(
    email: string,
    orderIdentifier?: string | null
  ): Promise<ShopifyCustomerContext> {
    const [customer, recentOrders] = await Promise.all([
      this.lookupCustomerByEmail(email),
      this.getRecentOrders(email),
    ]);

    // If a specific order was referenced, fetch it too (if not already in recent orders)
    let specificOrder: ShopifyOrder | null = null;
    if (orderIdentifier) {
      const alreadyFetched = recentOrders.find(
        (o) => o.name === orderIdentifier
      );
      if (!alreadyFetched) {
        specificOrder = await this.getOrderByName(orderIdentifier);
      }
    }

    // TODO: Shopify returns API does not yet support filtering by customer email in GraphQL.
    // Active returns would require iterating orders. Leave empty for now.
    const activeReturns: ShopifyReturn[] = [];

    const allOrders = specificOrder
      ? [specificOrder, ...recentOrders.filter((o) => o.id !== specificOrder!.id)]
      : recentOrders;

    return {
      customer,
      recent_orders: allOrders,
      active_returns: activeReturns,
    };
  }
}
