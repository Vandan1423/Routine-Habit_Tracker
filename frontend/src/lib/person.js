// How a signed-in person is named on screen: their name, or failing that their email
export const displayNameOf = (user) => user?.name?.trim() || user?.email || "Account";

// Up to two initials, for the small disc that stands in for a photo
export const initialsOf = (user) =>
    displayNameOf(user)
        .split(/[\s@._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
