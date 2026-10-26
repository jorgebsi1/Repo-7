CREATE TABLE "repartidor_turno" (
	"repartidor_id" uuid PRIMARY KEY NOT NULL,
	"ubicacion_id" uuid NOT NULL,
	"en_turno" boolean DEFAULT false NOT NULL,
	"desde" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repartidor_turno" ADD CONSTRAINT "repartidor_turno_repartidor_id_cliente_id_fk" FOREIGN KEY ("repartidor_id") REFERENCES "public"."cliente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repartidor_turno" ADD CONSTRAINT "repartidor_turno_ubicacion_id_ubicacion_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicacion"("id") ON DELETE no action ON UPDATE no action;