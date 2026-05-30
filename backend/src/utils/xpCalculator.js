/**
 * Returns the amount of XP required to complete the current level and reach the next.
 * Formula: Level 1 -> 2 = 100 XP | Level 2 -> 3 = 200 XP | Level 3 -> 4 = 300 XP
 */
export const getXpForLevel = (level) => {
    return level * 100;
};

/**
 * Calculates the user's current level, progress, and next level requirements
 * based on their absolute total lifetime XP.
 */
export const calculateLevel = (totalXp) => {
    let level = 1;
    let remainingXp = totalXp || 0; // Fallback to 0 if totalXp is undefined

    // Loop through the levels, subtracting the required XP for each level
    // until the user doesn't have enough XP to pass the current one.
    while (remainingXp >= getXpForLevel(level)) {
        remainingXp -= getXpForLevel(level);
        level++;
    }

    // Calculate how full the progress bar should be (0 to 100)
    const progressPercentage = Math.floor(
        (remainingXp / getXpForLevel(level)) * 100,
    );

    return {
        level,
        currentXp: remainingXp, // XP accumulated strictly towards the next level
        xpForNext: getXpForLevel(level), // Total XP required to pass the current level
        totalXp: totalXp || 0, // Lifetime XP
        progressPercentage, // Pre-calculated for frontend UI
    };
};
