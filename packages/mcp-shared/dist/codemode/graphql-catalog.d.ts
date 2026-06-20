import type { CatalogGeneratorResult, GraphQlToCatalogOptions } from "./catalog-generator";
/**
 * Convert a GraphQL introspection result to an ApiCatalog.
 * Each query becomes a virtual GET endpoint, each mutation a POST endpoint.
 * Arguments are mapped to queryParams for discoverability.
 */
export declare function graphQlToCatalog(introspection: unknown, options: GraphQlToCatalogOptions): CatalogGeneratorResult;
//# sourceMappingURL=graphql-catalog.d.ts.map