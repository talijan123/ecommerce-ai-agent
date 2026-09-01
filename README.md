# 🛍️ Production-Grade Autonomous E-Commerce AI Agent (FastAPI + Meta WhatsApp Cloud API + Next.js)

A production-ready multi-channel AI platform for **Autonomous E-Commerce Customer Service** powered by **FastAPI**, **SQLAlchemy** (PostgreSQL / Supabase / SQLite), **Meta WhatsApp Cloud API**, **Groq / OpenAI Tool Calling**, and a **Next.js Merchant Dashboard**.

---

## 🏗️ Multi-Channel System Architecture

```
  ┌───────────────────────────────┐                  ┌───────────────────────────────┐
  │   Frontend Web Chat Widget    │                  │      WhatsApp Customer        │
  │     (Next.js Storefront)      │                  │     (Meta WhatsApp API)       │
  └───────────────┬───────────────┘                  └───────────────┬───────────────┘
                  │                                                  │
                  ▼                                                  ▼
     `POST /api/v1/chat`                           `POST /api/v1/webhooks/whatsapp`
                  │                                                  │
                  └───────────────────────┬──────────────────────────┘
                                          │
                                          ▼
                        ┌──────────────────────────────────┐
                        │        FastAPI Web Server        │
                        │ (BackgroundTasks & Handshake)    │
                        └─────────────────┬────────────────┘
                                          │
                        ┌─────────────────┴────────────────┐
                        ▼                                  ▼
         ┌──────────────────────────────┐   ┌──────────────────────────────┐
         │     `ChatService`            │   │   Groq / OpenAI LLM          │
         │ (Stores session `wa_<phone>` │   │ (Evaluates dynamic tools &   │
         │   or `sess_<uuid>` in DB)    │   │       schemas)               │
         └──────────────┬───────────────┘   └──────────────┬───────────────┘
                        │                                  │
                        │         ┌────────────────────────┴────────────────────────┐
                        │         ▼                                                 ▼
                        │  ┌─────────────────────────────┐           ┌─────────────────────────────┐
                        │  │      `OrderService`         │           │    `InventoryService`       │
                        │  │  (DB status, tracking URL,  │           │  (Fuzzy catalog search,     │
                        │  │     carrier, items)         │           │  out-of-stock alternatives) │
                        │  └──────────────┬──────────────┘           └──────────────┬──────────────┘
                        │                 │                                         │
                        │                 └────────────────────┬────────────────────┘
                        │                                      │
                        │                                      ▼
                        │                        ┌─────────────────────────────┐
                        │                        │       `CartService`         │
                        │                        │ (Abandoned cart recovery &  │
                        │                        │       discount codes)       │
                        │                        └──────────────┬──────────────┘
                        │                                       │
                        │                                       ▼
                        │                        ┌─────────────────────────────┐
                        │                        │  PostgreSQL / Supabase /    │
                        │                        │     SQLite Database         │
                        │                        └──────────────┬──────────────┘
                        │                                       │
                        └───────────────────────┬───────────────┘
                                                │
                        ┌───────────────────────┴────────────────────────┐
                        ▼                                                ▼
         ┌──────────────────────────────┐                 ┌──────────────────────────────┐
         │  HTTP 200 Chat Widget Reply  │                 │    Meta Graph API Dispatch   │
         │   (Frontend UI Rendering)    │                 │   (Customer's WhatsApp Phone)│
         └──────────────────────────────┘                 └──────────────────────────────┘
```

---

## 📱 Meta WhatsApp Cloud API Setup

### 1. Configure Environment Variables in `.env`
```ini
# Meta Developers Portal (https://developers.facebook.com)
WHATSAPP_TOKEN=EAAB...your_system_user_access_token_here
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=autocommerce_wa_verify_token_123
WHATSAPP_API_VERSION=v21.0
```

### 2. Configure Webhook in Meta Developers Portal
1. Go to **WhatsApp > Configuration > Webhook**.
2. Set **Callback URL**: `https://your-domain.com/api/v1/webhooks/whatsapp` (or your ngrok URL for local testing).
3. Set **Verify Token**: `autocommerce_wa_verify_token_123` (matches `WHATSAPP_VERIFY_TOKEN`).
4. Subscribe to the **`messages`** webhook field.

---

## 🚀 How to Run Backend & Frontend

### 1. Start the FastAPI Backend:
```bash
uvicorn app.main:app --reload --port 8000
```
- 📖 **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- 🩺 **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

### 2. Start the Next.js Frontend:
```bash
cd frontend
npm run dev
```
- 🛍️ **Customer Storefront**: [http://localhost:3000](http://localhost:3000)
- 📊 **Merchant Admin Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- 💬 **Live AI Chat Logs**: [http://localhost:3000/dashboard/conversations](http://localhost:3000/dashboard/conversations)

---

## 🧪 Testing

### Run WhatsApp Integration Tests:
```bash
python test_whatsapp.py
```
Validates:
- Meta verification handshake challenge (`GET /api/v1/webhooks/whatsapp`)
- Inbound customer WhatsApp message parsing & background agent execution (`POST /api/v1/webhooks/whatsapp`)
- Session persistence (`wa_<phone_number>`) in database
- Delivery status receipt handling

### Run Full Backend Integration Suite:
```bash
python test_api.py
```
