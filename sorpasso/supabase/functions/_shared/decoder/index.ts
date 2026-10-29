/** Registro dei provider di decodifica. Aggiungere qui i nuovi provider. */
import type { VehicleDecoder } from "./tipi.ts";
import { vinBase } from "./vinBase.ts";
import { httpGenerico } from "./http.ts";

export const PROVIDER: VehicleDecoder[] = [vinBase, httpGenerico];

export const trovaProvider = (id: string | null | undefined) => PROVIDER.find((p) => p.id === id) ?? null;

export type { DatiDecodificati, RichiestaDecodifica, VehicleDecoder } from "./tipi.ts";
