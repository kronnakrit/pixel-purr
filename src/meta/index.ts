// STUB — replaced by the meta module. Keep the exported names and types.
import type { EconomyConfig, MetaApi, ProductContents, ProductId } from '../app/contracts';

export declare const DEFAULT_ECONOMY: EconomyConfig;
export declare const PRODUCTS: Record<ProductId, ProductContents>;
/** Load the saved profile (or a fresh one) and return the live meta state. */
export async function loadMeta(_now: number, _economy?: Partial<EconomyConfig>): Promise<MetaApi> { throw new Error('meta: not implemented'); }
