# 3. Modelo de datos y diagrama ER

## 3.1 Convenciones
- **Montos:** `bigint` en céntimos. `amount` siempre positivo; el signo lo da `type`.
- **IDs:** `uuid` generados en el cliente (captura offline sin colisiones).
- **Sincronización:** `created_at`, `updated_at` (LWW), `deleted_at` (baja lógica).
- **Saldos:** **derivados** (`initial_balance` + movimientos). Nunca se guardan. Vista `account_balances`.
- **Tarjetas de crédito:** saldo ≤ 0 representa deuda. Un consumo con tarjeta resta; el pago de tarjeta es una transferencia que suma.
- **Fechas:** `date` calendario local del usuario (sin zona), `timestamptz` para auditoría.

## 3.2 Diagrama ER

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : tiene
  AUTH_USERS ||--o{ ACCOUNTS : posee
  AUTH_USERS ||--o{ CATEGORIES : posee
  AUTH_USERS ||--o{ TRANSACTIONS : registra
  AUTH_USERS ||--o{ GOALS : define
  AUTH_USERS ||--o{ IMPORTS : sube

  ACCOUNTS ||--o{ TRANSACTIONS : "origen (account_id)"
  ACCOUNTS ||--o{ TRANSACTIONS : "destino (to_account_id)"
  CATEGORIES ||--o{ TRANSACTIONS : clasifica
  CATEGORIES ||--o| BUDGETS : limita
  CATEGORIES ||--o{ CATEGORY_RULES : aprende
  BUDGETS ||--o{ BUDGET_ALERTS : emite
  GOALS ||--o{ GOAL_CONTRIBUTIONS : recibe
  ACCOUNTS ||--o{ GOALS : "vinculada (opcional)"
  IMPORTS ||--o{ TRANSACTIONS : origina
  ACCOUNTS ||--o{ RECURRING_RULES : programa

  PROFILES {
    uuid user_id PK
    text display_name
    char currency
    text locale
  }
  ACCOUNTS {
    uuid id PK
    uuid user_id FK
    text name
    account_type type "checking|savings|credit_card|wallet|cash"
    bigint initial_balance
    char currency
    text color
    text icon
    bigint credit_limit
    bool archived
    int sort_order
    timestamptz updated_at
    timestamptz deleted_at
  }
  CATEGORIES {
    uuid id PK
    uuid user_id FK
    text key "estable p/ predeterminadas"
    text name
    category_kind kind "expense|income"
    text icon
    text color
    bool is_default
    bool archived
  }
  TRANSACTIONS {
    uuid id PK
    uuid user_id FK
    tx_type type "expense|income|transfer"
    bigint amount ">0"
    uuid account_id FK
    uuid to_account_id FK "solo transfer"
    transfer_kind transfer_kind "internal|card_payment|savings"
    uuid category_id FK "null en transfer"
    date date
    text merchant
    text note
    text_array tags
    tx_source source "manual|text|voice|import|ocr"
    uuid import_id
    text import_hash "deduplicación"
    text attachment_path "V2"
  }
  BUDGETS {
    uuid id PK
    uuid category_id FK
    bigint amount "mensual"
    int_array thresholds "50,80,100"
  }
  BUDGET_ALERTS {
    uuid id PK
    uuid budget_id FK
    char period "YYYY-MM"
    int threshold
  }
  GOALS {
    uuid id PK
    text name
    bigint target_amount
    date target_date
    uuid account_id FK
    text icon
    text color
  }
  GOAL_CONTRIBUTIONS {
    uuid id PK
    uuid goal_id FK
    bigint amount "negativo = retiro"
    date date
  }
  CATEGORY_RULES {
    uuid id PK
    text pattern "comercio normalizado"
    uuid category_id FK
    int hits
    text origin "user|system"
  }
  IMPORTS {
    uuid id PK
    text file_name
    text source
    int row_count
  }
  RECURRING_RULES {
    uuid id PK
    tx_type type
    bigint amount
    text rrule
    date next_date
    bool auto_post
  }
```

## 3.3 Reglas de negocio en la base
- `transfer_shape`: una transferencia tiene destino distinto del origen y no tiene categoría; un gasto/ingreso no tiene destino.
- `categories_user_key_uq`: una sola categoría predeterminada por `key` y usuario.
- `budget_alerts (budget_id, period, threshold)` único: cada aviso se emite una vez por mes.
- `on delete restrict` en cuentas referenciadas: una cuenta con historial se **archiva**, no se borra.

## 3.4 Fórmulas clave

```
saldo(cuenta) = initial_balance
              + Σ ingresos(cuenta) − Σ gastos(cuenta)
              − Σ transferencias salientes + Σ transferencias entrantes

activos       = Σ saldo(cuentas no-tarjeta)
deuda         = Σ max(0, −saldo(tarjetas))
patrimonio    = activos − deuda
apartado      = Σ max(0, Σ aportes(meta))      (metas activas)
disponible    = patrimonio − apartado

ahorro neto (mes)     = ingresos − gastos      (transferencias excluidas)
tasa de ahorro        = ahorro neto / ingresos
proyección del mes    = gasto a la fecha / día actual × días del mes
gasto diario sugerido = presupuesto restante / días restantes
aporte mensual meta   = (objetivo − ahorrado) / meses restantes
```
