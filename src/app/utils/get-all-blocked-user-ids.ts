import { blockService } from '../modules/block/block.service';

export const getAllBlockedUserIds = async (userId: string) => {
  if (!userId) {
    return [];
  }

  // Get blocked user IDs
  const blockedUserIds = userId
    ? await blockService.getBlockedUserIdsFromDb(userId)
    : [];
  const blockedByUserIds = userId
    ? await blockService.getBlockedByUserIdsFromDb(userId)
    : [];
  const excludeUserIds = [...blockedUserIds, ...blockedByUserIds];

  return excludeUserIds;
};
 