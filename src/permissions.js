export const isAdmin = account => !!account && !account.banned && account.role === 'admin';
export const canModerate = account => isAdmin(account) || (!!account && !account.banned && account.role === 'member' && account.moderator === true);
export const roleLabel = account => account?.role === 'admin' ? '◆ ADMIN' : account?.role === 'member' && account.moderator === true ? '◇ MOD' : '◇ MEMBER';
export const canSuspend = (actor,target) => canModerate(actor) && target?.role === 'member' && (isAdmin(actor) || !target.moderator);
