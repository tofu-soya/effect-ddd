import { Data } from "effect";

// From @lotiport/services
export class ParsingError extends Data.TaggedError("ParsingError")<{
  readonly message: string;
  readonly originalError?: unknown;
}> {}

export class RenderingError extends Data.TaggedError("RenderingError")<{
  readonly message: string;
  readonly originalError?: unknown;
}> {}

export class S3UploadError extends Data.TaggedError("S3UploadError")<{
  readonly message: string;
  readonly originalError?: unknown;
}> {}

// From @lotiport/domain
export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  readonly message: string;
}> {}

export class UserCreationError extends Data.TaggedError("UserCreationError")<{
  readonly originalError?: unknown;
}> {}

export class SubdomainTakenError extends Data.TaggedError("SubdomainTakenError")<{
  readonly subdomain: string;
}> {}

export class WebsiteSettingsNotFoundError extends Data.TaggedError(
  "WebsiteSettingsNotFoundError"
)<{
  readonly message: string;
}> {}
