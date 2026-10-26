-- Reparto por radio: la zona deja de ser un polígono y pasa a ser un radio por tienda (ubicacion).
-- Orden corregido a mano: primero se quita la referencia desde pedido y después se elimina zona_reparto.
ALTER TABLE "pedido" DROP CONSTRAINT "pedido_zona_id_zona_reparto_id_fk";
--> statement-breakpoint
ALTER TABLE "pedido" DROP COLUMN "zona_id";--> statement-breakpoint
DROP TABLE "zona_reparto" CASCADE;--> statement-breakpoint
ALTER TABLE "entrega" ADD COLUMN "fuera_de_frio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ubicacion" ADD COLUMN "radio_entrega_km" double precision DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "ubicacion" ADD COLUMN "tarifa_entrega_cents" integer DEFAULT 600 NOT NULL;--> statement-breakpoint
ALTER TABLE "ubicacion" ADD COLUMN "pedido_minimo_entrega_cents" integer DEFAULT 2500 NOT NULL;--> statement-breakpoint
ALTER TABLE "ubicacion" ADD COLUMN "envio_gratis_desde_cents" integer;
