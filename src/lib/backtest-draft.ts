export function isDraftBacktestMode(
  isStaff: boolean | undefined,
  strategy: string,
  version: string,
): boolean {
  return isStaff === true && Boolean(strategy && version);
}
