/**
 * VoucherVault MCP Server (Node.js / ESM)
 *
 * Exposes two tools for the OpenAI Apps SDK / ChatGPT:
 *   1. browse_vouchers   – renders the product-browsing iframe widget
 *   2. initiate_payment  – renders the payment iframe widget for a selected product
 *
 * Run:
 *   npm install
 *   npm start
 *
 * Then expose via ngrok:
 *   ngrok http 8000
 *   → add https://<id>.ngrok-free.app/mcp to ChatGPT Settings > Connectors
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

// ─── Config ────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ─── Product catalogue (mock data) ─────────────────────────────────────────
const PRODUCTS = [
  { id: 1,  name: "Netflix Premium 1-Month",  category: "streaming", emoji: "🎬", oriPrice: 59.90, discountPrice: 42.00, discountTag: "30% OFF", competitorPrice: 55.00, rating: 4.8, amountSold: 12400 },
  { id: 2,  name: "Spotify Premium 3-Month",  category: "streaming", emoji: "🎵", oriPrice: 45.00, discountPrice: 33.00, discountTag: "27% OFF", competitorPrice: 42.00, rating: 4.7, amountSold: 9820 },
  { id: 3,  name: "Disney+ Hotstar Annual",   category: "streaming", emoji: "✨", oriPrice: 119.00, discountPrice: 79.00, discountTag: "34% OFF", competitorPrice: 99.00, rating: 4.5, amountSold: 7340 },
  { id: 4,  name: "Steam Wallet RM50",         category: "gaming",   emoji: "🎮", oriPrice: 50.00, discountPrice: 44.50, discountTag: "11% OFF", competitorPrice: 49.00, rating: 4.9, amountSold: 23100 },
  { id: 5,  name: "Razer Gold RM100",          category: "gaming",   emoji: "🟢", oriPrice: 100.00, discountPrice: 88.00, discountTag: "12% OFF", competitorPrice: 95.00, rating: 4.6, amountSold: 15620 },
  { id: 6,  name: "Garena Shells 1650",        category: "gaming",   emoji: "💎", oriPrice: 28.00, discountPrice: 21.90, discountTag: "22% OFF", competitorPrice: 26.00, rating: 4.7, amountSold: 31800 },
  { id: 7,  name: "Lazada RM30 Voucher",       category: "shopping", emoji: "🛍️", oriPrice: 30.00, discountPrice: 24.00, discountTag: "20% OFF", competitorPrice: 29.00, rating: 4.4, amountSold: 18900 },
  { id: 8,  name: "Shopee RM50 Voucher",       category: "shopping", emoji: "🧧", oriPrice: 50.00, discountPrice: 41.00, discountTag: "18% OFF", competitorPrice: 47.50, rating: 4.5, amountSold: 22400 },
  { id: 9,  name: "GrabFood RM20 Credit",      category: "food",     emoji: "🍜", oriPrice: 20.00, discountPrice: 15.50, discountTag: "22% OFF", competitorPrice: 19.00, rating: 4.6, amountSold: 14700 },
  { id: 10, name: "Foodpanda RM15 Credit",     category: "food",     emoji: "🐼", oriPrice: 15.00, discountPrice: 11.80, discountTag: "21% OFF", competitorPrice: 14.00, rating: 4.3, amountSold: 9200 },
  { id: 11, name: "AirAsia BIG Points 2000",   category: "travel",   emoji: "✈️", oriPrice: 40.00, discountPrice: 29.90, discountTag: "25% OFF", competitorPrice: 37.00, rating: 4.2, amountSold: 5600 },
  { id: 12, name: "Agoda Credits USD10",       category: "travel",   emoji: "🏨", oriPrice: 47.00, discountPrice: 37.00, discountTag: "21% OFF", competitorPrice: 44.00, rating: 4.4, amountSold: 4120 },
];

// ─── MCP Server setup ───────────────────────────────────────────────────────
const mcpServer = new McpServer({
  name: "VoucherVault",
  version: "1.0.0",
});

// ── Tool 1: Browse Vouchers ─────────────────────────────────────────────────
mcpServer.tool(
  "browse_vouchers",
  "Display the VoucherVault digital voucher store. Shows a grid of discount vouchers with names, original prices, discount prices, discount tags, competitor prices, star ratings and sales counts. The user can browse, filter by category, select a voucher and click 'Proceed to Pay'.",
  {
    category: z
      .enum(["all", "streaming", "gaming", "shopping", "food", "travel"])
      .optional()
      .describe("Pre-filter the vouchers by category. Defaults to 'all'."),
  },
  async ({ category = "all" }) => {
    const widgetUrl = `${BASE_URL}/widgets/product-browse.html?category=${category}`;

    // Structured JSON summary for the model to reason about
    const filteredProducts =
      category === "all"
        ? PRODUCTS
        : PRODUCTS.filter((p) => p.category === category);

    const summary = filteredProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      originalPrice: `RM ${p.oriPrice.toFixed(2)}`,
      discountPrice: `RM ${p.discountPrice.toFixed(2)}`,
      discountTag: p.discountTag,
      competitorPrice: `RM ${p.competitorPrice.toFixed(2)}`,
      rating: p.rating,
      amountSold: p.amountSold,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            message: `Showing ${filteredProducts.length} voucher(s) in category: ${category}`,
            products: summary,
          }),
        },
      ],
      // Apps SDK widget metadata
      _meta: {
        "openai/outputTemplate": {
          type: "iframe",
          iframeUrl: widgetUrl,
          height: 600,
          title: "🛍️ VoucherVault – Browse Vouchers",
        },
      },
    };
  }
);

// ── Tool 2: Initiate Payment ────────────────────────────────────────────────
mcpServer.tool(
  "initiate_payment",
  "Open the secure payment widget for a selected digital voucher. The user can enter credit card details, confirm the purchase, and receive the voucher code — all inside the iframe. Call this after the user selects a product from browse_vouchers.",
  {
    productId: z
      .number()
      .int()
      .min(1)
      .max(12)
      .describe("The numeric product ID selected by the user from browse_vouchers."),
    productName: z
      .string()
      .optional()
      .describe("Human-readable product name (for display in the tool response)."),
    price: z
      .number()
      .optional()
      .describe("Discounted price of the product in MYR (for display)."),
  },
  async ({ productId, productName, price }) => {
    const product = PRODUCTS.find((p) => p.id === productId);
    const resolvedProduct = product || { name: productName || "Selected Voucher", discountPrice: price || 0 };
    const widgetUrl = `${BASE_URL}/widgets/payment.html?productId=${productId}`;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            message: `Payment widget opened for: ${resolvedProduct.name}`,
            productId,
            productName: resolvedProduct.name,
            amountDue: `RM ${resolvedProduct.discountPrice.toFixed(2)}`,
            instructions:
              "The secure payment form is displayed in the widget below. The user can enter their card details and complete the purchase. A voucher code will be revealed upon successful payment.",
          }),
        },
      ],
      _meta: {
        "openai/outputTemplate": {
          type: "iframe",
          iframeUrl: widgetUrl,
          height: 700,
          title: `💳 Secure Payment – ${resolvedProduct.name}`,
        },
      },
    };
  }
);

// ─── Express app ────────────────────────────────────────────────────────────
const app = express();
app.use(cors());

// Serve widget HTML files
app.use("/widgets", express.static(path.join(__dirname, "../src")));

// Health check
app.get("/", (_req, res) => {
  res.json({
    name: "VoucherVault MCP Server",
    version: "1.0.0",
    status: "running",
    tools: ["browse_vouchers", "initiate_payment"],
    widgetsBase: `${BASE_URL}/widgets/`,
  });
});

// MCP SSE endpoint (Apps SDK uses SSE or streamable-http)
const transports = new Map();

app.get("/mcp", async (req, res) => {
  const transport = new SSEServerTransport("/mcp/messages", res);
  transports.set(transport.sessionId, transport);

  res.on("close", () => {
    transports.delete(transport.sessionId);
  });

  await mcpServer.connect(transport);
});

app.post("/mcp/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n⚡ VoucherVault MCP Server running`);
  console.log(`   Local:  http://localhost:${PORT}`);
  console.log(`   MCP:    http://localhost:${PORT}/mcp`);
  console.log(`\n   To expose via ngrok:`);
  console.log(`   ngrok http ${PORT}`);
  console.log(`   → add https://<id>.ngrok-free.app/mcp to ChatGPT Settings > Connectors\n`);
});
