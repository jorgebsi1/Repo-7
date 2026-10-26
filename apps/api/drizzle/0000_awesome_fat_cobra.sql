CREATE TYPE "public"."estado_linea" AS ENUM('PENDIENTE', 'LISTA', 'FALTANTE');--> statement-breakpoint
CREATE TYPE "public"."estado_pago" AS ENUM('AUTORIZADO', 'CAPTURADO', 'ANULADO', 'REEMBOLSADO', 'RECHAZADO');--> statement-breakpoint
CREATE TYPE "public"."estado_pedido" AS ENUM('CREADO', 'PAGO_PENDIENTE', 'PAGO_FALLIDO', 'CONFIRMADO', 'ALISTANDO', 'FALTANTE', 'EMPACADO', 'LISTO_RECOJO', 'EN_CAMINO', 'ENTREGADO', 'NO_RECOGIDO', 'FALLIDO_ENTREGA', 'CANCELADO', 'REEMBOLSADO');--> statement-breakpoint
CREATE TYPE "public"."modalidad" AS ENUM('PACK', 'PESO');--> statement-breakpoint
CREATE TYPE "public"."modo_entrega" AS ENUM('RECOJO', 'ENTREGA');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('cliente', 'tienda', 'repartidor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."ubicacion_tipo" AS ENUM('PLANTA', 'TIENDA');--> statement-breakpoint
CREATE TABLE "carrito" (
	"cliente_id" uuid PRIMARY KEY NOT NULL,
	"ubicacion_id" uuid,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categoria_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cliente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text NOT NULL,
	"email" text,
	"rol" "rol" DEFAULT 'cliente' NOT NULL,
	"ubicacion_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cliente_telefono_unique" UNIQUE("telefono")
);
--> statement-breakpoint
CREATE TABLE "direccion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"etiqueta" text DEFAULT 'Casa' NOT NULL,
	"linea" text NOT NULL,
	"referencia" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disponibilidad_tienda" (
	"ubicacion_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"disponible" boolean DEFAULT true NOT NULL,
	"cantidad" numeric,
	"stock_seguridad_online" numeric DEFAULT 0 NOT NULL,
	CONSTRAINT "disponibilidad_tienda_ubicacion_id_sku_id_pk" PRIMARY KEY("ubicacion_id","sku_id")
);
--> statement-breakpoint
CREATE TABLE "entrega" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"repartidor_id" uuid,
	"despachado_en" timestamp with time zone,
	"entregado_en" timestamp with time zone,
	"limite_frio_en" timestamp with time zone,
	CONSTRAINT "entrega_pedido_id_unique" UNIQUE("pedido_id")
);
--> statement-breakpoint
CREATE TABLE "evento_pedido" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "evento_pedido_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"pedido_id" uuid NOT NULL,
	"evento" text NOT NULL,
	"de" "estado_pedido",
	"a" "estado_pedido",
	"actor" text NOT NULL,
	"actor_id" uuid,
	"detalle" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linea_pedido" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"presentacion" text NOT NULL,
	"modalidad" "modalidad" NOT NULL,
	"cantidad" integer,
	"gramos_solicitados" integer,
	"gramos_finales" integer,
	"precio_cents" integer,
	"precio_kg_cents" integer,
	"estimado_cents" integer NOT NULL,
	"autorizado_cents" integer NOT NULL,
	"final_cents" integer,
	"estado" "estado_linea" DEFAULT 'PENDIENTE' NOT NULL,
	"lote_id" uuid,
	"vence_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ubicacion_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"codigo_lote" text NOT NULL,
	"elaborado_en" timestamp with time zone NOT NULL,
	"vence_en" timestamp with time zone NOT NULL,
	"cantidad_inicial" numeric NOT NULL,
	"cantidad_disponible" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"proveedor" text NOT NULL,
	"referencia" text NOT NULL,
	"estado" "estado_pago" NOT NULL,
	"autorizado_cents" integer NOT NULL,
	"capturado_cents" integer DEFAULT 0 NOT NULL,
	"reembolsado_cents" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedido" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" bigserial NOT NULL,
	"cliente_id" uuid NOT NULL,
	"ubicacion_id" uuid NOT NULL,
	"modo" "modo_entrega" NOT NULL,
	"estado" "estado_pedido" DEFAULT 'CREADO' NOT NULL,
	"direccion_snapshot" jsonb,
	"zona_id" uuid,
	"franja_inicio" timestamp with time zone,
	"franja_fin" timestamp with time zone,
	"subtotal_estimado_cents" integer NOT NULL,
	"tarifa_entrega_cents" integer DEFAULT 0 NOT NULL,
	"descuento_cents" integer DEFAULT 0 NOT NULL,
	"propina_cents" integer DEFAULT 0 NOT NULL,
	"total_estimado_cents" integer NOT NULL,
	"total_autorizado_cents" integer NOT NULL,
	"total_final_cents" integer,
	"notas" text,
	"idempotency_key" text NOT NULL,
	"empacado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"categoria_id" uuid NOT NULL,
	"registro_sanitario" text,
	"etiquetado" jsonb,
	"vida_util_dias" integer,
	"temp_min_c" double precision DEFAULT 2,
	"temp_max_c" double precision DEFAULT 4,
	"imagen_url" text,
	"activo" boolean DEFAULT true NOT NULL,
	"es_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "producto_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "reserva_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"linea_id" uuid,
	"ubicacion_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"lote_id" uuid,
	"cantidad" numeric NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"confirmada" boolean DEFAULT false NOT NULL,
	"liberada" boolean DEFAULT false NOT NULL,
	"consumida" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sku" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"codigo_barras" text,
	"presentacion" text NOT NULL,
	"modalidad" "modalidad" NOT NULL,
	"gramos" integer,
	"precio_cents" integer,
	"precio_kg_cents" integer,
	"paso_gramos" integer,
	"min_gramos" integer,
	"max_gramos" integer,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "sku_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "sku_precio_segun_modalidad" CHECK (("sku"."modalidad" = 'PACK' AND "sku"."precio_cents" IS NOT NULL) OR ("sku"."modalidad" = 'PESO' AND "sku"."precio_kg_cents" IS NOT NULL AND "sku"."paso_gramos" IS NOT NULL AND "sku"."min_gramos" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "ubicacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "ubicacion_tipo" NOT NULL,
	"ciudad" text NOT NULL,
	"direccion" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"activo" boolean DEFAULT true NOT NULL,
	"acepta_online" boolean DEFAULT false NOT NULL,
	"horario" jsonb,
	"es_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ubicacion_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "zona_reparto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ubicacion_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"poligono" jsonb NOT NULL,
	"tarifa_cents" integer NOT NULL,
	"pedido_minimo_cents" integer DEFAULT 0 NOT NULL,
	"envio_gratis_desde_cents" integer
);
--> statement-breakpoint
ALTER TABLE "carrito" ADD CONSTRAINT "carrito_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrito" ADD CONSTRAINT "carrito_ubicacion_id_ubicacion_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_ubicacion_id_ubicacion_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direccion" ADD CONSTRAINT "direccion_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disponibilidad_tienda" ADD CONSTRAINT "disponibilidad_tienda_ubicacion_id_ubicacion_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disponibilidad_tienda" ADD CONSTRAINT "disponibilidad_tienda_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_pedido_id_pedido_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_repartidor_id_cliente_id_fk" FOREIGN KEY ("repartidor_id") REFERENCES "public"."cliente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_pedido" ADD CONSTRAINT "evento_pedido_pedido_id_pedido_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linea_pedido" ADD CONSTRAINT "linea_pedido_pedido_id_pedido_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linea_pedido" ADD CONSTRAINT "linea_pedido_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linea_pedido" ADD CONSTRAINT "linea_pedido_lote_id_lote_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lote"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lote" ADD CONSTRAINT "lote_ubicacion_id_ubicacion_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lote" ADD CONSTRAINT "lote_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_pedido_id_pedido_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_ubicacion_id_ubicacion_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_zona_id_zona_reparto_id_fk" FOREIGN KEY ("zona_id") REFERENCES "public"."zona_reparto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoria_id_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_stock" ADD CONSTRAINT "reserva_stock_pedido_id_pedido_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_stock" ADD CONSTRAINT "reserva_stock_linea_id_linea_pedido_id_fk" FOREIGN KEY ("linea_id") REFERENCES "public"."linea_pedido"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_stock" ADD CONSTRAINT "reserva_stock_ubicacion_id_ubicacion_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_stock" ADD CONSTRAINT "reserva_stock_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_stock" ADD CONSTRAINT "reserva_stock_lote_id_lote_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lote"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku" ADD CONSTRAINT "sku_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zona_reparto" ADD CONSTRAINT "zona_reparto_ubicacion_id_ubicacion_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evento_pedido_idx" ON "evento_pedido" USING btree ("pedido_id","id");--> statement-breakpoint
CREATE INDEX "linea_pedido_idx" ON "linea_pedido" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "lote_ubicacion_sku_idx" ON "lote" USING btree ("ubicacion_id","sku_id","vence_en");--> statement-breakpoint
CREATE UNIQUE INDEX "pedido_idem_idx" ON "pedido" USING btree ("cliente_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "pedido_estado_idx" ON "pedido" USING btree ("ubicacion_id","estado","creado_en");--> statement-breakpoint
CREATE INDEX "pedido_cliente_idx" ON "pedido" USING btree ("cliente_id","creado_en");--> statement-breakpoint
CREATE INDEX "reserva_sku_idx" ON "reserva_stock" USING btree ("ubicacion_id","sku_id");--> statement-breakpoint
CREATE INDEX "reserva_pedido_idx" ON "reserva_stock" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "sku_producto_idx" ON "sku" USING btree ("producto_id");