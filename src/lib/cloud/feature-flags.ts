/** M02 feature flag: the legacy Next APIs remain authoritative until a
 * real hosted backend has passed auth, migration and rollback testing.
 * Do not enable this flag automatically or infer readiness from an API URL.
 */
export const useHostedCubicsApi = process.env.NEXT_PUBLIC_CUBICS_HOSTED_API_ENABLED === "true";

export function configuredHostedApiOrigin(): string {
  if (!useHostedCubicsApi) {
    throw new Error("Hosted Cubics API has not been enabled for this client");
  }
  const origin = process.env.NEXT_PUBLIC_CUBICS_API_ORIGIN;
  if (!origin) {
    throw new Error("NEXT_PUBLIC_CUBICS_API_ORIGIN must be set when hosted API is enabled");
  }
  return origin;
}
