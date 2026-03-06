# ⚡ VoucherVault MCP Server

A two-tool MCP server for the OpenAI Apps SDK that embeds **interactive iframe widgets** directly inside ChatGPT conversations.

## Tools

| Tool | Description |
|------|-------------|
| `browse_vouchers` | Renders the product catalogue widget — 12 mock digital vouchers with name, original price, discount price, discount tag, competitor price, star rating, and sales count. Users can filter by category and select a product. |
| `initiate_payment` | Renders the secure payment widget for a chosen product — credit card entry, animated processing state, and voucher code reveal on success. |

## Widget Flow

```
User: "Show me some vouchers"
  → ChatGPT calls browse_vouchers
  → iframe: product grid with filters (streaming, gaming, shopping, food, travel)
  → User clicks "Buy Now" on a product

User confirms selection
  → ChatGPT calls initiate_payment(productId=4)
  → iframe: payment form (CC entry → processing → voucher code reveal)
```

## Project Structure

```
voucher_store_mcp/
├── package.json
├── README.md
└── src/
    ├── index.js            ← MCP server (Node.js / ESM)
    ├── product-browse.html ← Browse widget iframe
    └── payment.html        ← Payment widget iframe
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start the server

```bash
npm start
```

The server starts on `http://localhost:8000`.

### 3. Expose via ngrok (for ChatGPT)

```bash
ngrok http 8000
```

Note the public URL, e.g. `https://abc123.ngrok-free.app`.

**Important** — set allowed hosts before starting (MCP SDK DNS protection):

```bash
export MCP_ALLOWED_HOSTS="abc123.ngrok-free.app"
export MCP_ALLOWED_ORIGINS="https://abc123.ngrok-free.app"
npm start
```

### 4. Add to ChatGPT

1. Enable [Developer Mode](https://platform.openai.com/docs/guides/developer-mode) in ChatGPT
2. Go to **Settings → Connectors → Add connector**
3. Enter: `https://abc123.ngrok-free.app/mcp`
4. Save and start a new conversation

### 5. Invoke in ChatGPT

Try prompts like:
- *"Show me some vouchers"*
- *"What gaming vouchers do you have?"*
- *"I want to buy the Steam Wallet RM50"*

## Widget Details

### product-browse.html

| Field | Description |
|-------|-------------|
| Name | Product display name |
| Original Price | Full MYR price |
| Discount Price | Sale price |
| Discount Tag | e.g. "30% OFF" |
| Competitor Price | Reference price from market |
| Rating | Star rating (4.2–4.9) |
| Amount Sold | Units sold to date |

Category filters: All · Streaming · Gaming · Shopping · Food & Dining · Travel

### payment.html

- Three payment method tabs: Credit Card · FPX · e-Wallet
- Live card preview (updates as user types)
- Card number, expiry, CVV, email fields
- Mock 2.8-second processing animation
- Voucher code reveal with copy button
- Purchase details summary (amount paid, savings, order ID)
- How-to-redeem instructions per product

## postMessage Events

Both widgets emit `window.parent.postMessage` events for the parent frame:

| Event `type` | Payload | Description |
|---|---|---|
| `VOUCHER_PURCHASE_INTENT` | `{ product }` | User clicked "Proceed to Pay" |
| `VOUCHER_PURCHASED` | `{ orderId, voucherCode, product, amountPaid }` | Payment confirmed |
| `PAYMENT_CANCELLED` | – | User hit Back |
| `RESTART_SHOPPING` | – | User clicked "Buy Another Voucher" |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | Server port |
| `BASE_URL` | `http://localhost:8000` | Public base URL (set to ngrok URL in production) |

## Tech Stack

- **Node.js** (ESM)
- **@modelcontextprotocol/sdk** – MCP server + SSE transport
- **express** – HTTP server
- **cors** – CORS headers for widget serving
- Vanilla HTML/CSS/JS widgets (zero build step)

## Customisation

All product data is in the `PRODUCTS` array at the top of `src/index.js` (and mirrored in each HTML file for the iframe's standalone operation). Replace these with real API calls to your product catalogue for production use.
