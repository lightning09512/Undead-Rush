/** Shared Campaign rule for both projectile collision and portal UI state. */
export function canDamageCampaignSpawnPortal(
  bossRoomActive: boolean,
  portalZoneIndex: number,
  bossRoomZoneIndex: number,
  chargeObjectiveLocked: boolean,
): boolean {
  return bossRoomActive && portalZoneIndex === bossRoomZoneIndex && !chargeObjectiveLocked;
}
