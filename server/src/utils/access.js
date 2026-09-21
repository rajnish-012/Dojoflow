/**
 * Data scope helper.
 *
 * req.user.dataScope is set by the "protect" middleware:
 *   "ALL"    -> the user can see every branch
 *   "BRANCH" -> the user can only see their own branch
 *
 * Anything that is not exactly "ALL" is treated as branch-only,
 * so a missing value never leaks data.
 */
const isBranchScoped = (user) => user?.dataScope !== "ALL";

module.exports = { isBranchScoped };