import { createClient, type SanityClient } from "@sanity/client";

const projectId = process.env.SANITY_PROJECT_ID || "kicslgfz";
const dataset = process.env.SANITY_DATASET || "production";
const token = process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_TOKEN || undefined;

export const sanityClient: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion: "2023-05-03",
  useCdn: true,
  token,
  perspective: "published",
});

export const SANITY_PROJECT_ID = projectId;
export const SANITY_DATASET = dataset;
