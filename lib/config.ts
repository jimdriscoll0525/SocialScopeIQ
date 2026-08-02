// Model configuration. Override via env; defaults keep current behavior.
// - DRAFT_MODEL: short-form response drafting (unchanged from v1).
// - CLASSIFY_MODEL: cheap realtor-lead classification (one small call/post).
// - BLOG_MODEL: long-form blog generation (stronger model; note Opus 5
//   rejects the `temperature` param — don't send one).
export const DRAFT_MODEL = process.env.DRAFT_MODEL || "claude-sonnet-4-6";
export const CLASSIFY_MODEL = process.env.CLASSIFY_MODEL || "claude-haiku-4-5";
export const BLOG_MODEL = process.env.BLOG_MODEL || "claude-opus-5";
