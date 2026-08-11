# Plantillas de WhatsApp a enviar a Meta

Copiar y pegar tal cual en **Meta Business → WhatsApp Manager → Plantillas de mensajes**.

## Por qué sólo hacen falta estas dos

Fuera de la ventana de 24 h desde el último mensaje del cliente, WhatsApp sólo
deja enviar plantillas aprobadas. Pero **en cuanto el cliente responde, la
ventana se abre** y todo lo que sigue viaja como texto libre.

Por eso el flujo de reviews de 3 pasos necesita **una sola plantilla**: la del
disparo inicial. La pregunta por la puntuación, la del comentario y la de la
foto salen todas dentro de la ventana, sin aprobación de Meta y sin costo de
plantilla.

---

## 1. `review_request` — disparo inicial

- **Categoría:** MARKETING ⚠️ (requiere opt-in previo del cliente)
- **Idioma:** Español (ARG) — `es_AR`
- **Nombre exacto:** `review_request`

**Cuerpo:**

```
Hola {{1}}! 👋 Te escribimos de Tubular.

Hace unos días recibiste tu {{2}}. ¿Nos contás qué te pareció? Son 30 segundos y nos ayuda muchísimo.

Respondé este mensaje y arrancamos 💙
```

**Variables:**

| Variable | Contenido | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre del cliente | `Martín` |
| `{{2}}` | Producto o descripción del pedido | `mesa de luz` |

**Ejemplos para el formulario de Meta** (los pide para aprobar):
`Martín` / `mesa de luz`

> **Nota:** Meta rechaza plantillas de MARKETING que suenen a spam o que no
> dejen claro quién escribe. Por eso el mensaje nombra a Tubular en la primera
> línea y hace referencia a una compra concreta.

---

## 2. `abandoned_cart` — carrito abandonado

- **Categoría:** MARKETING ⚠️ (requiere opt-in previo)
- **Idioma:** `es_AR`
- **Nombre exacto:** `abandoned_cart`

**Cuerpo:**

```
Hola {{1}}! 👋

Vimos que dejaste {{2}} en el carrito. ¿Te quedó alguna duda? Respondé por acá y te ayudamos.

Si querés terminar la compra: {{3}}
```

**Variables:**

| Variable | Contenido | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre | `Martín` |
| `{{2}}` | Producto | `una mesa de luz` |
| `{{3}}` | Link de recuperación | `tubular.com.ar/carrito` |

---

## Requisitos antes de mandarlas

1. **Número verificado** en la cuenta de WhatsApp Business.
2. **Nombre para mostrar aprobado** — Meta lo revisa aparte de las plantillas y
   suele tardar más.
3. **Opt-in registrado.** Las dos plantillas son MARKETING: sólo se le pueden
   mandar a clientes que dieron consentimiento explícito para recibir WhatsApp.
   El sistema lo respeta: la columna `wa_contacts.opt_in` tiene que estar en
   `true` y `opt_out_at` en null, si no el envío se saltea con
   `skip_reason='no_opt_in'`.

## Cómo conseguir el opt-in

La forma más limpia y la que menos fricción tiene: un checkbox en el checkout de
WooCommerce del estilo *"Quiero recibir novedades y el estado de mi pedido por
WhatsApp"*. Eso graba `opt_in=true` con `opt_in_source='checkout'`.

Para los clientes que ya compraron y nunca dieron consentimiento **no hay atajo
legal**: o se les pide por otro canal donde ya haya consentimiento (mail), o no
entran en las automatizaciones.

## Después de que Meta apruebe

Cargar el nombre exacto en el manager (Settings → Reviews) o directo en la base:

```sql
UPDATE settings SET reviews_template_name = 'review_request',
                    reviews_template_language = 'es_AR',
                    reviews_enabled = true
WHERE id = 1;
```
