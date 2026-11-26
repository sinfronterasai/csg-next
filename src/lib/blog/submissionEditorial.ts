// Editorial context is supplied by the writing team. It does not grant approval.
export function submissionEditorial(p: Record<string, any>) {
  const context = p.editorial || {};
  const editorial: Record<string, unknown> = {};
  for (const field of ["readerQuestion", "searchIntent", "distinctContribution", "overlapReview"]) {
    if (context[field]) editorial[field] = context[field];
  }
  const sources = (p.sources || []).map((source: any) => source.url);
  if (sources.length) editorial.factualSources = sources;
  const notes = [context.outstandingVerification, ...(p.openQuestions || [])].filter(Boolean);
  if (notes.length) editorial.outstandingVerification = notes.join("\n");
  return {
    ...(Object.keys(editorial).length ? { editorial } : {}),
    ...(p.articlePurpose ? { articlePurpose: p.articlePurpose } : {}),
    ...(p.primaryCta ? { primaryCta: { _type: "primaryCta", ...p.primaryCta } } : {}),
    ogTitle: p.metaTitle,
    ogDescription: p.metaDescription,
  };
}
