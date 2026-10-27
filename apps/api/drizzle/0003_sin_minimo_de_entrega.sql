ALTER TABLE "pedido" ADD COLUMN "entrega_estimada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entrega" DROP COLUMN "fuera_de_frio";--> statement-breakpoint
ALTER TABLE "ubicacion" DROP COLUMN "pedido_minimo_entrega_cents";