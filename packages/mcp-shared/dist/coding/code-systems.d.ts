/**
 * Registry of canonical CodeSystem URIs used in biomedical data.
 *
 * These URI strings are HL7-published terminology identifiers and are not
 * themselves licensable — only the underlying code dictionaries carry license
 * obligations. See `NOTICE.md` at the package root for attribution rules
 * around bundled dictionaries.
 *
 * Pattern derived from shc-web-reader/src/lib/codes.js:19-106 (MIT © 2023
 * The Commons Project), expanded with biomedical-specific systems used across
 * our MCP server fleet (gene/variant/drug ontologies in addition to FHIR
 * clinical systems).
 */
/** Top-level controlled-vocabulary system descriptor. */
export interface CodeSystemDescriptor {
    /** Canonical URI as published by the issuing organization. */
    uri: string;
    /** Short human-readable identifier (e.g., "loinc", "snomed"). */
    id: string;
    /** Long-form name. */
    name: string;
    /** Short description for UI / docs. */
    description?: string;
    /** Original specification or browse URL. */
    homepage?: string;
    /** Free-text license summary. */
    license?: string;
    /** Where dictionaries can be downloaded if the source is freely available. */
    dictUrl?: string;
}
/**
 * Canonical clinical-terminology systems (FHIR-published URIs).
 */
export declare const CLINICAL_SYSTEMS: {
    readonly loinc: {
        readonly uri: "http://loinc.org";
        readonly id: "loinc";
        readonly name: "Logical Observation Identifiers Names and Codes";
        readonly description: "Lab tests, vitals, and clinical observations";
        readonly homepage: "https://loinc.org";
        readonly license: "Free under LOINC license — attribution required";
    };
    readonly snomed: {
        readonly uri: "http://snomed.info/sct";
        readonly id: "snomed";
        readonly name: "SNOMED CT";
        readonly description: "Clinical terminology for diagnoses, findings, procedures";
        readonly homepage: "https://www.snomed.org";
        readonly license: "Affiliate license required; Global Patient Set available CC-BY 4.0";
    };
    readonly icd10cm: {
        readonly uri: "http://hl7.org/fhir/sid/icd-10-cm";
        readonly id: "icd10cm";
        readonly name: "ICD-10-CM";
        readonly description: "International Classification of Diseases, Clinical Modification (US)";
        readonly homepage: "https://www.cdc.gov/nchs/icd/icd10cm.htm";
        readonly license: "Public domain (US Government)";
    };
    readonly icd10: {
        readonly uri: "http://hl7.org/fhir/sid/icd-10";
        readonly id: "icd10";
        readonly name: "ICD-10";
        readonly description: "WHO International Classification of Diseases";
        readonly homepage: "https://www.who.int/classifications/icd";
        readonly license: "WHO terms; non-commercial use generally permitted";
    };
    readonly icd11: {
        readonly uri: "http://id.who.int/icd/release/11/mms";
        readonly id: "icd11";
        readonly name: "ICD-11";
        readonly description: "WHO International Classification of Diseases, 11th revision";
        readonly homepage: "https://icd.who.int/en";
        readonly license: "WHO terms; CC BY-ND 3.0 IGO";
    };
    readonly rxnorm: {
        readonly uri: "http://www.nlm.nih.gov/research/umls/rxnorm";
        readonly id: "rxnorm";
        readonly name: "RxNorm";
        readonly description: "Clinical drug terminology from the US NLM";
        readonly homepage: "https://www.nlm.nih.gov/research/umls/rxnorm/";
        readonly license: "Public domain (US Government)";
    };
    readonly atc: {
        readonly uri: "http://www.whocc.no/atc";
        readonly id: "atc";
        readonly name: "WHO ATC";
        readonly description: "Anatomical Therapeutic Chemical Classification";
        readonly homepage: "https://www.whocc.no/atc_ddd_index/";
        readonly license: "WHO terms; non-commercial reuse permitted";
    };
    readonly cpt: {
        readonly uri: "http://www.ama-assn.org/go/cpt";
        readonly id: "cpt";
        readonly name: "CPT";
        readonly description: "Current Procedural Terminology (AMA)";
        readonly homepage: "https://www.ama-assn.org/practice-management/cpt";
        readonly license: "AMA — commercial license required for full code set";
    };
    readonly cvx: {
        readonly uri: "http://hl7.org/fhir/sid/cvx";
        readonly id: "cvx";
        readonly name: "CVX";
        readonly description: "Vaccine codes (CDC)";
        readonly homepage: "https://www.cdc.gov/vaccines/programs/iis/code-sets.html";
        readonly license: "Public domain (US Government)";
    };
    readonly ndc: {
        readonly uri: "http://hl7.org/fhir/sid/ndc";
        readonly id: "ndc";
        readonly name: "NDC";
        readonly description: "National Drug Code (FDA)";
        readonly homepage: "https://www.fda.gov/drugs/drug-approvals-and-databases/national-drug-code-directory";
        readonly license: "Public domain (US Government)";
    };
    readonly ucum: {
        readonly uri: "http://unitsofmeasure.org";
        readonly id: "ucum";
        readonly name: "UCUM";
        readonly description: "Unified Code for Units of Measure";
        readonly homepage: "https://ucum.org";
        readonly license: "Free under UCUM license";
    };
};
/**
 * FHIR terminology infrastructure systems (used inside Coding/CodeableConcept).
 */
export declare const FHIR_INFRA_SYSTEMS: {
    readonly conditionClinical: {
        readonly uri: "http://terminology.hl7.org/CodeSystem/condition-clinical";
        readonly id: "conditionClinical";
        readonly name: "FHIR Condition Clinical Status";
    };
    readonly conditionVer: {
        readonly uri: "http://terminology.hl7.org/CodeSystem/condition-ver-status";
        readonly id: "conditionVer";
        readonly name: "FHIR Condition Verification Status";
    };
    readonly allergyClinical: {
        readonly uri: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical";
        readonly id: "allergyClinical";
        readonly name: "FHIR AllergyIntolerance Clinical Status";
    };
    readonly allergyVer: {
        readonly uri: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification";
        readonly id: "allergyVer";
        readonly name: "FHIR AllergyIntolerance Verification Status";
    };
    readonly observationCategory: {
        readonly uri: "http://terminology.hl7.org/CodeSystem/observation-category";
        readonly id: "observationCategory";
        readonly name: "FHIR Observation Category";
    };
    readonly observationInterpretation: {
        readonly uri: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";
        readonly id: "observationInterpretation";
        readonly name: "v3 Observation Interpretation";
    };
    readonly coverageClass: {
        readonly uri: "http://terminology.hl7.org/CodeSystem/coverage-class";
        readonly id: "coverageClass";
        readonly name: "FHIR Coverage Class";
    };
    readonly coverageCopayType: {
        readonly uri: "http://terminology.hl7.org/CodeSystem/coverage-copay-type";
        readonly id: "coverageCopayType";
        readonly name: "FHIR Coverage Copay Type";
    };
    readonly contactEntityType: {
        readonly uri: "http://terminology.hl7.org/CodeSystem/contactentity-type";
        readonly id: "contactEntityType";
        readonly name: "FHIR Contact Entity Type";
    };
    readonly consentScope: {
        readonly uri: "http://terminology.hl7.org/CodeSystem/consentscope";
        readonly id: "consentScope";
        readonly name: "FHIR Consent Scope";
    };
    readonly consentPolicy: {
        readonly uri: "http://terminology.hl7.org/CodeSystem/consentpolicycodes";
        readonly id: "consentPolicy";
        readonly name: "FHIR Consent Policy";
    };
    readonly consentCategory: {
        readonly uri: "http://terminology.hl7.org/CodeSystem/consentcategorycodes";
        readonly id: "consentCategory";
        readonly name: "FHIR Consent Category";
    };
    readonly substanceAdminSubstitution: {
        readonly uri: "http://terminology.hl7.org/CodeSystem/v3-substanceAdminSubstitution";
        readonly id: "substanceAdminSubstitution";
        readonly name: "v3 Substance Admin Substitution";
    };
};
/**
 * Genetic and drug-discovery systems used by MCP servers like clinvar, gnomad,
 * civic, dgidb, opentargets, ensembl, hgnc, biothings.
 */
export declare const BIOMEDICAL_SYSTEMS: {
    readonly hgnc: {
        readonly uri: "http://www.genenames.org/geneId";
        readonly id: "hgnc";
        readonly name: "HGNC Gene Symbols";
        readonly homepage: "https://www.genenames.org";
        readonly license: "CC0 (public domain)";
    };
    readonly entrezGene: {
        readonly uri: "http://www.ncbi.nlm.nih.gov/gene";
        readonly id: "entrezGene";
        readonly name: "NCBI Entrez Gene";
        readonly homepage: "https://www.ncbi.nlm.nih.gov/gene";
        readonly license: "Public domain (US Government)";
    };
    readonly ensembl: {
        readonly uri: "http://www.ensembl.org";
        readonly id: "ensembl";
        readonly name: "Ensembl Gene/Transcript IDs";
        readonly homepage: "https://www.ensembl.org";
    };
    readonly uniprot: {
        readonly uri: "http://www.uniprot.org/uniprot";
        readonly id: "uniprot";
        readonly name: "UniProt";
        readonly homepage: "https://www.uniprot.org";
        readonly license: "CC BY 4.0";
    };
    readonly chembl: {
        readonly uri: "https://www.ebi.ac.uk/chembl";
        readonly id: "chembl";
        readonly name: "ChEMBL Compound Identifiers";
        readonly homepage: "https://www.ebi.ac.uk/chembl/";
        readonly license: "CC BY-SA 3.0";
    };
    readonly chebi: {
        readonly uri: "http://purl.obolibrary.org/obo/CHEBI";
        readonly id: "chebi";
        readonly name: "ChEBI — Chemical Entities of Biological Interest";
        readonly homepage: "https://www.ebi.ac.uk/chebi/";
    };
    readonly clinvar: {
        readonly uri: "https://www.ncbi.nlm.nih.gov/clinvar";
        readonly id: "clinvar";
        readonly name: "ClinVar Variants";
        readonly homepage: "https://www.ncbi.nlm.nih.gov/clinvar/";
        readonly license: "Public domain (US Government)";
    };
    readonly mondo: {
        readonly uri: "http://purl.obolibrary.org/obo/mondo.owl";
        readonly id: "mondo";
        readonly name: "Monarch Disease Ontology";
        readonly homepage: "https://mondo.monarchinitiative.org";
    };
    readonly hpo: {
        readonly uri: "http://human-phenotype-ontology.org";
        readonly id: "hpo";
        readonly name: "Human Phenotype Ontology";
        readonly homepage: "https://hpo.jax.org";
    };
    readonly mesh: {
        readonly uri: "http://id.nlm.nih.gov/mesh";
        readonly id: "mesh";
        readonly name: "Medical Subject Headings (MeSH)";
        readonly homepage: "https://www.nlm.nih.gov/mesh/meshhome.html";
        readonly license: "Public domain (US Government)";
    };
};
/** All known systems flattened by URI for runtime lookup. */
export declare const SYSTEMS_BY_URI: Readonly<Record<string, CodeSystemDescriptor>>;
/** Lookup a system descriptor by its canonical URI, returning undefined if unknown. */
export declare function getSystemDescriptor(uri: string): CodeSystemDescriptor | undefined;
/** Return the short id of a system from its canonical URI. */
export declare function getSystemId(uri: string): string | undefined;
//# sourceMappingURL=code-systems.d.ts.map